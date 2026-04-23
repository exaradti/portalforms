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

async function validarAcessoGestao(context, usuario, perfil) {
  const profileId = (perfil?.id || usuario?.id || '').toString().trim();
  if (!profileId) return false;

  const resposta = await fetch(
    `${context.env.SUPABASE_URL}/rest/v1/informatica_gestao_permissoes?select=id,profile_id,ativo&profile_id=eq.${encodeURIComponent(profileId)}&ativo=eq.true`,
    {
      method: 'GET',
      headers: adminHeaders(context)
    }
  );

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao validar permissão de gestão: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) && retorno.length > 0;
}

function buildListUrl(baseUrl, params) {
  const url = new URL(`${baseUrl}/rest/v1/vw_gestao_equipamentos`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(Math.min(Number(params.get('limit')) || 200, 500)));

  const dataInicio = limparTexto(params.get('data_inicio'));
  if (dataInicio) {
    url.searchParams.append('created_at', `gte.${dataInicio}T00:00:00`);
  }

  const dataFim = limparTexto(params.get('data_fim'));
  if (dataFim) {
    url.searchParams.append('created_at', `lte.${dataFim}T23:59:59.999`);
  }

  const filtrosEq = [
    ['origem', 'origem'],
    ['tipo_ativo', 'tipo_ativo'],
    ['unidade', 'unidade'],
    ['status_glpi', 'status_glpi']
  ];

  filtrosEq.forEach(([param, coluna]) => {
    const valor = limparTexto(params.get(param));
    if (valor) {
      url.searchParams.set(coluna, `eq.${valor}`);
    }
  });

  const filtrosLike = [
    ['setor', 'setor'],
    ['nome_equipamento', 'nome_equipamento'],
    ['ip_equipamento', 'ip_equipamento'],
    ['glpi_tag', 'glpi_tag'],
    ['nome_tecnico', 'nome_tecnico']
  ];

  filtrosLike.forEach(([param, coluna]) => {
    const valor = limparTexto(params.get(param));
    if (valor) {
      url.searchParams.set(coluna, `ilike.*${valor}*`);
    }
  });

  return url.toString();
}

async function listarRegistros(context, searchParams) {
  const url = buildListUrl(context.env.SUPABASE_URL, searchParams);

  const resposta = await fetch(url, {
    method: 'GET',
    headers: adminHeaders(context)
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao consultar registros: ${erro}`);
  }

  return resposta.json();
}

function normalizarStatusGlpi(valor) {
  const status = limparTexto(valor).toLowerCase();

  if (!status || status === 'pendente') return 'pendente';
  if (status === 'registrado' || status === 'replicado') return 'registrado';

  throw new Error('Status GLPI inválido.');
}

async function atualizarRegistro(context, body, usuario, perfil) {
  const origem = limparTexto(body.origem).toLowerCase();
  const registroId = Number(body.registro_id);
  const statusGlpi = normalizarStatusGlpi(body.status_glpi);
  const glpiTag = limparTexto(body.glpi_tag) || null;

  if (!['troca', 'instalacao'].includes(origem)) {
    throw new Error('Origem inválida para atualização.');
  }

  if (!Number.isFinite(registroId) || registroId <= 0) {
    throw new Error('Registro inválido para atualização.');
  }

  const tabela = origem === 'troca' ? 'trocas_ativos' : 'instalacoes_ativos';
  const nomeAtualizador = limparTexto(perfil?.nome) || limparTexto(usuario?.email) || 'Usuário autenticado';

  const payload = {
    status_glpi: statusGlpi,
    glpi_tag: statusGlpi === 'pendente' && !glpiTag ? null : glpiTag,
    glpi_atualizado_em: new Date().toISOString(),
    glpi_atualizado_por: nomeAtualizador
  };

  const resposta = await fetch(
    `${context.env.SUPABASE_URL}/rest/v1/${tabela}?id=eq.${registroId}`,
    {
      method: 'PATCH',
      headers: adminHeaders(context, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }),
      body: JSON.stringify(payload)
    }
  );

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao atualizar registro: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : retorno;
}

export async function onRequestGet(context) {
  try {
    const usuario = await validarUsuario(context);
    const perfil = await buscarPerfil(context, usuario.id);

    if (!perfil) {
      return Response.json({ ok: false, message: 'Perfil do usuário não encontrado.' }, { status: 403 });
    }

    if (perfil.ativo === false) {
      return Response.json({ ok: false, message: 'Usuário inativo.' }, { status: 403 });
    }

    const permitido = await validarAcessoGestao(context, usuario, perfil);
    if (!permitido) {
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de equipamentos.' }, { status: 403 });
    }

    const url = new URL(context.request.url);

    if (url.searchParams.get('check_access') === '1') {
      return Response.json({
        ok: true,
        permitido: true,
        profile_id: perfil.id
      });
    }

    const registros = await listarRegistros(context, url.searchParams);

    return Response.json({
      ok: true,
      permitido: true,
      registros,
      total: Array.isArray(registros) ? registros.length : 0
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error.message || 'Erro ao consultar gestão de equipamentos.' },
      { status: 500 }
    );
  }
}

export async function onRequestPatch(context) {
  try {
    const usuario = await validarUsuario(context);
    const perfil = await buscarPerfil(context, usuario.id);

    if (!perfil) {
      return Response.json({ ok: false, message: 'Perfil do usuário não encontrado.' }, { status: 403 });
    }

    if (perfil.ativo === false) {
      return Response.json({ ok: false, message: 'Usuário inativo.' }, { status: 403 });
    }

    const permitido = await validarAcessoGestao(context, usuario, perfil);
    if (!permitido) {
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de equipamentos.' }, { status: 403 });
    }

    const body = await context.request.json();
    const atualizado = await atualizarRegistro(context, body, usuario, perfil);

    return Response.json({
      ok: true,
      registro: atualizado,
      message: 'Registro atualizado com sucesso.'
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error.message || 'Erro ao atualizar gestão de equipamentos.' },
      { status: 500 }
    );
  }
}
