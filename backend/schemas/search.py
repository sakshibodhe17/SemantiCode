"""Request models for the code indexing and search API."""
from pydantic import BaseModel, Field


class IndexRequest(BaseModel):
    workspace_id: str = Field(min_length=1, max_length=120)
    path: str = Field(min_length=1)


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    workspace_id: str = Field(min_length=1, max_length=120)
    top_k: int = Field(default=10, ge=1, le=50)
