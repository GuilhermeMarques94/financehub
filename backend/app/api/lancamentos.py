from datetime import date
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import Lancamento, Conta, Fatura, User
from app.schemas import LancamentoCreate, LancamentoOut, LancamentoUpdate

router = APIRouter(prefix="/lancamentos", tags=["Lançamentos"])


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


# ---- Efeitos colaterais (saldo + fatura) ----
def aplicar_efeito(db, lanc, sinal: int):
    """sinal=+1 aplica, sinal=-1 reverte."""
    # Saldo da conta (só conta, não cartão, e só se pago)
    if lanc.conta_id and not lanc.cartao_id and lanc.status == "pago":
        conta = db.get(Conta, lanc.conta_id)
        if conta:
            delta = lanc.valor if lanc.tipo == "receita" else -lanc.valor
            conta.saldo_atual += delta * sinal
    # Fatura do cartão
    if lanc.fatura_id:
        fat = db.get(Fatura, lanc.fatura_id)
        if fat:
            fat.valor_total += lanc.valor * sinal


@router.get("", response_model=list[LancamentoOut])
def listar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Lancamento).filter(Lancamento.user_id == user.id)\
        .order_by(Lancamento.data_competencia.desc()).all()


@router.get("/{lanc_id}", response_model=LancamentoOut)
def obter(lanc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lanc = db.query(Lancamento).filter(
        Lancamento.id == lanc_id, Lancamento.user_id == user.id
    ).first()
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado")
    return lanc


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
        db.flush()  # garante id/fatura antes de aplicar efeito
        aplicar_efeito(db, lanc, +1)
        criados.append(lanc)

    db.commit()
    for c in criados:
        db.refresh(c)
    return criados


@router.put("/{lanc_id}", response_model=LancamentoOut)
def editar(
    lanc_id: str,
    data: LancamentoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lanc = db.query(Lancamento).filter(
        Lancamento.id == lanc_id, Lancamento.user_id == user.id
    ).first()
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado")

    # 1) reverte efeito antigo
    aplicar_efeito(db, lanc, -1)

    # 2) aplica alterações
    campos = data.model_dump(exclude_unset=True)
    for k, v in campos.items():
        setattr(lanc, k, v)

    # 3) recalcula fatura se virou/mudou cartão ou competência
    if lanc.cartao_id:
        f = get_or_create_fatura(
            db, user.id, lanc.cartao_id,
            lanc.data_competencia.month, lanc.data_competencia.year,
        )
        lanc.fatura_id = f.id
    else:
        lanc.fatura_id = None

    db.flush()
    # 4) aplica efeito novo
    aplicar_efeito(db, lanc, +1)

    db.commit()
    db.refresh(lanc)
    return lanc


@router.delete("/{lanc_id}")
def excluir(lanc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lanc = db.query(Lancamento).filter(
        Lancamento.id == lanc_id, Lancamento.user_id == user.id
    ).first()
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado")
    # reverte efeito antes de excluir (corrige saldo/fatura)
    aplicar_efeito(db, lanc, -1)
    db.delete(lanc)
    db.commit()
    return {"message": "Excluído"}
