from datetime import date
from pydantic import BaseModel, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- Cartão ----
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
    # Campos calculados (consolidação)
    limite_usado: float = 0
    limite_disponivel: float = 0
    percentual_comprometido: float = 0


# ---- Fatura ----
class FaturaItem(ORMBase):
    id: str
    descricao: str
    valor: float
    data_competencia: date
    categoria_id: str | None
    parcela_atual: int | None
    parcelas_total: int | None
    status: str


class FaturaOut(ORMBase):
    id: str
    cartao_id: str
    mes: int
    ano: int
    valor_total: float
    valor_pago: float
    valor_pendente: float = 0
    fechada: bool


class FaturaDetalhe(FaturaOut):
    itens: list[FaturaItem] = []


class PagarFatura(BaseModel):
    valor: float
    conta_id: str | None = None  # conta de onde sai o pagamento
