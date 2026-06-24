from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api import auth, contas, lancamentos, dashboard
# importe também categorias, cartoes (mesmo padrão de contas)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FinanceHub API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5500", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(contas.router)
app.include_router(lancamentos.router)
app.include_router(dashboard.router)


@app.get("/")
def health():
    return {"status": "online", "service": "FinanceHub API"}
