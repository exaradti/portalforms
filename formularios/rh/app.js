const form = document.getElementById("formRH");
const msg = document.getElementById("msg");
const btnSubmit = form.querySelector('button[type="submit"]');

const campos = {
  nome: document.getElementById("nome"),
  cpf: document.getElementById("cpf"),
  setor: document.getElementById("setor"),
  email: document.getElementById("email"),
  tipo: document.getElementById("tipo"),
  descricao: document.getElementById("descricao"),
};

const erros = {
  nome: document.getElementById("erro-nome"),
  cpf: document.getElementById("erro-cpf"),
  setor: document.getElementById("erro-setor"),
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

function limparCPF(valor) {
  return valor.replace(/\D/g, "");
}

function formatarCPF(valor) {
  const numeros = limparCPF(valor).slice(0, 11);

  if (numeros.length <= 3) return numeros;
  if (numeros.length <= 6) return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
  if (numeros.length <= 9) return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
}

function validarCPF(cpf) {
  const cpfLimpo = limparCPF(cpf);

  if (cpfLimpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += Number(cpfLimpo.charAt(i)) * (10 - i);
  }

  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpfLimpo.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += Number(cpfLimpo.charAt(i)) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;

  return resto === Number(cpfLimpo.charAt(10));
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

campos.cpf.addEventListener("input", (e) => {
  e.target.value = formatarCPF(e.target.value);
});

Object.entries(campos).forEach(([nome, campo]) => {
  campo.addEventListener("input", () => limparErro(campo, nome));
  campo.addEventListener("change", () => limparErro(campo, nome));
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  limparMensagem();

  let valido = true;

  const nome = campos.nome.value.trim();
  const cpf = campos.cpf.value.trim();
  const setor = campos.setor.value.trim();
  const email = campos.email.value.trim();
  const tipo = campos.tipo.value.trim();
  const descricao = campos.descricao.value.trim();

  if (!nome) {
    mostrarErro(campos.nome, "nome", "Informe o nome completo.");
    valido = false;
  }

  if (!cpf) {
    mostrarErro(campos.cpf, "cpf", "Informe o CPF.");
    valido = false;
  } else if (!validarCPF(cpf)) {
    mostrarErro(campos.cpf, "cpf", "Informe um CPF válido.");
    valido = false;
  }

  if (!setor) {
    mostrarErro(campos.setor, "setor", "Informe o setor.");
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

  if (!descricao) {
    mostrarErro(campos.descricao, "descricao", "Descreva a solicitação.");
    valido = false;
  }

  if (!valido) {
    msg.textContent = "Corrija os campos obrigatórios antes de enviar.";
    msg.className = "msg error";
    return;
  }

  const payload = {
    nome,
    cpf: limparCPF(cpf),
    setor,
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
