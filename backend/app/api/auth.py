import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models import User
from app.schemas import UserCreate, Token, UserOut, PasswordReset, PasswordResetConfirm

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=Token)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "E-mail já cadastrado")
    user = User(nome=data.nome, email=data.email, senha_hash=hash_password(data.senha))
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.senha_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciais inválidas")
    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/forgot-password")
def forgot_password(data: PasswordReset, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        user.reset_token = str(uuid.uuid4())
        db.commit()
        # Em produção: enviar token por e-mail (SMTP/Resend)
        return {"message": "Token gerado", "reset_token": user.reset_token}
    return {"message": "Se o e-mail existir, um link será enviado"}


@router.post("/reset-password")
def reset_password(data: PasswordResetConfirm, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == data.token).first()
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token inválido")
    user.senha_hash = hash_password(data.nova_senha)
    user.reset_token = None
    db.commit()
    return {"message": "Senha alterada com sucesso"}
