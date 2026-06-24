from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import Conta, Lancamento, Categoria, User

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    saldo = db.query(func.coalesce(func.sum(Conta.saldo_atual), 0))\
        .filter(Conta.user_id == user.id, Conta.ativo == True).scalar()

    receitas = db.query(func.coalesce(func.sum(Lancamento.valor), 0))\
        .filter(Lancamento.user_id == user.id, Lancamento.tipo == "receita").scalar()

    despesas = db.query(func.coalesce(func.sum(Lancamento.valor), 0))\
        .filter(Lancamento.user_id == user.id, Lancamento.tipo == "despesa").scalar()

    por_categoria = db.query(
        Categoria.nome, Categoria.cor, func.sum(Lancamento.valor)
    ).join(Lancamento, Lancamento.categoria_id == Categoria.id)\
     .filter(Lancamento.user_id == user.id, Lancamento.tipo == "despesa")\
     .group_by(Categoria.nome, Categoria.cor).all()

    return {
        "saldo_consolidado": round(saldo, 2),
        "total_receitas": round(receitas, 2),
        "total_despesas": round(despesas, 2),
        "fluxo_caixa": round(receitas - despesas, 2),
        "despesas_por_categoria": [
            {"categoria": n, "cor": c, "valor": round(v, 2)} for n, c, v in por_categoria
        ],
    }
