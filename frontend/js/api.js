const API = "https://financehub-3kq3.onrender.com"; // sua URL do Render

function getToken() { return localStorage.getItem("token"); }

// Requisição genérica em JSON (para contas, lançamentos, dashboard, etc.)
async function request(path, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erro na requisição");
  }
  return res.json();
}

// LOGIN — usa x-www-form-urlencoded (padrão OAuth2 do FastAPI)
async function login(email, senha) {
  const form = new URLSearchParams();
  form.append("username", email);   // OAuth2 chama de "username", mas é o e-mail
  form.append("password", senha);

  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Credenciais inválidas");
  }

  const data = await res.json();
  localStorage.setItem("token", data.access_token); // salva o token
  return data;
}

// REGISTER — usa JSON (nome, email, senha)
async function register(nome, email, senha) {
  const data = await request("/api/auth/register", "POST", { nome, email, senha });
  if (data.access_token) localStorage.setItem("token", data.access_token);
  return data;
}

// Logout simples
function logout() {
  localStorage.removeItem("token");
}
