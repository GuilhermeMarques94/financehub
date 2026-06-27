const VIEWS = {
  dashboard: "partials/dashboard.html",
  lancamentos: "partials/lancamentos.html",
  contas: "partials/contas.html",
  cartoes: "partials/cartoes.html",
  categorias: "partials/categorias.html",
};

const LOADERS = {
  dashboard: () => loadDashboard(),
  lancamentos: () => loadLancamentos(),
  contas: () => loadContas(),
  cartoes: () => loadCartoes(),
  categorias: () => loadCategorias(),
};

async function loadPartial(targetId, url) {
  const res = await fetch(url);
  document.getElementById(targetId).innerHTML = await res.text();
}

async function navTo(sec) {
  await loadPartial("view", VIEWS[sec]);
  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("active", b.dataset.sec === sec)
  );
  if (LOADERS[sec]) await LOADERS[sec]();
  if (window.innerWidth <= 768) closeSidebar();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

// Modal genérico
function openModal(html) {
  document.getElementById("modal-content").innerHTML = html;
  document.getElementById("modal").style.display = "flex";
}
function closeModal() {
  document.getElementById("modal").style.display = "none";
}
