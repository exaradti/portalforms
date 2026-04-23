function limparTexto(valor) {
  return (valor || '').toString().trim();
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
      headers: {
        apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json'
      }
    }
  );

  if (!resposta.ok) return null;

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : null;
}

async function validarAcessoGestao(context, usuario, perfil) {
  const headers = {
    apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: 'application/json'
  };

  const profileId = (perfil?.id || usuario?.id || '').toString().trim();
  const email = limparTexto(perfil?.email) || limparTexto(usuario?.email);

  if (profileId) {
    const porProfileId = await fetch(
      `${context.env.SUPABASE_URL}/rest/v1/informatica_gestao_permissoes?select=id,profile_id,ativo&profile_id=eq.${encodeURIComponent(profileId)}&ativo=eq.true`,
      { method: 'GET', headers }
    );

    if (porProfileId.ok) {
      const retorno = await porProfileId.json();
      if (Array.isArray(retorno) && retorno.length > 0) return true;
    }
  }

  if (email) {
    const porEmail = await fetch(
      `${context.env.SUPABASE_URL}/rest/v1/informatica_gestao_permissoes?select=id,email,ativo&email=eq.${encodeURIComponent(email)}&ativo=eq.true`,
      { method: 'GET', headers }
    );

    if (porEmail.ok) {
      const retorno = await porEmail.json();
      if (Array.isArray(retorno) && retorno.length > 0) return true;
    }
  }

  return false;
}

function buildListUrl(baseUrl, params) {
  const url = new URL(`${baseUrl}/rest/v1/vw_gestao_equipamentos`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(Math.min(Number(params.get('limit')) || 200, 500)));

  const dataInicio = limparTexto(params.get('data_inicio'));
  if (dataInicio) {
    url.searchParams.set('created_at', `gte.${dataInicio}T00:00:00`);
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

  const filtroTag = limparTexto(params.get('filtro_tag'));
  if (filtroTag === 'com_tag') {
    url.searchParams.set('glpi_tag', 'not.is.null');
  }
  if (filtroTag === 'sem_tag') {
    url.searchParams.set('glpi_tag', 'is.null');
  }

  return url.toString();
}

async function listarRegistros(context, searchParams) {
  const url = buildListUrl(context.env.SUPABASE_URL, searchParams);
  const resposta = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json'
    }
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao consultar registros: ${erro}`);
  }

  return resposta.json();
}

function normalizarStatusGlpi(valor) {
  const status = limparTexto(valor).toLowerCase();

  if (!status) return 'pendente';
  if (status === 'pendente') return 'pendente';

  // compatibilidade com o front antigo
  if (status === 'replicado' || status === 'registrado') {
    return 'registrado';
  }

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
      headers: {
        'Content-Type': 'application/json',
        apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=representation'
      },
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

    if (perfil && perfil.ativo === false) {
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
        profile_id: perfil?.id || usuario.id || null
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
    return Response.json({ ok: false, message: error.message || 'Erro ao consultar gestão de equipamentos.' }, { status: 500 });
  }
}

export async function onRequestPatch(context) {
  try {
    const usuario = await validarUsuario(context);
    const perfil = await buscarPerfil(context, usuario.id);

    if (perfil && perfil.ativo === false) {
      return Response.json({ ok: false, message: 'Usuário inativo.' }, { status: 403 });
    }

    const permitido = await validarAcessoGestao(context, usuario, perfil);
    if (!permitido) {
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de equipamentos.' }, { status: 403 });
    }

    const body = await context.request.json();
    const atualizado = await atualizarRegistro(context, body, usuario, perfil);

    return Response.json({ ok: true, registro: atualizado, message: 'Registro atualizado com sucesso.' });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || 'Erro ao atualizar gestão de equipamentos.' }, { status: 500 });
  }
}
