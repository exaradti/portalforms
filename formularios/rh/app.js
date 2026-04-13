const form = document.getElementById("formRH");
const msg = document.getElementById("msg");
const btnSubmit = form.querySelector('button[type="submit"]');

const campos = {
  nome: document.getElementById("nome"),
  email: document.getElementById("email"),
  tipo: document.getElementById("tipo"),
  descricao: document.getElementById("descricao"),
};

const erros = {
  nome: document.getElementById("erro-nome"),
  email: document.getElementById("erro-email"),
  tipo: document.getElementById("erro-tipo"),
  descricao: document.getElementById("erro-descricao"),
};

function limparMensagem() {
  msg.textContent = "";
  msg.className = "msg";
}

function limparErro(campo, nomeErro) {
  if (!campo || !erros[nomeErro]) return;
  campo.classList.remove("input-error");
  erros[nomeErro].textContent = "";
}

function mostrarErro(campo, nomeErro, mensagem) {
  if (!campo || !erros[nomeErro]) return;
  campo.classList.add("input-error");
  erros[nomeErro].textContent = mensagem;
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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

Object.entries(campos).forEach(([nome, campo]) => {
  campo.addEventListener("input", () => limparErro(campo, nome));
  campo.addEventListener("change", () => limparErro(campo, nome));
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  limparMensagem();

  let valido = true;

  const nome = campos.nome.value.trim();
  const email = campos.email.value.trim();
  const tipo = campos.tipo.value.trim();
  const descricao = campos.descricao.value.trim();

  if (!nome) {
    mostrarErro(campos.nome, "nome", "Informe o nome completo.");
    valido = false;
  }

  if (!email) {
    mostrarErro(campos.email, "email", "Informe o e-mail.");
    valido = false;
  } else if (!validarEmail(email)) {
    mostrarErro(campos.email, "email", "Informe um e-mail válido.");
    valido = false;
  }

  if (!tipo) {
    mostrarErro(campos.tipo, "tipo", "Selecione o tipo de solicitação.");
    valido = false;
  }

  if (!valido) {
    msg.textContent = "Corrija os campos obrigatórios antes de enviar.";
    msg.className = "msg error";
    return;
  }

  const payload = {
    nome,
    email,
    tipo,
    descricao,
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Enviando...";

  try {
    const resp = await fetch("/api/rh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await lerRespostaSegura(resp);

    if (!resp.ok || !result.ok) {
      throw new Error(result.message || "Erro ao enviar solicitação.");
    }

    form.reset();
    Object.entries(campos).forEach(([nomeCampo, campo]) => {
      limparErro(campo, nomeCampo);
    });

    msg.textContent = result.message || "Solicitação enviada com sucesso.";
    msg.className = "msg success";
  } catch (error) {
    msg.textContent = error.message || "Erro ao enviar solicitação.";
    msg.className = "msg error";
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Enviar solicitação";
  }
});
