from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import Cartao, User
from app.schemas.cartoes import (
    CartaoCreate, CartaoOut, FaturaOut, FaturaDetalhe, PagarFatura
)
from app.services.cartao_service import CartaoService

router = APIRouter(prefix="/cartoes", tags=["Cartões"])


@router.get("", response_model=list[CartaoOut])
def listar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return CartaoService(db, user.id).listar_cartoes()


@router.post("", response_model=CartaoOut)
def criar(data: CartaoCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if data.principal:
        # desmarca outros principais
        db.query(Cartao).filter(Cartao.user_id == user.id).update({Cartao.principal: False})
    cartao = Cartao(user_id=user.id, **data.model_dump())
    db.add(cartao)
    db.commit()
    db.refresh(cartao)
    cons = CartaoService(db, user.id).calcular_consolidacao(cartao)
    return {**cartao.__dict__, **cons}


@router.put("/{cartao_id}", response_model=CartaoOut)
def editar(cartao_id: str, data: CartaoCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cartao = db.query(Cartao).filter(Cartao.id == cartao_id, Cartao.user_id == user.id).first()
    if not cartao:
        raise HTTPException(404, "Cartão não encontrado")
    for k, v in data.model_dump().items():
        setattr(cartao, k, v)
    db.commit()
    db.refresh(cartao)
    cons = CartaoService(db, user.id).calcular_consolidacao(cartao)
    return {**cartao.__dict__, **cons}


@router.delete("/{cartao_id}")
def excluir(cartao_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cartao = db.query(Cartao).filter(Cartao.id == cartao_id, Cartao.user_id == user.id).first()
    if not cartao:
        raise HTTPException(404, "Cartão não encontrado")
    db.delete(cartao)
    db.commit()
    return {"message": "Cartão excluído"}


# ---------- Faturas ----------
@router.get("/{cartao_id}/faturas", response_model=list[FaturaOut])
def faturas(cartao_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return CartaoService(db, user.id).listar_faturas(cartao_id)


@router.get("/faturas/{fatura_id}", response_model=FaturaDetalhe)
def detalhe_fatura(fatura_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d = CartaoService(db, user.id).detalhe_fatura(fatura_id)
    if not d:
        raise HTTPException(404, "Fatura não encontrada")
    return d


@router.post("/faturas/{fatura_id}/pagar", response_model=FaturaOut)
def pagar(fatura_id: str, data: PagarFatura, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        return CartaoService(db, user.id).pagar_fatura(fatura_id, data.valor, data.conta_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
