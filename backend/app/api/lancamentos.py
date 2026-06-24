from datetime import date
from dateutil.relativedelta import relativedelta  # pip install python-dateutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import Lancamento, Conta, Fatura, User
from app.schemas import LancamentoCreate, LancamentoOut

router = APIRouter(prefix="/api/lancamentos", tags=["Lançamentos"])


def get_or_create_fatura(db, user_id, cartao_id, mes, ano):
    f = db.query(Fatura).filter(
        Fatura.cartao_id == cartao_id, Fatura.mes == mes, Fatura.ano == ano
    ).first()
    if not f:
        f = Fatura(user_id=user_id, cartao_id=cartao_id, mes=mes, ano=ano)
        db.add(f)
        db.commit()
        db.refresh(f)
    return f


@router.get("", response_model=list[LancamentoOut])
def listar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Lancamento).filter(Lancamento.user_id == user.id)\
        .order_by(Lancamento.data_competencia.desc()).all()


@router.post("", response_model=list[LancamentoOut])
def criar(data: LancamentoCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    criados = []
    parcelas = data.parcelas_total or 1

    for i in range(parcelas):
        comp = data.data_competencia + relativedelta(months=i)
        valor = round(data.valor / parcelas, 2) if data.parcelas_total else data.valor
        fatura_id = None

        if data.cartao_id:
            f = get_or_create_fatura(db, user.id, data.cartao_id, comp.month, comp.year)
            fatura_id = f.id
            f.valor_total += valor

        lanc = Lancamento(
            user_id=user.id, tipo=data.tipo, descricao=data.descricao,
            valor=valor, data_competencia=comp, data_pagamento=data.data_pagamento,
            conta_id=data.conta_id, categoria_id=data.categoria_id,
            cartao_id=data.cartao_id, fatura_id=fatura_id,
            parcela_atual=(i + 1) if data.parcelas_total else None,
            parcelas_total=data.parcelas_total, recorrencia=data.recorrencia,
            status=data.status, observacoes=data.observacoes,
        )
        db.add(lanc)
        criados.append(lanc)

        # Atualiza saldo da conta (somente débito/crédito em conta, não cartão)
        if data.conta_id and not data.cartao_id and data.status == "pago":
            conta = db.get(Conta, data.conta_id)
            if conta:
                conta.saldo_atual += valor if data.tipo == "receita" else -valor

    db.commit()
    for c in criados:
        db.refresh(c)
    return criados


@router.delete("/{lanc_id}")
def excluir(lanc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lanc = db.query(Lancamento).filter(Lancamento.id == lanc_id, Lancamento.user_id == user.id).first()
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado")
    db.delete(lanc)
    db.commit()
    return {"message": "Excluído"}
