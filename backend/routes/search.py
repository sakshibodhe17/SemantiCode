"""Index, search, status, and history endpoints for SemantiCode."""
from datetime import datetime
from fastapi import APIRouter, HTTPException

from backend.db.connection import get_db_session
from backend.models.user import CodeChunk, SearchHistory, Workspace
from backend.schemas.search import IndexRequest, SearchRequest
from backend.services.indexer import collect_chunks, tokens

router = APIRouter(prefix="/api", tags=["semantic-search"])


@router.post("/index")
def index_workspace(payload: IndexRequest):
    try:
        file_count, chunks = collect_chunks(payload.path)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    with get_db_session() as session:
        session.query(CodeChunk).filter(CodeChunk.workspace_id == payload.workspace_id).delete()
        workspace = session.get(Workspace, payload.workspace_id) or Workspace(id=payload.workspace_id, path=payload.path)
        workspace.path, workspace.indexed_at = payload.path, datetime.utcnow()
        workspace.file_count, workspace.chunk_count = file_count, len(chunks)
        session.add(workspace)
        session.add_all([CodeChunk(workspace_id=payload.workspace_id, file_path=c["file"], symbol_name=c["name"], symbol_type=c["type"], start_line=c["start"], end_line=c["end"], content=c["content"], search_text=c["search_text"]) for c in chunks])
        session.commit()
    return {"workspace_id": payload.workspace_id, "files_indexed": file_count, "chunks_indexed": len(chunks)}


@router.post("/search")
def search(payload: SearchRequest):
    query_tokens = set(tokens(payload.query).split())
    with get_db_session() as session:
        chunks = session.query(CodeChunk).filter(CodeChunk.workspace_id == payload.workspace_id).all()
        if not chunks:
            raise HTTPException(status_code=404, detail="Workspace is not indexed. Call POST /api/index first.")
        ranked = []
        for chunk in chunks:
            terms = set(chunk.search_text.split())
            overlap = len(query_tokens & terms)
            score = round((overlap / max(len(query_tokens), 1)) * 100, 2)
            if overlap:
                ranked.append((score, chunk))
        ranked.sort(key=lambda item: item[0], reverse=True)
        selected = ranked[:payload.top_k]
        session.add(SearchHistory(workspace_id=payload.workspace_id, query=payload.query, result_count=len(selected)))
        session.commit()
        return {"results": [{"id": str(c.id), "similarity": score, "name": c.symbol_name, "className": None,
                               "file": c.file_path, "startLine": c.start_line, "endLine": c.end_line, "code": c.content}
                              for score, c in selected]}


@router.get("/workspace/{workspace_id}/status")
def workspace_status(workspace_id: str):
    with get_db_session() as session:
        workspace = session.get(Workspace, workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace has not been indexed")
        return {"workspace_id": workspace.id, "path": workspace.path, "status": "ready", "file_count": workspace.file_count,
                "chunk_count": workspace.chunk_count, "indexed_at": workspace.indexed_at}


@router.get("/search/history/{workspace_id}")
def history(workspace_id: str):
    with get_db_session() as session:
        rows = session.query(SearchHistory).filter(SearchHistory.workspace_id == workspace_id).order_by(SearchHistory.searched_at.desc()).limit(50).all()
        return [{"query": r.query, "result_count": r.result_count, "searched_at": r.searched_at} for r in rows]
