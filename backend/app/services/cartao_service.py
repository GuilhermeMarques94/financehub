from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Cartao, Fatura, Lancamento, Conta


class CartaoService:
    def __init__(self, db: Session, user_id: str):
        self.db = db
        self.user_id = user_id

    # ---------- Consolidação de limite ----------
    def calcular_consolidacao(self, cartao: Cartao) -> dict:
        """Soma faturas em aberto (não pagas integralmente) para limite usado."""
        usado = self.db.query(
            func.coalesce(func.sum(Fatura.valor_total - Fatura.valor_pago), 0)
        ).filter(
            Fatura.cartao_id == cartao.id,
            Fatura.user_id == self.user_id,
        ).scalar() or 0

        usado = max(0, round(usado, 2))
        disponivel = round(cartao.limite_total - usado, 2)
        pct = round((usado / cartao.limite_total * 100), 1) if cartao.limite_total else 0
        return {
            "limite_usado": usado,
            "limite_disponivel": disponivel,
            "percentual_comprometido": pct,
        }

    def listar_cartoes(self) -> list[dict]:
        cartoes = self.db.query(Cartao).filter(Cartao.user_id == self.user_id).all()
        result = []
        for c in cartoes:
            data = {
                "id": c.id, "nome": c.nome, "banco": c.banco, "bandeira": c.bandeira,
                "limite_total": c.limite_total, "dia_fechamento": c.dia_fechamento,
                "dia_vencimento": c.dia_vencimento, "principal": c.principal,
                **self.calcular_consolidacao(c),
            }
            result.append(data)
        return result

    # ---------- Faturas ----------
    def listar_faturas(self, cartao_id: str) -> list[dict]:
        faturas = self.db.query(Fatura).filter(
            Fatura.cartao_id == cartao_id, Fatura.user_id == self.user_id
        ).order_by(Fatura.ano.desc(), Fatura.mes.desc()).all()
        return [self._fatura_dict(f) for f in faturas]

    def detalhe_fatura(self, fatura_id: str) -> dict | None:
        f = self.db.query(Fatura).filter(
            Fatura.id == fatura_id, Fatura.user_id == self.user_id
        ).first()
        if not f:
            return None
        itens = self.db.query(Lancamento).filter(
            Lancamento.fatura_id == f.id
        ).order_by(Lancamento.data_competencia).all()
        d = self._fatura_dict(f)
        d["itens"] = [
            {
                "id": i.id, "descricao": i.descricao, "valor": i.valor,
                "data_competencia": i.data_competencia, "categoria_id": i.categoria_id,
                "parcela_atual": i.parcela_atual, "parcelas_total": i.parcelas_total,
                "status": i.status,
            } for i in itens
        ]
        return d

    def pagar_fatura(self, fatura_id: str, valor: float, conta_id: str | None) -> dict:
        f = self.db.query(Fatura).filter(
            Fatura.id == fatura_id, Fatura.user_id == self.user_id
        ).first()
        if not f:
            raise ValueError("Fatura não encontrada")

        f.valor_pago = round(f.valor_pago + valor, 2)
        if f.valor_pago >= f.valor_total:
            f.fechada = True
            # marca itens como pagos
            self.db.query(Lancamento).filter(Lancamento.fatura_id == f.id).update(
                {Lancamento.status: "pago", Lancamento.data_pagamento: date.today()}
            )

        # debita da conta escolhida
        if conta_id:
            conta = self.db.query(Conta).filter(
                Conta.id == conta_id, Conta.user_id == self.user_id
            ).first()
            if conta:
                conta.saldo_atual = round(conta.saldo_atual - valor, 2)

        self.db.commit()
        self.db.refresh(f)
        return self._fatura_dict(f)

    def _fatura_dict(self, f: Fatura) -> dict:
        return {
            "id": f.id, "cartao_id": f.cartao_id, "mes": f.mes, "ano": f.ano,
            "valor_total": round(f.valor_total, 2),
            "valor_pago": round(f.valor_pago, 2),
            "valor_pendente": round(f.valor_total - f.valor_pago, 2),
            "fechada": f.fechada,
        }
