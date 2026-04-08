from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routes import router

ROOF_OUTPUTS_DIR = Path(__file__).resolve().parent.parent / "roof_outputs"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    ROOF_OUTPUTS_DIR.mkdir(exist_ok=True)
    yield


app = FastAPI(
    title="AI Sales Coach",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.mount("/roof_outputs", StaticFiles(directory=str(ROOF_OUTPUTS_DIR)), name="roof_outputs")
