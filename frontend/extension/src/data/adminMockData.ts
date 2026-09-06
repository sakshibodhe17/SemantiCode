// Mock data for the SECONDARY admin dashboard only (see project scope
// section 7 — the IDE extension is the primary interface; admin is a
// conceptual/future web dashboard). Centralized here, separate from
// the developer-facing mock data in webview-ui/src/data/mockData.ts,
// since the two panels are built and shipped independently.

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "developer" | "admin";
  lastActive: string;
}

export interface AdminRepository {
  id: string;
  name: string;
  language: string;
  files: number;
  status: "indexed" | "indexing" | "not-indexed";
  owner: string;
}

export interface AdminSearchLogEntry {
  id: string;
  user: string;
  query: string;
  repository: string;
  timestamp: string;
  resultCount: number;
}

export const adminSummary = {
  totalUsers: 18,
  totalRepositories: 7,
  totalSearchesToday: 143,
  avgSearchLatencyMs: 210,
};

export const adminUsers: AdminUser[] = [
  { id: "u1", name: "Sakshi Bodhe", email: "sakshi@example.edu", role: "admin", lastActive: "Today, 7:40 PM" },
  { id: "u2", name: "Rohan Mehta", email: "rohan@example.edu", role: "developer", lastActive: "Today, 6:12 PM" },
  { id: "u3", name: "Ananya Iyer", email: "ananya@example.edu", role: "developer", lastActive: "Yesterday" },
];

export const adminRepositories: AdminRepository[] = [
  { id: "r1", name: "demo-project", language: "Python", files: 248, status: "indexed", owner: "Sakshi Bodhe" },
  { id: "r2", name: "inventory-api", language: "Java", files: 96, status: "indexed", owner: "Rohan Mehta" },
  { id: "r3", name: "frontend-dashboard", language: "TypeScript", files: 152, status: "indexing", owner: "Ananya Iyer" },
];

export const adminSearchLogs: AdminSearchLogEntry[] = [
  { id: "l1", user: "Sakshi Bodhe", query: "Where is JWT authentication handled?", repository: "demo-project", timestamp: "Today, 7:59 PM", resultCount: 9 },
  { id: "l2", user: "Rohan Mehta", query: "Where is the inventory count updated?", repository: "inventory-api", timestamp: "Today, 6:20 PM", resultCount: 5 },
  { id: "l3", user: "Ananya Iyer", query: "Find the chart rendering component", repository: "frontend-dashboard", timestamp: "Yesterday", resultCount: 3 },
];

export const adminSupportedLanguages = [
  "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "Go",
];
