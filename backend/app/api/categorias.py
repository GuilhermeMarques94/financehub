from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import Categoria, User
from app.schemas import CategoriaCreate, CategoriaOut, CategoriaUpdate

router = APIRouter(prefix="/categorias", tags=["Plano de Contas"])


@router.get("", response_model=list[CategoriaOut])
def listar(
    tipo: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Categoria).filter(Categoria.user_id == user.id)
    if tipo:
        q = q.filter(Categoria.tipo == tipo)
    return q.order_by(Categoria.grupo, Categoria.nome).all()


@router.post("", response_model=CategoriaOut)
def criar(
    data: CategoriaCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = Categoria(user_id=user.id, **data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{cat_id}", response_model=CategoriaOut)
def editar(
    cat_id: str,
    data: CategoriaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = db.query(Categoria).filter(
        Categoria.id == cat_id, Categoria.user_id == user.id
    ).first()
    if not cat:
        raise HTTPException(404, "Categoria não encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}")
def excluir(
    cat_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = db.query(Categoria).filter(
        Categoria.id == cat_id, Categoria.user_id == user.id
    ).first()
    if not cat:
        raise HTTPException(404, "Categoria não encontrada")
    # impede excluir se houver filhos
    filhos = db.query(Categoria).filter(Categoria.parent_id == cat_id).count()
    if filhos:
        raise HTTPException(400, "Exclua as subcategorias primeiro")
    db.delete(cat)
    db.commit()
    return {"message": "Categoria excluída"}
