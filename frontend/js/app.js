let registerMode = false;
let chart = null;

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
      // login usa form-urlencoded (OAuth2)
      const body = new URLSearchParams({ username: email, password: senha });
      const res = await fetch(`${API}/api/auth/login`, { method: "POST", body });
      if (!res.ok) throw new Error("Credenciais inválidas");
      data = await res.json();
    }
    localStorage.setItem("token", data.access_token);
    initApp();
  } catch (e) {
    msg.textContent = e.message;
  }
}

function logout() {
  localStorage.removeItem("token");
  location.reload();
}

function show(sec) {
  ["dashboard", "contas", "lancamentos"].forEach(s =>
    document.getElementById(s).style.display = s === sec ? "block" : "none"
  );
  if (sec === "contas") loadContas();
  if (sec === "lancamentos") loadLancamentos();
  if (sec === "dashboard") loadDashboard();
}

const fmt = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function loadDashboard() {
  const d = await request("/api/dashboard");
  document.getElementById("m-saldo").textContent = fmt(d.saldo_consolidado);
  document.getElementById("m-rec").textContent = fmt(d.total_receitas);
  document.getElementById("m-desp").textContent = fmt(d.total_despesas);
  document.getElementById("m-fluxo").textContent = fmt(d.fluxo_caixa);

  const ctx = document.getElementById("chartCat");
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

async function loadContas() {
  const contas = await request("/api/contas");
  document.getElementById("lista-contas").innerHTML = contas.map(c => `
    <div class="card">
      <h3>${c.instituicao}</h3>
      <p style="color:#94a3b8">${c.tipo}</p>
      <h2>${fmt(c.saldo_atual)}</h2>
      <button class="ghost" onclick="delConta('${c.id}')">Excluir</button>
    </div>`).join("");
}

async function novaConta() {
  const instituicao = prompt("Nome da instituição:");
  if (!instituicao) return;
  const tipo = prompt("Tipo (corrente/poupanca/carteira):") || "corrente";
  const saldo = parseFloat(prompt("Saldo inicial:") || "0");
  await request("/api/contas", "POST", { instituicao, tipo, saldo_inicial: saldo });
  loadContas();
}

async function delConta(id) {
  if (confirm("Excluir conta?")) { await request(`/api/contas/${id}`, "DELETE"); loadContas(); }
}

async function loadLancamentos() {
  const list = await request("/api/lancamentos");
  document.querySelector("#tabela-lanc tbody").innerHTML = list.map(l => `
    <tr>
      <td>${l.data_competencia}</td>
      <td>${l.descricao}</td>
      <td>${l.tipo}</td>
      <td class="${l.tipo === 'receita' ? 'green' : 'red'}">${fmt(l.valor)}</td>
      <td>${l.status}</td>
    </tr>`).join("");
}

async function novoLancamento() {
  const tipo = prompt("Tipo (receita/despesa):") || "despesa";
  const descricao = prompt("Descrição:");
  if (!descricao) return;
  const valor = parseFloat(prompt("Valor:") || "0");
  const data_competencia = new Date().toISOString().split("T")[0];
  await request("/api/lancamentos", "POST", { tipo, descricao, valor, data_competencia, status: "pago" });
  loadLancamentos();
}

function initApp() {
  document.getElementById("auth").style.display = "none";
  document.getElementById("app").style.display = "flex";
  show("dashboard");
}

// Auto-login se houver token
if (getToken()) initApp();

// Atualize a lista de seções
function show(sec) {
  ["dashboard", "contas", "lancamentos", "cartoes"].forEach(s =>
    document.getElementById(s).style.display = s === sec ? "block" : "none"
  );
  if (sec === "contas") loadContas();
  if (sec === "lancamentos") loadLancamentos();
  if (sec === "dashboard") loadDashboard();
  if (sec === "cartoes") loadCartoes();
}

// ---------- CARTÕES ----------
function pctClass(p) { return p < 50 ? "pct-ok" : p < 80 ? "pct-warn" : "pct-danger"; }

async function loadCartoes() {
  const cartoes = await request("/api/cartoes");
  document.getElementById("painel-faturas").style.display = "none";
  document.getElementById("painel-detalhe").style.display = "none";

  document.getElementById("lista-cartoes").innerHTML = cartoes.map(c => `
    <div class="credit-card" onclick="loadFaturas('${c.id}', '${c.nome.replace(/'/g, "")}')">
      <span class="bandeira">${c.bandeira} ${c.principal ? "⭐" : ""}</span>
      <div>
        <strong>${c.nome}</strong>
        <p style="font-size:12px;opacity:.8">${c.banco}</p>
      </div>
      <div>
        <div class="saldo-limite">
          Usado: ${fmt(c.limite_usado)} de ${fmt(c.limite_total)}
        </div>
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

async function novoCartao() {
  const nome = prompt("Nome do cartão:");
  if (!nome) return;
  const banco = prompt("Banco emissor:") || "";
  const bandeira = prompt("Bandeira (Visa/Mastercard/Elo):") || "Mastercard";
  const limite_total = parseFloat(prompt("Limite total:") || "0");
  const dia_fechamento = parseInt(prompt("Dia de fechamento (1-31):") || "1");
  const dia_vencimento = parseInt(prompt("Dia de vencimento (1-31):") || "10");
  const principal = confirm("É o cartão principal?");
  await request("/api/cartoes", "POST", {
    nome, banco, bandeira, limite_total, dia_fechamento, dia_vencimento, principal
  });
  loadCartoes();
}

const meses = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
               "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
  const valor = parseFloat(prompt(`Valor a pagar (pendente: ${fmt(pendente)}):`, pendente) || "0");
  if (!valor || valor <= 0) return;
  // opcional: escolher conta de débito
  const contas = await request("/api/contas");
  let contaId = null;
  if (contas.length) {
    const lista = contas.map((c, idx) => `${idx + 1}) ${c.instituicao}`).join("\n");
    const escolha = parseInt(prompt(`Debitar de qual conta?\n${lista}\n(0 = nenhuma)`) || "0");
    if (escolha > 0 && contas[escolha - 1]) contaId = contas[escolha - 1].id;
  }
  await request(`/api/cartoes/faturas/${faturaId}/pagar`, "POST", { valor, conta_id: contaId });
  alert("Pagamento registrado!");
  loadCartoes();
}
