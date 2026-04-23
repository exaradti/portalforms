import {
  requireAuth,
  getAccessToken,
  bindLogoutButtons,
  renderUserDisplayName,
  setupUserMenu
} from "/assets/supabase-auth.js";

const form = document.getElementById("formTrocaEquipamentos");
const tipoAtivo = document.getElementById("tipo_ativo");
const ipFields = document.querySelectorAll(".ip-field");
const modeloFields = document.querySelectorAll(".modelo-field");
const mensagem = document.getElementById("mensagemFormulario");
const btnLimpar = document.getElementById("btnLimpar");
const btnSubmit = form.querySelector("button[type='submit']");
const loading = document.getElementById("loadingAuth");
const content = document.getElementById("conteudoProtegido");

const ipAntigo = document.getElementById("ip_ativo_antigo");
const ipNovo = document.getElementById("ip_ativo_novo");
const modeloAntigo = document.getElementById("modelo_ativo_antigo");
const modeloNovo = document.getElementById("modelo_ativo_novo");
const nomeAntigo = document.getElementById("nome_ativo_antigo");
const nomeNovo = document.getElementById("nome_ativo_novo");
const labelNomeAntigo = document.getElementById("label_nome_ativo_antigo");
const labelNomeNovo = document.getElementById("label_nome_ativo_novo");

function tipoUsaIp(tipo) {
  return tipo === "Computador" || tipo === "Impressora";
}

function tipoUsaModelo(tipo) {
  return tipo === "Tablet";
}

function atualizarRotulosNome(tipo) {
  if (tipo === "Tablet") {
    labelNomeAntigo.textContent = "Nome do tablet antigo";
    labelNomeNovo.textContent = "Nome do tablet novo";
    nomeAntigo.placeholder = "Ex.: tablet-recepcao-01";
    nomeNovo.placeholder = "Ex.: tablet-recepcao-03";
    return;
  }

  if (tipo === "Computador") {
    labelNomeAntigo.textContent = "Nome do computador antigo";
    labelNomeNovo.textContent = "Nome do computador novo";
    nomeAntigo.placeholder = "Ex.: pc06";
    nomeNovo.placeholder = "Ex.: pc08";
    return;
  }

  if (tipo === "Impressora") {
    labelNomeAntigo.textContent = "Nome da impressora antiga";
    labelNomeNovo.textContent = "Nome da impressora nova";
    nomeAntigo.placeholder = "Ex.: impressora-financeiro-01";
    nomeNovo.placeholder = "Ex.: impressora-financeiro-02";
    return;
  }

  if (tipo === "Monitor") {
    labelNomeAntigo.textContent = "Nome do monitor antigo";
    labelNomeNovo.textContent = "Nome do monitor novo";
    nomeAntigo.placeholder = "Ex.: monitor-recepcao-01";
    nomeNovo.placeholder = "Ex.: monitor-recepcao-02";
    return;
  }

  labelNomeAntigo.textContent = "Nome do ativo antigo";
  labelNomeNovo.textContent = "Nome do ativo novo";
}

function atualizarCamposDinamicos() {
  const tipo = tipoAtivo.value;
  const mostrarIp = tipoUsaIp(tipo);
  const mostrarModelo = tipoUsaModelo(tipo);

  ipFields.forEach((field) => field.classList.toggle("is-hidden", !mostrarIp));
  modeloFields.forEach((field) => field.classList.toggle("is-hidden", !mostrarModelo));

  ipAntigo.required = mostrarIp;
  ipNovo.required = mostrarIp;
  modeloAntigo.required = mostrarModelo;
  modeloNovo.required = mostrarModelo;

  if (!mostrarIp) {
    ipAntigo.value = "";
    ipNovo.value = "";
  }

  if (!mostrarModelo) {
    modeloAntigo.value = "";
    modeloNovo.value = "";
  }

  atualizarRotulosNome(tipo);
}

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.classList.remove("form-message--success", "form-message--error");
  if (tipo) mensagem.classList.add(`form-message--${tipo}`);
}

function setLoading(ativo) {
  btnSubmit.disabled = ativo;
  btnLimpar.disabled = ativo;
  btnSubmit.textContent = ativo ? "Enviando..." : "Registrar troca";
}

tipoAtivo.addEventListener("change", atualizarCamposDinamicos);

btnLimpar.addEventListener("click", () => {
  form.reset();
  atualizarCamposDinamicos();
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
    tipo_ativo: tipoAtivo.value,
    nome_ativo_antigo: nomeAntigo.value.trim(),
    nome_ativo_novo: nomeNovo.value.trim(),
    ip_ativo_antigo: ipAntigo.value.trim(),
    ip_ativo_novo: ipNovo.value.trim(),
    modelo_ativo_antigo: modeloAntigo.value.trim(),
    modelo_ativo_novo: modeloNovo.value.trim(),
    setor: document.getElementById("setor").value.trim(),
    unidade: document.getElementById("unidade").value.trim(),
    motivo_troca: document.getElementById("motivo_troca").value.trim()
  };

  try {
    setLoading(true);
    mostrarMensagem("", "");

    const resposta = await fetch("/api/troca-equipamentos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(dados)
    });

    const resultado = await resposta.json().catch(() => ({ ok: false, message: "Resposta inválida do servidor." }));

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || "Erro ao registrar a troca.");
    }

    form.reset();
    atualizarCamposDinamicos();
    mostrarMensagem(resultado.message || "Troca registrada com sucesso.", "success");
  } catch (error) {
    mostrarMensagem(error.message || "Erro ao registrar a troca.", "error");
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
  atualizarCamposDinamicos();

  loading.hidden = true;
  content.hidden = false;
})();
