const form = document.getElementById("formDenuncia");
const descricao = document.getElementById("descricao");
const provas = document.getElementById("provas");
const listaArquivos = document.getElementById("listaArquivos");
const msg = document.getElementById("msg");
const erroDescricao = document.getElementById("erro-descricao");
const btnSubmit = form.querySelector('button[type="submit"]');
const btnReset = form.querySelector('button[type="reset"]');

const MAX_ARQUIVOS = 5;
const MAX_MB_POR_ARQUIVO = 10;
const MAX_BYTES_POR_ARQUIVO = MAX_MB_POR_ARQUIVO * 1024 * 1024;

const EXTENSOES_PERMITIDAS = [
  "jpg",
  "jpeg",
  "png",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "mp3",
  "mp4",
  "wav",
];

function limparErro() {
  descricao.classList.remove("input-error");
  erroDescricao.textContent = "";
}

function mostrarErro(mensagem) {
  descricao.classList.add("input-error");
  erroDescricao.textContent = mensagem;
}

function limparMensagem() {
  msg.textContent = "";
  msg.className = "msg";
}

function obterExtensao(nomeArquivo) {
  const partes = nomeArquivo.toLowerCase().split(".");
  return partes.length > 1 ? partes.pop() : "";
}

function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validarArquivos(files) {
  if (!files || files.length === 0) {
    return { ok: true };
  }

  if (files.length > MAX_ARQUIVOS) {
    return {
      ok: false,
      message: `Você pode anexar no máximo ${MAX_ARQUIVOS} arquivos.`,
    };
  }

  for (const arquivo of files) {
    const ext = obterExtensao(arquivo.name);

    if (!EXTENSOES_PERMITIDAS.includes(ext)) {
      return {
        ok: false,
        message: `O arquivo "${arquivo.name}" não possui um formato permitido.`,
      };
    }

    if (arquivo.size > MAX_BYTES_POR_ARQUIVO) {
      return {
        ok: false,
        message: `O arquivo "${arquivo.name}" excede o limite de ${MAX_MB_POR_ARQUIVO} MB.`,
      };
    }
  }

  return { ok: true };
}

function renderizarListaArquivos() {
  listaArquivos.innerHTML = "";

  if (!provas.files || provas.files.length === 0) {
    return;
  }

  const validacao = validarArquivos(Array.from(provas.files));

  if (!validacao.ok) {
    provas.value = "";
    msg.textContent = validacao.message;
    msg.className = "msg error";
    return;
  }

  const ul = document.createElement("ul");

  Array.from(provas.files).forEach((arquivo) => {
    const li = document.createElement("li");
    li.textContent = `${arquivo.name} (${formatarTamanho(arquivo.size)})`;
    ul.appendChild(li);
  });

  listaArquivos.appendChild(ul);
}

async function lerRespostaSegura(resp) {
  const contentType = resp.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await resp.json();
  }

  const texto = await resp.text();
  return {
    ok: false,
    message: texto || "Resposta inválida do servidor.",
  };
}

function resetVisualForm() {
  limparErro();
  listaArquivos.innerHTML = "";
  provas.value = "";
  btnSubmit.disabled = false;
  btnSubmit.textContent = "Enviar denúncia";
}

descricao.addEventListener("input", limparErro);

provas.addEventListener("change", () => {
  limparMensagem();
  renderizarListaArquivos();
});

if (btnReset) {
  btnReset.addEventListener("click", () => {
    setTimeout(() => {
      limparErro();
      limparMensagem();
      listaArquivos.innerHTML = "";
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Enviar denúncia";
    }, 0);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  limparErro();
  limparMensagem();

  const descricaoValor = descricao.value.trim();
  const arquivos = Array.from(provas.files || []);

  if (!descricaoValor) {
    mostrarErro("Descreva a situação antes de enviar.");
    msg.textContent = "Preencha os campos obrigatórios antes de enviar.";
    msg.className = "msg error";
    return;
  }

  const validacaoArquivos = validarArquivos(arquivos);

  if (!validacaoArquivos.ok) {
    msg.textContent = validacaoArquivos.message;
    msg.className = "msg error";
    return;
  }

  const formData = new FormData(form);

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Enviando...";

  try {
    const resp = await fetch("/api/denuncia", {
      method: "POST",
      body: formData,
    });

    const result = await lerRespostaSegura(resp);

    if (!resp.ok || !result.ok) {
      throw new Error(result.message || "Erro ao enviar denúncia.");
    }

    form.reset();
    resetVisualForm();

    msg.textContent = result.message || "Denúncia enviada com sucesso.";
    msg.className = "msg success";
  } catch (error) {
    msg.textContent = error.message || "Erro ao enviar denúncia.";
    msg.className = "msg error";
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Enviar denúncia";
  }
});
