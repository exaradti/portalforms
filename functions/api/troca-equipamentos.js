function limparTexto(valor) {
  return (valor || "").toString().trim();
}

function montarCorpoEmail(dados) {
  const linhas = [
    "Nova troca de equipamento registrada",
    "",
    `Técnico: ${dados.nome_tecnico}`,
    `Tipo de ativo: ${dados.tipo_ativo}`,
    `Nome antigo: ${dados.nome_ativo_antigo}`,
    `Nome novo: ${dados.nome_ativo_novo}`,
  ];

  if (dados.ip_ativo_antigo || dados.ip_ativo_novo) {
    linhas.push(`IP antigo: ${dados.ip_ativo_antigo || "Não informado"}`);
    linhas.push(`IP novo: ${dados.ip_ativo_novo || "Não informado"}`);
  }

  if (dados.modelo_ativo_antigo || dados.modelo_ativo_novo) {
    linhas.push(`Modelo antigo: ${dados.modelo_ativo_antigo || "Não informado"}`);
    linhas.push(`Modelo novo: ${dados.modelo_ativo_novo || "Não informado"}`);
  }

  linhas.push(`Setor: ${dados.setor}`);
  linhas.push(`Unidade: ${dados.unidade}`);
  linhas.push("");
  linhas.push("Motivo da troca:");
  linhas.push(dados.motivo_troca);

  return linhas.join("\n");
}

async function salvarNoSupabase(context, dados) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/rest/v1/trocas_ativos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": context.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify(dados)
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao salvar no Supabase: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? retorno[0] : retorno;
}

async function enviarEmail(context, dados) {
  const emailResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: context.env.EMAIL_FROM,
      to: context.env.EMAIL_TI_DESTINO,
      subject: `Troca de equipamento registrada - ${dados.tipo_ativo} - ${dados.setor}`,
      text: montarCorpoEmail(dados),
    }),
  });

  if (!emailResp.ok) {
    const erroTexto = await emailResp.text();
    throw new Error(`Erro ao enviar e-mail: ${erroTexto}`);
  }
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();

    const dados = {
      nome_tecnico: limparTexto(data.nome_tecnico),
      tipo_ativo: limparTexto(data.tipo_ativo),
      nome_ativo_antigo: limparTexto(data.nome_ativo_antigo),
      nome_ativo_novo: limparTexto(data.nome_ativo_novo),
      ip_ativo_antigo: limparTexto(data.ip_ativo_antigo),
      ip_ativo_novo: limparTexto(data.ip_ativo_novo),
      modelo_ativo_antigo: limparTexto(data.modelo_ativo_antigo),
      modelo_ativo_novo: limparTexto(data.modelo_ativo_novo),
      setor: limparTexto(data.setor),
      unidade: limparTexto(data.unidade),
      motivo_troca: limparTexto(data.motivo_troca),
      status_glpi: "pendente"
    };

    if (!dados.nome_tecnico || !dados.tipo_ativo || !dados.nome_ativo_antigo || !dados.nome_ativo_novo || !dados.setor || !dados.unidade || !dados.motivo_troca) {
      return Response.json({ ok: false, message: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }

    const tiposValidos = ["Computador", "Monitor", "Impressora", "Tablet"];
    if (!tiposValidos.includes(dados.tipo_ativo)) {
      return Response.json({ ok: false, message: "Tipo de ativo inválido." }, { status: 400 });
    }

    if (["Computador", "Impressora"].includes(dados.tipo_ativo)) {
      if (!dados.ip_ativo_antigo || !dados.ip_ativo_novo) {
        return Response.json({ ok: false, message: "Informe o IP antigo e o novo para este tipo de ativo." }, { status: 400 });
      }
    } else {
      dados.ip_ativo_antigo = "";
      dados.ip_ativo_novo = "";
    }

    if (dados.tipo_ativo === "Tablet") {
      if (!dados.modelo_ativo_antigo || !dados.modelo_ativo_novo) {
        return Response.json({ ok: false, message: "Informe o modelo antigo e o novo do tablet." }, { status: 400 });
      }
    } else {
      dados.modelo_ativo_antigo = "";
      dados.modelo_ativo_novo = "";
    }

    await salvarNoSupabase(context, dados);
    await enviarEmail(context, dados);

    return Response.json({ ok: true, message: "Registro salvo no Supabase e e-mail enviado com sucesso." });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Erro interno ao processar a troca." }, { status: 500 });
  }
}
