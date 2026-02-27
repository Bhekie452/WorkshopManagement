"""
Database Connection and Session Management

This module provides database session management for the SQLAlchemy ORM.
"""

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base


# =============================================================================
# Database Configuration
# =============================================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./workshop.db"
)

# Create engine
_engine_kwargs = dict(
    echo=os.getenv("DEBUG", "false").lower() == "true",
    pool_pre_ping=True,
)
if not DATABASE_URL.startswith("sqlite"):
    _engine_kwargs.update(pool_size=5, max_overflow=10)
else:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **_engine_kwargs)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# =============================================================================
# Session Management
# =============================================================================

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions.
    
    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    Context manager for database sessions (non-FastAPI usage).
    
    Usage:
        with get_db_context() as db:
            items = db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# =============================================================================
# Database Initialization
# =============================================================================

def init_db() -> None:
    """Create all tables in the database."""
    Base.metadata.create_all(bind=engine)


def drop_db() -> None:
    """Drop all tables in the database. USE WITH CAUTION."""
    Base.metadata.drop_all(bind=engine)


# =============================================================================
# Health Check
# =============================================================================

def check_db_connection() -> bool:
    """Check if database connection is working."""
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False
