from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import Conta, User
from app.schemas import ContaCreate, ContaOut

router = APIRouter(prefix="/api/contas", tags=["Contas"])


@router.get("", response_model=list[ContaOut])
def listar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Conta).filter(Conta.user_id == user.id).all()


@router.post("", response_model=ContaOut)
def criar(data: ContaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    conta = Conta(user_id=user.id, saldo_atual=data.saldo_inicial, **data.model_dump())
    db.add(conta)
    db.commit()
    db.refresh(conta)
    return conta


@router.put("/{conta_id}", response_model=ContaOut)
def editar(conta_id: str, data: ContaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    conta = db.query(Conta).filter(Conta.id == conta_id, Conta.user_id == user.id).first()
    if not conta:
        raise HTTPException(404, "Conta não encontrada")
    for k, v in data.model_dump().items():
        setattr(conta, k, v)
    db.commit()
    db.refresh(conta)
    return conta


@router.delete("/{conta_id}")
def excluir(conta_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    conta = db.query(Conta).filter(Conta.id == conta_id, Conta.user_id == user.id).first()
    if not conta:
        raise HTTPException(404, "Conta não encontrada")
    db.delete(conta)
    db.commit()
    return {"message": "Conta excluída"}
