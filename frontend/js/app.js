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
