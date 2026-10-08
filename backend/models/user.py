"""SQLAlchemy ORM model for application users."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    """A registered user of the Semantic Code Search Engine."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="developer")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} role={self.role!r}>"


class Workspace(Base):
    """A locally indexed codebase."""
    __tablename__ = "workspaces"
    id = Column(String(120), primary_key=True)
    path = Column(String(1000), nullable=False)
    indexed_at = Column(DateTime, default=datetime.utcnow)
    file_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)


class CodeChunk(Base):
    """A searchable function, class, or file fragment from a workspace."""
    __tablename__ = "code_chunks"
    id = Column(Integer, primary_key=True)
    workspace_id = Column(String(120), ForeignKey("workspaces.id"), nullable=False, index=True)
    file_path = Column(String(1000), nullable=False)
    symbol_name = Column(String(300), nullable=False)
    symbol_type = Column(String(30), nullable=False)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    search_text = Column(Text, nullable=False)


class SearchHistory(Base):
    __tablename__ = "search_history"
    id = Column(Integer, primary_key=True)
    workspace_id = Column(String(120), nullable=False, index=True)
    query = Column(Text, nullable=False)
    result_count = Column(Integer, nullable=False)
    searched_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id = Column(Integer, primary_key=True)
    username = Column(String(150), nullable=False, index=True)
    success = Column(Boolean, nullable=False)
    attempted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
