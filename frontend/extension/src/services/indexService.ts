// Real workspace indexing for the extension host.
//
//  * Scans the open workspace folder(s) with vscode.workspace.findFiles,
//    honouring the enabled languages, exclude globs and size limits.
//  * Splits each file into functions / classes / module blocks (chunker.ts).
//  * Builds the BM25F inverted index (searchIndex.ts).
//  * Persists the index per workspace (context.storageUri/index.json) so
//    re-opening VS Code does not re-parse everything.
//  * Re-indexing is incremental: unchanged files (same mtime + size) are
//    reused from the cache, so only edited files are parsed again.
//  * A file-system watcher keeps the index fresh as files are saved,
//    created or deleted (setting: semanticode.autoIndexOnSave).

import * as vscode from "vscode";
import { chunkFile, extensionsForLanguages, languageOf } from "../engine/chunker";
import { IndexStats, RankedResult, SearchIndex, SerializedIndex } from "../engine/searchIndex";
import type { IndexProgress, IndexStatus } from "../shared/protocol";
import { enabledLanguages, excludeGlobs, maxFileSizeBytes, maxFiles } from "./settingsService";

export class NotIndexedError extends Error {
  constructor() {
    super("This workspace has not been indexed yet. Run “SemantiCode: Index Workspace” first.");
  }
}

type ProgressFn = (p: IndexProgress) => void;

export class IndexService implements vscode.Disposable {
  private index = new SearchIndex();
  private loadPromise: Promise<void> | null = null;
  private running: Promise<IndexStats> | null = null;
  private watcher: vscode.FileSystemWatcher | undefined;
  private pendingUpdates = new Map<string, ReturnType<typeof setTimeout>>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly emitter = new vscode.EventEmitter<void>();
  private disposables: vscode.Disposable[] = [];

  readonly onDidChange = this.emitter.event;
  status: IndexStatus = "not-indexed";
  lastDurationSeconds = 0;
  lastError: string | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("semanticode.supportedLanguages") || e.affectsConfiguration("semanticode.autoIndexOnSave")) {
          this.resetWatcher();
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.index.clear();
        this.status = "not-indexed";
        this.emitter.fire();
      })
    );
  }

  // ------------------------------------------------------------ state

  get builtAt(): string | null {
    return this.index.builtAt;
  }

  stats(): IndexStats {
    return this.index.stats();
  }

  isReady(): boolean {
    return this.status === "indexed" && !this.index.isEmpty;
  }

  /** Load a previously saved index from disk (once). */
  ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.loadFromDisk();
    return this.loadPromise;
  }

  private storageFile(): vscode.Uri | undefined {
    const dir = this.context.storageUri;
    return dir ? vscode.Uri.joinPath(dir, "index.json") : undefined;
  }

  private async loadFromDisk(): Promise<void> {
    const file = this.storageFile();
    if (!file) return;
    try {
      const raw = await vscode.workspace.fs.readFile(file);
      const data = JSON.parse(new TextDecoder().decode(raw)) as SerializedIndex & { durationSeconds?: number };
      const loaded = SearchIndex.fromJSON(data);
      if (loaded && !loaded.isEmpty) {
        this.index = loaded;
        this.status = "indexed";
        this.lastDurationSeconds = data.durationSeconds ?? 0;
        this.resetWatcher();
        this.emitter.fire();
      }
    } catch {
      // No saved index yet (first run) or unreadable cache — just start fresh.
    }
  }

  private async saveToDisk(): Promise<void> {
    const file = this.storageFile();
    if (!file || !this.context.storageUri) return;
    try {
      await vscode.workspace.fs.createDirectory(this.context.storageUri);
      const payload = { ...this.index.toJSON(), durationSeconds: this.lastDurationSeconds };
      await vscode.workspace.fs.writeFile(file, new TextEncoder().encode(JSON.stringify(payload)));
    } catch (err) {
      console.warn("SemantiCode: could not persist index", err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.saveToDisk(), 1500);
  }

  // ------------------------------------------------------------ paths

  private get multiRoot(): boolean {
    return (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
  }

  relativePath(uri: vscode.Uri): string {
    return vscode.workspace.asRelativePath(uri, this.multiRoot).replace(/\\/g, "/");
  }

  resolve(relativePath: string): vscode.Uri | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return undefined;
    if (folders.length > 1) {
      const [head, ...rest] = relativePath.split("/");
      const folder = folders.find((f) => f.name === head);
      if (folder) return vscode.Uri.joinPath(folder.uri, ...rest);
    }
    return vscode.Uri.joinPath(folders[0].uri, ...relativePath.split("/"));
  }

  private includeGlob(): string {
    const exts = extensionsForLanguages(enabledLanguages());
    return exts.length ? `**/*.{${exts.join(",")}}` : "**/*.__none__";
  }

  private excludeGlob(): string {
    return `{${excludeGlobs().join(",")}}`;
  }

  private isExcluded(uri: vscode.Uri): boolean {
    const p = uri.path;
    return /\/(node_modules|\.git|dist|out|build|\.venv|venv|env|__pycache__|\.next|target|coverage|vendor)\//.test(p)
      || /\.(min|bundle)\.js$/.test(p);
  }

  // ------------------------------------------------------------ indexing

  /** Full (incremental) index of the workspace. Concurrent calls share one run. */
  buildIndex(onProgress: ProgressFn = () => undefined, token?: vscode.CancellationToken): Promise<IndexStats> {
    if (this.running) return this.running;
    this.running = this.runBuild(onProgress, token).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runBuild(onProgress: ProgressFn, token?: vscode.CancellationToken): Promise<IndexStats> {
    await this.ensureLoaded();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      throw new Error("Open a folder in VS Code first — SemantiCode indexes the current workspace.");
    }

    const started = Date.now();
    const previousStatus = this.status;
    this.status = "indexing";
    this.lastError = null;
    this.emitter.fire();

    try {
      onProgress({ phase: "detect", current: 0, total: 0, message: `Workspace: ${folders.map((f) => f.name).join(", ")}` });

      // 1. scan
      onProgress({ phase: "scan", current: 0, total: 0, message: "Scanning source files…" });
      const limit = maxFiles();
      const uris = await vscode.workspace.findFiles(this.includeGlob(), this.excludeGlob(), limit + 1, token);
      const truncated = uris.length > limit;
      const files = uris.slice(0, limit).filter((u) => !this.isExcluded(u));
      onProgress({ phase: "scan", current: files.length, total: files.length, message: `Found ${files.length} source files${truncated ? ` (limited to ${limit})` : ""}` });

      // 2. parse (reusing unchanged files from the cache)
      const seen = new Set<string>();
      const maxBytes = maxFileSizeBytes();
      let reused = 0;
      let parsed = 0;
      let skipped = 0;
      for (let i = 0; i < files.length; i++) {
        if (token?.isCancellationRequested) throw new vscode.CancellationError();
        const uri = files[i];
        const rel = this.relativePath(uri);
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.size > maxBytes) {
            skipped++;
            continue;
          }
          seen.add(rel);
          const cached = this.index.getFile(rel);
          if (cached && cached.mtime === stat.mtime && cached.size === stat.size) {
            reused++;
          } else {
            const content = new TextDecoder("utf-8").decode(await vscode.workspace.fs.readFile(uri));
            if (content.includes("\u0000")) {
              skipped++; // binary file with a source extension
              seen.delete(rel);
              continue;
            }
            this.index.setFile(rel, { mtime: stat.mtime, size: stat.size, chunks: chunkFile(rel, content) });
            parsed++;
          }
        } catch {
          skipped++;
        }
        if (i % 20 === 0 || i === files.length - 1) {
          onProgress({ phase: "parse", current: i + 1, total: files.length, message: `Parsing ${rel}` });
          // yield to the event loop so the UI stays responsive on big repos
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      for (const old of this.index.filePaths()) if (!seen.has(old)) this.index.removeFile(old);

      // 3. build inverted index (forces the BM25 structures to be computed now)
      onProgress({ phase: "build", current: 0, total: 0, message: "Building search index…" });
      this.index.search("warmup", { topK: 1 });
      this.index.builtAt = new Date().toISOString();
      this.lastDurationSeconds = Math.round((Date.now() - started) / 10) / 100;

      // 4. persist
      onProgress({ phase: "save", current: 0, total: 0, message: "Saving index…" });
      await this.saveToDisk();

      this.status = this.index.isEmpty ? "not-indexed" : "indexed";
      const stats = this.index.stats();
      onProgress({
        phase: "done",
        current: files.length,
        total: files.length,
        message: `Indexed ${stats.files} files → ${stats.chunks} code units (${parsed} parsed, ${reused} unchanged, ${skipped} skipped) in ${this.lastDurationSeconds}s`,
      });
      this.resetWatcher();
      return stats;
    } catch (err) {
      this.status = err instanceof vscode.CancellationError ? previousStatus : "error";
      this.lastError = (err as Error).message;
      throw err;
    } finally {
      this.emitter.fire();
    }
  }

  async clear(): Promise<void> {
    this.index.clear();
    this.status = "not-indexed";
    this.watcher?.dispose();
    this.watcher = undefined;
    const file = this.storageFile();
    if (file) {
      try {
        await vscode.workspace.fs.delete(file);
      } catch {
        /* nothing saved yet */
      }
    }
    this.emitter.fire();
  }

  // ------------------------------------------------------------ search

  async search(query: string, topK: number, expand = true): Promise<RankedResult[]> {
    await this.ensureLoaded();
    if (this.running) await this.running.catch(() => undefined);
    if (!this.isReady()) throw new NotIndexedError();
    return this.index.search(query, { topK, expand });
  }

  // ------------------------------------------------------------ live updates

  private resetWatcher(): void {
    this.watcher?.dispose();
    this.watcher = undefined;
    const auto = vscode.workspace.getConfiguration("semanticode").get<boolean>("autoIndexOnSave", true);
    if (!auto || this.status !== "indexed") return;

    const w = vscode.workspace.createFileSystemWatcher(this.includeGlob());
    w.onDidChange((u) => this.queueUpdate(u));
    w.onDidCreate((u) => this.queueUpdate(u));
    w.onDidDelete((u) => {
      if (this.index.removeFile(this.relativePath(u))) {
        this.scheduleSave();
        this.emitter.fire();
      }
    });
    this.watcher = w;
  }

  private queueUpdate(uri: vscode.Uri): void {
    if (this.isExcluded(uri) || !languageOf(uri.path)) return;
    const key = uri.toString();
    const prev = this.pendingUpdates.get(key);
    if (prev) clearTimeout(prev);
    this.pendingUpdates.set(
      key,
      setTimeout(() => {
        this.pendingUpdates.delete(key);
        void this.updateFile(uri);
      }, 500)
    );
  }

  /** Re-parse a single file (called on save / create). */
  async updateFile(uri: vscode.Uri): Promise<void> {
    if (this.status !== "indexed") return;
    const rel = this.relativePath(uri);
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > maxFileSizeBytes()) return;
      const content = new TextDecoder("utf-8").decode(await vscode.workspace.fs.readFile(uri));
      this.index.setFile(rel, { mtime: stat.mtime, size: stat.size, chunks: chunkFile(rel, content) });
      this.scheduleSave();
      this.emitter.fire();
    } catch {
      if (this.index.removeFile(rel)) this.emitter.fire();
    }
  }

  dispose(): void {
    this.watcher?.dispose();
    for (const t of this.pendingUpdates.values()) clearTimeout(t);
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      void this.saveToDisk();
    }
    this.emitter.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
