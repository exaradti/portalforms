import {
  requireAuth,
  getAccessToken,
  bindLogoutButtons,
  renderUserDisplayName,
  setupUserMenu
} from "/assets/supabase-auth.js";

const form = document.getElementById("formInstalacaoEquipamentos");
const tipoAtivo = document.getElementById("tipo_ativo");
const ipFields = document.querySelectorAll(".ip-field");
const modeloFields = document.querySelectorAll(".modelo-field");
const programasField = document.querySelector(".programas-field");
const programasCheckboxes = Array.from(document.querySelectorAll("input[name='programas_instalados']"));
const mensagem = document.getElementById("mensagemFormulario");
const btnLimpar = document.getElementById("btnLimpar");
const btnSubmit = form.querySelector("button[type='submit']");
const loading = document.getElementById("loadingAuth");
const content = document.getElementById("conteudoProtegido");
const unidadeSelect = document.getElementById("unidade");

const ipNovo = document.getElementById("ip_ativo_novo");
const modeloNovo = document.getElementById("modelo_ativo_novo");
const nomeNovo = document.getElementById("nome_ativo_novo");
const labelNomeNovo = document.getElementById("label_nome_ativo_novo");

function tipoUsaIp(tipo) {
  return tipo === "Computador" || tipo === "Impressora";
}

function tipoUsaModelo(tipo) {
  return tipo === "Tablet";
}

function atualizarRotulosNome(tipo) {
  if (tipo === "Tablet") {
    labelNomeNovo.textContent = "Nome do tablet novo";
    nomeNovo.placeholder = "Ex.: tablet-recepcao-03";
    return;
  }

  if (tipo === "Computador") {
    labelNomeNovo.textContent = "Nome do computador novo";
    nomeNovo.placeholder = "Ex.: pc08";
    return;
  }

  if (tipo === "Impressora") {
    labelNomeNovo.textContent = "Nome da impressora nova";
    nomeNovo.placeholder = "Ex.: impressora-financeiro-02";
    return;
  }

  if (tipo === "Monitor") {
    labelNomeNovo.textContent = "Nome do monitor novo";
    nomeNovo.placeholder = "Ex.: monitor-recepcao-02";
    return;
  }

  labelNomeNovo.textContent = "Nome do ativo novo";
  nomeNovo.placeholder = "Ex.: ativo-novo-01";
}

function atualizarCamposDinamicos() {
  const tipo = tipoAtivo.value;
  const mostrarIp = tipoUsaIp(tipo);
  const mostrarModelo = tipoUsaModelo(tipo);
  const mostrarProgramas = tipo === "Computador";

  ipFields.forEach((field) => field.classList.toggle("is-hidden", !mostrarIp));
  modeloFields.forEach((field) => field.classList.toggle("is-hidden", !mostrarModelo));
  programasField?.classList.toggle("is-hidden", !mostrarProgramas);

  ipNovo.required = mostrarIp;
  modeloNovo.required = mostrarModelo;

  if (!mostrarIp) ipNovo.value = "";
  if (!mostrarModelo) modeloNovo.value = "";
  if (!mostrarProgramas) {
    programasCheckboxes.forEach((checkbox) => { checkbox.checked = false; });
  }

  atualizarRotulosNome(tipo);
}

function getProgramasInstalados() {
  if (tipoAtivo.value !== "Computador") return [];
  return programasCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
}


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
function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.classList.remove("form-message--success", "form-message--error");
  if (tipo) mensagem.classList.add(`form-message--${tipo}`);
}

function setLoading(ativo) {
  btnSubmit.disabled = ativo;
  btnLimpar.disabled = ativo;
  btnSubmit.textContent = ativo ? "Enviando..." : "Registrar instalação";
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
    nome_ativo_novo: nomeNovo.value.trim(),
    ip_ativo_novo: ipNovo.value.trim(),
    modelo_ativo_novo: modeloNovo.value.trim(),
    setor: document.getElementById("setor").value.trim(),
    unidade: unidadeSelect.value.trim(),
    observacoes_instalacao: document.getElementById("observacoes_instalacao").value.trim(),
    programas_instalados: getProgramasInstalados()
  };

  try {
    setLoading(true);
    mostrarMensagem("", "");

    const resposta = await fetch("/api/instalacao-equipamentos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(dados)
    });

    const resultado = await resposta.json().catch(() => ({ ok: false, message: "Resposta inválida do servidor." }));

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || "Erro ao registrar a instalação.");
    }

    form.reset();
    atualizarCamposDinamicos();
    mostrarMensagem(resultado.message || "Instalação registrada com sucesso.", "success");
  } catch (error) {
    mostrarMensagem(error.message || "Erro ao registrar a instalação.", "error");
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
  carregarUnidades();

  loading.hidden = true;
  content.hidden = false;
})().catch((error) => {
  mostrarMensagem(error.message || "Erro ao carregar formulário.", "error");
  loading.hidden = true;
  content.hidden = false;
});
