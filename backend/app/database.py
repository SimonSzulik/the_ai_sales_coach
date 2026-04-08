from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import inspect as sa_inspect

from app.config import get_settings

engine = create_async_engine(get_settings().database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _migrate_leads_annual_electricity(sync_conn) -> None:
    """Add annual_electricity_kwh if missing (existing DBs before column existed)."""
    try:
        insp = sa_inspect(sync_conn)
        if not insp.has_table("leads"):
            return
        cols = [c["name"] for c in insp.get_columns("leads")]
    except Exception:
        return
    if "annual_electricity_kwh" in cols:
        return
    dialect = sync_conn.dialect.name
    if dialect == "sqlite":
        sync_conn.execute(text("ALTER TABLE leads ADD COLUMN annual_electricity_kwh FLOAT"))
    else:
        sync_conn.execute(text("ALTER TABLE leads ADD COLUMN annual_electricity_kwh DOUBLE PRECISION"))


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_leads_annual_electricity)
