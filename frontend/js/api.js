const API = "https://financehub-3kq3.onrender.com"; // sua URL do Render

function getToken() { return localStorage.getItem("token"); }

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
