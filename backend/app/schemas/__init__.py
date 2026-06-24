from datetime import date, datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- Auth ----
class UserCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str


class UserLogin(BaseModel):
    email: EmailStr
    senha: str


class UserOut(ORMBase):
    id: str
    nome: str
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    nova_senha: str


# ---- Conta ----
class ContaCreate(BaseModel):
    instituicao: str
    tipo: str
    saldo_inicial: float = 0
    ativo: bool = True


class ContaOut(ORMBase):
    id: str
    instituicao: str
    tipo: str
    saldo_inicial: float
    saldo_atual: float
    ativo: bool


# ---- Categoria ----
class CategoriaCreate(BaseModel):
    nome: str
    tipo: str
    grupo: str | None = None
    cor: str = "#6366f1"
    icone: str = "tag"
    parent_id: str | None = None


class CategoriaOut(ORMBase):
    id: str
    nome: str
    tipo: str
    grupo: str | None
    cor: str
    icone: str
    parent_id: str | None


# ---- Cartao ----
class CartaoCreate(BaseModel):
    nome: str
    banco: str
    bandeira: str
    limite_total: float = 0
    dia_fechamento: int = 1
    dia_vencimento: int = 10
    principal: bool = False


class CartaoOut(ORMBase):
    id: str
    nome: str
    banco: str
    bandeira: str
    limite_total: float
    dia_fechamento: int
    dia_vencimento: int
    principal: bool


# ---- Lancamento ----
class LancamentoCreate(BaseModel):
    tipo: str
    descricao: str
    valor: float
    data_competencia: date
    data_pagamento: date | None = None
    conta_id: str | None = None
    categoria_id: str | None = None
    cartao_id: str | None = None
    parcelas_total: int | None = None
    recorrencia: str | None = None
    status: str = "pendente"
    observacoes: str | None = None


class LancamentoOut(ORMBase):
    id: str
    tipo: str
    descricao: str
    valor: float
    data_competencia: date
    data_pagamento: date | None
    conta_id: str | None
    categoria_id: str | None
    cartao_id: str | None
    parcela_atual: int | None
    parcelas_total: int | None
    status: str
    observacoes: str | None
