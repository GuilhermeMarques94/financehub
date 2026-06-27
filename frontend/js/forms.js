// Helper genérico de formulário em modal
// fields: [{name, label, type, value, options:[{value,label}], required}]
function formModal({ title, fields, submitLabel = "Salvar", onSubmit }) {
  const inputs = fields.map(f => {
    const req = f.required ? "required" : "";
    if (f.type === "select") {
      const opts = (f.options || []).map(o =>
        `<option value="${o.value}" ${String(o.value) === String(f.value) ? "selected" : ""}>${o.label}</option>`
      ).join("");
      return `<label>${f.label}
        <select name="${f.name}" ${req}>${opts}</select></label>`;
    }
    if (f.type === "checkbox") {
      return `<label class="check">
        <input type="checkbox" name="${f.name}" ${f.value ? "checked" : ""} /> ${f.label}</label>`;
    }
    return `<label>${f.label}
      <input type="${f.type || "text"}" name="${f.name}"
             value="${f.value ?? ""}" ${req} step="any" /></label>`;
  }).join("");

  openModal(`
    <div class="modal-head">
      <h3>${title}</h3>
      <button class="modal-x" onclick="closeModal()">✕</button>
    </div>
    <form id="modal-form" class="modal-form">
      ${inputs}
      <div class="modal-actions">
        <button type="button" class="ghost" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="primary">${submitLabel}</button>
      </div>
    </form>
  `);

  document.getElementById("modal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    fields.forEach(f => {
      if (f.type === "checkbox") data[f.name] = fd.get(f.name) === "on";
      else if (f.type === "number") {
        const v = fd.get(f.name);
        data[f.name] = v === "" ? null : parseFloat(v);
      } else {
        const v = fd.get(f.name);
        data[f.name] = v === "" ? null : v;
      }
    });
    try {
      await onSubmit(data);
      closeModal();
    } catch (err) {
      alert(err.message || "Erro ao salvar");
    }
  });
}

// Busca opções de categorias e contas (cacheia por chamada)
async function getCategoriaOptions(tipo) {
  const cats = await request("/api/categorias");
  return cats
    .filter(c => !tipo || c.tipo === tipo)
    .map(c => ({ value: c.id, label: c.nome }));
}
async function getContaOptions() {
  const contas = await request("/api/contas");
  return contas.map(c => ({ value: c.id, label: c.instituicao }));
}
async function getCartaoOptions() {
  const cartoes = await request("/api/cartoes");
  return cartoes.map(c => ({ value: c.id, label: c.nome }));
}
