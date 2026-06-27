let registerMode = false;
let chart = null;

const fmt = v => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const meses = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
               "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatDate = d => {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
};
// ---------- AUTH ----------
async function bootAuth() {
  document.getElementById("app").style.display = "none";
  const c = document.getElementById("auth-container");
  c.style.display = "flex";
  await loadPartial("auth-container", "partials/auth.html");
}

function toggleRegister() {
  registerMode = !registerMode;
  document.getElementById("nome").style.display = registerMode ? "block" : "none";
}

async function login() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  const nome = document.getElementById("nome").value;
  const msg = document.getElementById("msg");

  try {
    let data;
    if (registerMode) {
      data = await request("/api/auth/register", "POST", { nome, email, senha });
    } else {
      const body = new URLSearchParams({ username: email, password: senha });
      const res = await fetch(`${API}/api/auth/login`, { method: "POST", body });
      if (!res.ok) throw new Error("Credenciais inválidas");
      data = await res.json();
    }
    localStorage.setItem("token", data.access_token);
    initApp();
  } catch (e) {
    if (msg) msg.textContent = e.message;
  }
}

function logout() {
  localStorage.removeItem("token");
  bootAuth();
}

async function initApp() {
  const c = document.getElementById("auth-container");
  c.innerHTML = "";
  c.style.display = "none";
  document.getElementById("app").style.display = "block";
  await navTo("dashboard");
}

// ---------- DASHBOARD ----------
async function loadDashboard() {
  const d = await request("/api/dashboard");
  document.getElementById("m-saldo").textContent = fmt(d.saldo_consolidado);
  document.getElementById("m-rec").textContent = fmt(d.total_receitas);
  document.getElementById("m-desp").textContent = fmt(d.total_despesas);
  document.getElementById("m-fluxo").textContent = fmt(d.fluxo_caixa);

  const ctx = document.getElementById("chartCat");
  if (!ctx) return;
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: d.despesas_por_categoria.map(c => c.categoria),
      datasets: [{
        data: d.despesas_por_categoria.map(c => c.valor),
        backgroundColor: d.despesas_por_categoria.map(c => c.cor),
      }],
    },
    options: { plugins: { legend: { labels: { color: "#e2e8f0" } } } },
  });
}

// ---------- CONTAS ----------
async function loadContas() {
  const contas = await request("/api/contas");
  document.getElementById("lista-contas").innerHTML = contas.map(c => `
    <div class="card">
      <h3>${c.instituicao}</h3>
      <p style="color:#94a3b8">${c.tipo}</p>
      <h2>${fmt(c.saldo_atual)}</h2>
      <button class="ghost" onclick="delConta('${c.id}')">Excluir</button>
    </div>`).join("") || "<p>Nenhuma conta cadastrada.</p>";
}

function novaConta() {
  formModal({
    title: "Nova Conta",
    fields: [
      { name: "instituicao", label: "Instituição", required: true },
      { name: "tipo", label: "Tipo", type: "select", value: "corrente",
        options: [
          { value: "corrente", label: "Corrente" },
          { value: "poupanca", label: "Poupança" },
          { value: "carteira", label: "Carteira" },
          { value: "investimento", label: "Investimento" },
        ] },
      { name: "saldo_inicial", label: "Saldo inicial", type: "number", value: 0 },
    ],
    onSubmit: async (data) => {
      await request("/api/contas", "POST", data);
      loadContas();
    },
  });
}

async function delConta(id) {
  if (confirm("Excluir conta?")) {
    await request(`/api/contas/${id}`, "DELETE");
    loadContas();
  }
}

// ---------- LANÇAMENTOS ----------
// ---------- LANÇAMENTOS ----------
let _lancamentos = [];
let _categoriasMap = {};
let _sort = { campo: "data_competencia", dir: -1 }; // -1 desc, 1 asc

async function loadLancamentos() {
  const [list, cats] = await Promise.all([
    request("/api/lancamentos"),
    request("/api/categorias"),
  ]);
  _lancamentos = list;
  _categoriasMap = Object.fromEntries(cats.map(c => [c.id, c]));

  // popula filtro de categorias
  const fcat = document.getElementById("f-categoria");
  if (fcat) {
    fcat.innerHTML = `<option value="">Todas categorias</option>` +
      cats.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
  }
  aplicarFiltros();
}

function getFiltrados() {
  const busca = (document.getElementById("f-busca")?.value || "").toLowerCase();
  const tipo = document.getElementById("f-tipo")?.value || "";
  const cat = document.getElementById("f-categoria")?.value || "";
  const status = document.getElementById("f-status")?.value || "";
  const ini = document.getElementById("f-ini")?.value || "";
  const fim = document.getElementById("f-fim")?.value || "";

  let res = _lancamentos.filter(l => {
    if (busca && !l.descricao.toLowerCase().includes(busca)) return false;
    if (tipo && l.tipo !== tipo) return false;
    if (cat && String(l.categoria_id) !== cat) return false;
    if (status && l.status !== status) return false;
    if (ini && l.data_competencia < ini) return false;
    if (fim && l.data_competencia > fim) return false;
    return true;
  });

  const { campo, dir } = _sort;
  res.sort((a, b) => {
    let va = a[campo], vb = b[campo];
    if (campo === "valor") { va = +va; vb = +vb; }
    else { va = String(va ?? ""); vb = String(vb ?? ""); }
    return va < vb ? -dir : va > vb ? dir : 0;
  });
  return res;
}

function aplicarFiltros() {
  const list = getFiltrados();

  // totalizadores
  let rec = 0, desp = 0;
  list.forEach(l => l.tipo === "receita" ? rec += +l.valor : desp += +l.valor);
  document.getElementById("t-rec").textContent = fmt(rec);
  document.getElementById("t-desp").textContent = fmt(desp);
  const saldoEl = document.getElementById("t-saldo");
  saldoEl.textContent = fmt(rec - desp);
  saldoEl.className = (rec - desp) >= 0 ? "green" : "red";
  document.getElementById("t-count").textContent = list.length;

  // tabela
  document.querySelector("#tabela-lanc tbody").innerHTML = list.map(l => {
    const cat = _categoriasMap[l.categoria_id];
    return `
    <tr>
      <td>${formatDate(l.data_competencia)}</td>
      <td>${l.descricao}</td>
      <td>${cat
        ? `<span class="tag" style="background:${cat.cor}22;color:${cat.cor}">${cat.nome}</span>`
        : '<span class="tag muted">—</span>'}</td>
      <td>${l.tipo}</td>
      <td class="${l.tipo === 'receita' ? 'green' : 'red'}">${fmt(l.valor)}</td>
      <td><span class="badge ${l.status === 'pago' ? 'paga' : 'aberta'}">${l.status}</span></td>
      <td>
        <button class="ghost" onclick="editarLancamento('${l.id}')">✏️</button>
        <button class="ghost" onclick="delLancamento('${l.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" style="text-align:center;color:#64748b">Nenhum lançamento encontrado.</td></tr>`;
}

function ordenar(campo) {
  if (_sort.campo === campo) _sort.dir *= -1;
  else _sort = { campo, dir: 1 };
  aplicarFiltros();
}

function limparFiltros() {
  ["f-busca", "f-tipo", "f-categoria", "f-status", "f-ini", "f-fim"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  aplicarFiltros();
}

async function delLancamento(id) {
  if (confirm("Excluir lançamento?")) {
    await request(`/api/lancamentos/${id}`, "DELETE");
    loadLancamentos();
  }
}


// ---------- CARTÕES ----------
function pctClass(p) { return p < 50 ? "pct-ok" : p < 80 ? "pct-warn" : "pct-danger"; }

async function loadCartoes() {
  const cartoes = await request("/api/cartoes");
  const pf = document.getElementById("painel-faturas");
  const pd = document.getElementById("painel-detalhe");
  if (pf) pf.style.display = "none";
  if (pd) pd.style.display = "none";

  document.getElementById("lista-cartoes").innerHTML = cartoes.map(c => `
    <div class="credit-card" onclick="loadFaturas('${c.id}', '${c.nome.replace(/'/g, "")}')">
      <span class="bandeira">${c.bandeira} ${c.principal ? "⭐" : ""}</span>
      <div>
        <strong>${c.nome}</strong>
        <p style="font-size:12px;opacity:.8">${c.banco}</p>
      </div>
      <div>
        <div class="saldo-limite">Usado: ${fmt(c.limite_usado)} de ${fmt(c.limite_total)}</div>
        <div class="progress">
          <div class="progress-bar ${pctClass(c.percentual_comprometido)}"
               style="width:${Math.min(c.percentual_comprometido, 100)}%"></div>
        </div>
        <div class="saldo-limite">
          Disponível: ${fmt(c.limite_disponivel)} • ${c.percentual_comprometido}% comprometido
        </div>
      </div>
    </div>`).join("") || "<p>Nenhum cartão cadastrado.</p>";
}

function novoCartao() {
  formModal({
    title: "Novo Cartão",
    fields: [
      { name: "nome", label: "Nome do cartão", required: true },
      { name: "banco", label: "Banco emissor" },
      { name: "bandeira", label: "Bandeira", type: "select", value: "Mastercard",
        options: [
          { value: "Mastercard", label: "Mastercard" },
          { value: "Visa", label: "Visa" },
          { value: "Elo", label: "Elo" },
          { value: "Amex", label: "Amex" },
        ] },
      { name: "limite_total", label: "Limite total", type: "number", value: 0 },
      { name: "dia_fechamento", label: "Dia de fechamento", type: "number", value: 1 },
      { name: "dia_vencimento", label: "Dia de vencimento", type: "number", value: 10 },
      { name: "principal", label: "É o cartão principal?", type: "checkbox", value: false },
    ],
    onSubmit: async (data) => {
      await request("/api/cartoes", "POST", data);
      loadCartoes();
    },
  });
}

async function loadFaturas(cartaoId, nome) {
  const faturas = await request(`/api/cartoes/${cartaoId}/faturas`);
  document.getElementById("painel-detalhe").style.display = "none";
  const painel = document.getElementById("painel-faturas");
  painel.style.display = "block";
  document.getElementById("faturas-titulo").textContent = `Faturas — ${nome}`;

  document.getElementById("lista-faturas").innerHTML = faturas.map(f => `
    <div class="fatura-row" onclick="loadDetalheFatura('${f.id}', '${meses[f.mes]}/${f.ano}')">
      <div>
        <strong>${meses[f.mes]}/${f.ano}</strong>
        <p style="font-size:12px;color:#94a3b8">
          Total: ${fmt(f.valor_total)} • Pago: ${fmt(f.valor_pago)} • Pendente: ${fmt(f.valor_pendente)}
        </p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge ${f.fechada ? 'paga' : 'aberta'}">${f.fechada ? 'Paga' : 'Aberta'}</span>
        ${f.valor_pendente > 0
          ? `<button onclick="event.stopPropagation(); pagarFatura('${f.id}', ${f.valor_pendente})">Pagar</button>`
          : ''}
      </div>
    </div>`).join("") || "<p>Nenhuma fatura gerada ainda.</p>";
}

async function loadDetalheFatura(faturaId, titulo) {
  const f = await request(`/api/cartoes/faturas/${faturaId}`);
  const painel = document.getElementById("painel-detalhe");
  painel.style.display = "block";
  document.getElementById("detalhe-titulo").textContent =
    `Itens da fatura ${titulo} — Total ${fmt(f.valor_total)}`;
  document.getElementById("detalhe-itens").innerHTML = f.itens.map(i => `
    <tr>
      <td>${i.data_competencia}</td>
      <td>${i.descricao}</td>
      <td>${i.parcelas_total ? `${i.parcela_atual}/${i.parcelas_total}` : '-'}</td>
      <td class="red">${fmt(i.valor)}</td>
    </tr>`).join("");
  painel.scrollIntoView({ behavior: "smooth" });
}

async function pagarFatura(faturaId, pendente) {
  const contas = await request("/api/contas");
  formModal({
    title: "Pagar Fatura",
    submitLabel: "Pagar",
    fields: [
      { name: "valor", label: "Valor a pagar", type: "number", value: pendente, required: true },
      { name: "conta_id", label: "Debitar da conta", type: "select", value: "",
        options: [{ value: "", label: "— Nenhuma —" },
          ...contas.map(c => ({ value: c.id, label: c.instituicao }))] },
    ],
    onSubmit: async (data) => {
      await request(`/api/cartoes/faturas/${faturaId}/pagar`, "POST", data);
      loadCartoes();
    },
  });
}


// ---------- CATEGORIAS (Plano de Contas) ----------
async function loadCategorias() {
  const cats = await request("/api/categorias");
  document.getElementById("lista-categorias").innerHTML = cats.map(c => `
    <div class="card" style="border-left:4px solid ${c.cor}">
      <h3>${c.nome}</h3>
      <p style="color:#94a3b8">${c.tipo}${c.grupo ? ` • ${c.grupo}` : ''}</p>
      <button class="ghost" onclick="delCategoria('${c.id}')">Excluir</button>
    </div>`).join("") || "<p>Nenhuma categoria cadastrada.</p>";
}

function novaCategoria() {
  formModal({
    title: "Nova Categoria",
    fields: [
      { name: "nome", label: "Nome", required: true },
      { name: "tipo", label: "Tipo", type: "select", value: "despesa",
        options: [
          { value: "despesa", label: "Despesa" },
          { value: "receita", label: "Receita" },
        ] },
      { name: "grupo", label: "Grupo (opcional)" },
      { name: "cor", label: "Cor", type: "color", value: "#6366f1" },
    ],
    onSubmit: async (data) => {
      await request("/api/categorias", "POST", data);
      loadCategorias();
    },
  });
}

async function delCategoria(id) {
  if (confirm("Excluir categoria?")) {
    await request(`/api/categorias/${id}`, "DELETE");
    loadCategorias();
  }
}

// ---------- BOOT ----------
window.addEventListener("DOMContentLoaded", () => {
  if (getToken()) initApp();
  else bootAuth();
});

async function editarLancamento(id) {
  const [l, cats, contas, cartoes] = await Promise.all([
    request(`/api/lancamentos/${id}`),
    request("/api/categorias"), request("/api/contas"), request("/api/cartoes"),
  ]);

  formModal({
    title: "Editar Lançamento",
    submitLabel: "Atualizar",
    fields: [
      { name: "tipo", label: "Tipo", type: "select", value: l.tipo,
        options: [
          { value: "despesa", label: "Despesa" },
          { value: "receita", label: "Receita" },
        ] },
      { name: "descricao", label: "Descrição", value: l.descricao, required: true },
      { name: "valor", label: "Valor", type: "number", value: l.valor, required: true },
      { name: "data_competencia", label: "Data competência", type: "date", value: l.data_competencia, required: true },
      { name: "data_pagamento", label: "Data pagamento", type: "date", value: l.data_pagamento || "" },
      { name: "categoria_id", label: "Categoria", type: "select", value: l.categoria_id || "",
        options: [{ value: "", label: "— Sem categoria —" },
          ...cats.map(c => ({ value: c.id, label: `${c.nome} (${c.tipo})` }))] },
      { name: "conta_id", label: "Conta", type: "select", value: l.conta_id || "",
        options: [{ value: "", label: "— Sem conta —" },
          ...contas.map(c => ({ value: c.id, label: c.instituicao }))] },
      { name: "cartao_id", label: "Cartão", type: "select", value: l.cartao_id || "",
        options: [{ value: "", label: "— Sem cartão —" },
          ...cartoes.map(c => ({ value: c.id, label: c.nome }))] },
      { name: "status", label: "Status", type: "select", value: l.status,
        options: [
          { value: "pago", label: "Pago" },
          { value: "pendente", label: "Pendente" },
        ] },
      { name: "observacoes", label: "Observações", value: l.observacoes || "" },
    ],
    onSubmit: async (data) => {
      await request(`/api/lancamentos/${id}`, "PUT", data);
      loadLancamentos();
    },
  });
}