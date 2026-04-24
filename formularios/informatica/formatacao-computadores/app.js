import {
  requireAuth,
  getAccessToken,
  bindLogoutButtons,
  renderUserDisplayName,
  setupUserMenu
} from "/assets/supabase-auth.js";

const form = document.getElementById("formFormatacaoComputadores");
const mensagem = document.getElementById("mensagemFormulario");
const btnLimpar = document.getElementById("btnLimpar");
const btnSubmit = form.querySelector("button[type='submit']");
const loading = document.getElementById("loadingAuth");
const content = document.getElementById("conteudoProtegido");
const unidadeSelect = document.getElementById("unidade");
const programasCheckboxes = Array.from(document.querySelectorAll("input[name='programas_instalados']"));

function carregarUnidades() {
  const unidades = [
    "Examina Filial",
    "Examina Matriz",
    "Radiologica General Osório",
    "Radiologica Olaria",
    "Unimed",
    "CD"
  ];

  unidadeSelect.innerHTML = '<option value="">Selecione</option>';
  unidadeSelect.disabled = false;

  unidades.forEach((unidade) => {
    const option = document.createElement("option");
    option.value = unidade;
    option.textContent = unidade;
    unidadeSelect.appendChild(option);
  });
}

function getProgramasInstalados() {
  return programasCheckboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.classList.remove("form-message--success", "form-message--error");
  if (tipo) mensagem.classList.add(`form-message--${tipo}`);
}

function setLoading(ativo) {
  btnSubmit.disabled = ativo;
  btnLimpar.disabled = ativo;
  btnSubmit.textContent = ativo ? "Enviando..." : "Registrar formatação";
}

btnLimpar.addEventListener("click", () => {
  form.reset();
  mostrarMensagem("", "");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    mostrarMensagem("Revise os campos obrigatórios antes de continuar.", "error");
    return;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    window.location.href = `/formularios/informatica/login/index.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  const dados = {
    nome_computador: document.getElementById("nome_computador").value.trim(),
    ip_computador: document.getElementById("ip_computador").value.trim(),
    programas_instalados: getProgramasInstalados(),
    setor: document.getElementById("setor").value.trim(),
    unidade: unidadeSelect.value.trim(),
    motivo_formatacao: document.getElementById("motivo_formatacao").value.trim()
  };

  try {
    setLoading(true);
    mostrarMensagem("", "");

    const resposta = await fetch("/api/formatacao-computadores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(dados)
    });

    const resultado = await resposta.json().catch(() => ({ ok: false, message: "Resposta inválida do servidor." }));

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || "Erro ao registrar a formatação.");
    }

    form.reset();
    mostrarMensagem(resultado.message || "Formatação registrada com sucesso.", "success");
  } catch (error) {
    mostrarMensagem(error.message || "Erro ao registrar a formatação.", "error");
  } finally {
    setLoading(false);
  }
});

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  renderUserDisplayName("#authUserName", session);
  setupUserMenu();
  bindLogoutButtons();
  carregarUnidades();

  loading.hidden = true;
  content.hidden = false;
})().catch((error) => {
  mostrarMensagem(error.message || "Erro ao carregar formulário.", "error");
  loading.hidden = true;
  content.hidden = false;
});
