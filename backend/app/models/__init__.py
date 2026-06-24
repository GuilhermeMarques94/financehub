import uuid
from datetime import datetime, date
from sqlalchemy import (
    String, Float, Boolean, DateTime, Date, ForeignKey, Integer, Text, Enum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


def uid():
    return str(uuid.uuid4())


class StatusLancamento(str, enum.Enum):
    pago = "pago"
    pendente = "pendente"
    cancelado = "cancelado"


class TipoLancamento(str, enum.Enum):
    receita = "receita"
    despesa = "despesa"


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Conta(Base):
    __tablename__ = "contas"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    instituicao: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str] = mapped_column(String(50))  # corrente, poupanca, carteira...
    saldo_inicial: Mapped[float] = mapped_column(Float, default=0)
    saldo_atual: Mapped[float] = mapped_column(Float, default=0)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class Categoria(Base):
    __tablename__ = "categorias"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    nome: Mapped[str] = mapped_column(String(100))
    tipo: Mapped[str] = mapped_column(String(20))  # receita/despesa
    grupo: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cor: Mapped[str] = mapped_column(String(20), default="#6366f1")
    icone: Mapped[str] = mapped_column(String(40), default="tag")
    parent_id: Mapped[str | None] = mapped_column(
        ForeignKey("categorias.id"), nullable=True
    )


class Cartao(Base):
    __tablename__ = "cartoes"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    nome: Mapped[str] = mapped_column(String(100))
    banco: Mapped[str] = mapped_column(String(100))
    bandeira: Mapped[str] = mapped_column(String(40))
    limite_total: Mapped[float] = mapped_column(Float, default=0)
    dia_fechamento: Mapped[int] = mapped_column(Integer, default=1)
    dia_vencimento: Mapped[int] = mapped_column(Integer, default=10)
    principal: Mapped[bool] = mapped_column(Boolean, default=False)


class Fatura(Base):
    __tablename__ = "faturas"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    cartao_id: Mapped[str] = mapped_column(ForeignKey("cartoes.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    mes: Mapped[int] = mapped_column(Integer)
    ano: Mapped[int] = mapped_column(Integer)
    valor_total: Mapped[float] = mapped_column(Float, default=0)
    valor_pago: Mapped[float] = mapped_column(Float, default=0)
    fechada: Mapped[bool] = mapped_column(Boolean, default=False)


class Lancamento(Base):
    __tablename__ = "lancamentos"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    tipo: Mapped[str] = mapped_column(String(20))
    descricao: Mapped[str] = mapped_column(String(200))
    valor: Mapped[float] = mapped_column(Float)
    data_competencia: Mapped[date] = mapped_column(Date)
    data_pagamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    conta_id: Mapped[str | None] = mapped_column(ForeignKey("contas.id"), nullable=True)
    categoria_id: Mapped[str | None] = mapped_column(
        ForeignKey("categorias.id"), nullable=True
    )
    cartao_id: Mapped[str | None] = mapped_column(ForeignKey("cartoes.id"), nullable=True)
    fatura_id: Mapped[str | None] = mapped_column(ForeignKey("faturas.id"), nullable=True)
    parcela_atual: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parcelas_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recorrencia: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pendente")
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
