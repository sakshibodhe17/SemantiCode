"""Request models for the code indexing and search API."""
from pydantic import BaseModel, Field


class IndexRequest(BaseModel):
    workspace_id: str = Field(min_length=1, max_length=120)
    path: str = Field(min_length=1, description="Absolute path of the folder to index")


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    workspace_id: str = Field(min_length=1, max_length=120)
    top_k: int = Field(default=10, ge=1, le=50)
    expand: bool = Field(default=True, description="Expand query with related code concepts")
