from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api import auth, contas, lancamentos, dashboard, cartoes
from app.api import categorias

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FinanceHub API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://financehub-sooty.vercel.app",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# prefixo /api para bater com o frontend
app.include_router(auth.router, prefix="/api")
app.include_router(contas.router, prefix="/api")
app.include_router(lancamentos.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(cartoes.router, prefix="/api")
app.include_router(categorias.router, prefix="/api")


@app.get("/")
def health():
    return {"status": "online", "service": "FinanceHub API"}
