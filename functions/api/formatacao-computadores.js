function limparTexto(valor) {
  return (valor || '').toString().trim();
}

function adminHeaders(context, extras = {}) {
  return {
    apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: 'application/json',
    ...extras
  };
}

async function validarUsuario(context) {
  const authorization = context.request.headers.get('Authorization') || '';

  if (!authorization.startsWith('Bearer ')) {
    throw new Error('Token Bearer não enviado.');
  }

  const token = authorization.slice(7);

  const resposta = await fetch(`${context.env.SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
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
      method: 'GET',
      headers: adminHeaders(context)
    }
  );

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao consultar perfil: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : null;
}

function validarPayload(body) {
  const payload = {
    nome_computador: limparTexto(body.nome_computador),
    ip_computador: limparTexto(body.ip_computador),
    unidade: limparTexto(body.unidade),
    setor: limparTexto(body.setor),
    motivo_formatacao: limparTexto(body.motivo_formatacao),
    programas_instalados: Array.isArray(body.programas_instalados) ? body.programas_instalados.map(limparTexto).filter(Boolean) : []
  };

  if (!payload.nome_computador) throw new Error('Nome do computador é obrigatório.');
  if (!payload.ip_computador) throw new Error('IP do computador é obrigatório.');
  if (!payload.unidade) throw new Error('Unidade é obrigatória.');
  if (!payload.setor) throw new Error('Setor é obrigatório.');
  if (!payload.motivo_formatacao) throw new Error('Descrição do motivo é obrigatória.');

  return payload;
}

async function inserirRegistro(context, payload, usuario, perfil) {
  const nomeTecnico = limparTexto(perfil?.nome) || limparTexto(usuario?.email) || 'Usuário autenticado';

  const registro = {
    tecnico_user_id: perfil?.id || usuario.id,
    nome_tecnico: nomeTecnico,
    nome_computador: payload.nome_computador,
    ip_computador: payload.ip_computador,
    programas_instalados: payload.programas_instalados,
    setor: payload.setor,
    unidade: payload.unidade,
    motivo_formatacao: payload.motivo_formatacao,
    status_glpi: 'pendente'
  };

  const resposta = await fetch(`${context.env.SUPABASE_URL}/rest/v1/formatacoes_computadores`, {
    method: 'POST',
    headers: adminHeaders(context, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify([registro])
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao salvar registro: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : retorno;
}

async function enviarEmail(context, registro, perfil) {
  const resendKey = context.env.RESEND_API_KEY;
  const emailFrom = context.env.EMAIL_FROM;
  const emailDestino = context.env.EMAIL_TI_DESTINO;

  if (!resendKey || !emailFrom || !emailDestino) {
    return { enviado: false, motivo: 'Variáveis de e-mail não configuradas.' };
  }

  const programas = Array.isArray(registro.programas_instalados) && registro.programas_instalados.length
    ? registro.programas_instalados.join(', ')
    : 'Nenhum programa marcado';

  const html = `
    <h2>Formatação de Computador</h2>
    <p><strong>Técnico:</strong> ${registro.nome_tecnico || '-'}</p>
    <p><strong>E-mail do técnico:</strong> ${perfil?.email || '-'}</p>
    <p><strong>Nome do computador:</strong> ${registro.nome_computador || '-'}</p>
    <p><strong>IP:</strong> ${registro.ip_computador || '-'}</p>
    <p><strong>Unidade:</strong> ${registro.unidade || '-'}</p>
    <p><strong>Setor:</strong> ${registro.setor || '-'}</p>
    <p><strong>Programas instalados:</strong> ${programas}</p>
    <p><strong>Motivo:</strong><br>${(registro.motivo_formatacao || '-').replace(/\n/g, '<br>')}</p>
  `;

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [emailDestino],
      subject: `Formatação de computador - ${registro.nome_computador}`,
      html
    })
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    return { enviado: false, motivo: erro };
  }

  return { enviado: true };
}

export async function onRequestPost(context) {
  try {
    const usuario = await validarUsuario(context);
    const perfil = await buscarPerfil(context, usuario.id);

    if (!perfil) {
      return Response.json({ ok: false, message: 'Perfil do usuário não encontrado.' }, { status: 403 });
    }

    if (perfil.ativo === false) {
      return Response.json({ ok: false, message: 'Usuário inativo.' }, { status: 403 });
    }

    const body = await context.request.json();
    const payload = validarPayload(body);
    const registro = await inserirRegistro(context, payload, usuario, perfil);
    const email = await enviarEmail(context, registro, perfil);

    return Response.json({
      ok: true,
      registro,
      email,
      message: 'Formatação registrada com sucesso.'
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error.message || 'Erro ao registrar formatação.' },
      { status: 500 }
    );
  }
}
