function limparTexto(valor) {
  return (valor || "").toString().trim();
}

function getUserDisplayName(usuario, perfil) {
  return limparTexto(perfil?.nome)
    || limparTexto(usuario?.user_metadata?.full_name)
    || limparTexto(usuario?.user_metadata?.name)
    || limparTexto(usuario?.user_metadata?.display_name)
    || limparTexto(usuario?.email)
    || "Usuário autenticado";
}

function normalizarProgramasInstalados(valor) {
  if (Array.isArray(valor)) {
    return valor.map((item) => limparTexto(item)).filter(Boolean);
  }

  const texto = limparTexto(valor);
  return texto ? [texto] : [];
}

function montarCorpoEmail(dados, usuario, perfil) {
  const nomeTecnico = getUserDisplayName(usuario, perfil);

  const linhas = [
    "Nova troca de equipamento registrada",
    "",
    `Técnico logado: ${nomeTecnico}`,
    `E-mail do usuário: ${usuario?.email || "Não identificado"}`,
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

  if (Array.isArray(dados.programas_instalados) && dados.programas_instalados.length) {
    linhas.push(`Programas instalados: ${dados.programas_instalados.join(", ")}`);
  }

  linhas.push(`Setor: ${dados.setor}`);
  linhas.push(`Unidade: ${dados.unidade}`);
  linhas.push("");
  linhas.push("Motivo da troca:");
  linhas.push(dados.motivo_troca);

  return linhas.join("\n");
}

async function validarUsuario(context) {
  const authorization = context.request.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Token Bearer não enviado.");
  }

  const token = authorization.slice(7);

  if (!context.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL não configurada no Pages.");
  }

  if (!context.env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_ANON_KEY não configurada no Pages.");
  }

  const resposta = await fetch(`${context.env.SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: context.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro ao validar usuário: ${resposta.status} - ${texto}`);
  }

  return resposta.json();
}

async function buscarPerfil(context, userId) {
  if (!userId) return null;

  const resposta = await fetch(
    `${context.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,nome,email,ativo`,
    {
      method: "GET",
      headers: {
        apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: "application/json"
      }
    }
  );

  if (!resposta.ok) {
    return null;
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : null;
}

async function salvarNoSupabase(context, dados) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/rest/v1/trocas_ativos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation"
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

async function enviarEmail(context, dados, usuario, perfil) {
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
      text: montarCorpoEmail(dados, usuario, perfil),
    }),
  });

  if (!emailResp.ok) {
    const erroTexto = await emailResp.text();
    throw new Error(`Erro ao enviar e-mail: ${erroTexto}`);
  }
}

export async function onRequestPost(context) {
  try {
    const usuario = await validarUsuario(context);

    const perfil = await buscarPerfil(context, usuario.id);

    if (perfil && perfil.ativo === false) {
      return Response.json(
        { ok: false, message: "Usuário sem permissão para registrar trocas." },
        { status: 403 }
      );
    }

    const data = await context.request.json();
    const nomeTecnico = getUserDisplayName(usuario, perfil);

    const dados = {
      tecnico_user_id: usuario.id,
      nome_tecnico: nomeTecnico,
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
      programas_instalados: normalizarProgramasInstalados(data.programas_instalados),
      status_glpi: "pendente"
    };

    await salvarNoSupabase(context, dados);
    await enviarEmail(context, dados, usuario, perfil);

    return Response.json({
      ok: true,
      message: `Registro salvo com sucesso para ${nomeTecnico}.`
    });

  } catch (error) {
    return Response.json(
      { ok: false, message: error.message || "Erro interno ao processar a troca." },
      { status: 500 }
    );
  }
}
