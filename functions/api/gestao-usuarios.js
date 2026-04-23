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
    `${context.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,nome,email,ativo,created_at,updated_at`,
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

async function listarUsuarios(context, searchParams) {
  const url = new URL(`${context.env.SUPABASE_URL}/rest/v1/profiles`);
  url.searchParams.set('select', 'id,nome,email,ativo,created_at,updated_at');
  url.searchParams.set('order', 'nome.asc');

  const busca = limparTexto(searchParams.get('busca'));
  if (busca) {
    url.searchParams.set('or', `(nome.ilike.*${busca}*,email.ilike.*${busca}*)`);
  }

  const status = limparTexto(searchParams.get('status'));
  if (status === 'ativos') {
    url.searchParams.set('ativo', 'eq.true');
  } else if (status === 'inativos') {
    url.searchParams.set('ativo', 'eq.false');
  }

  const respostaProfiles = await fetch(url.toString(), {
    method: 'GET',
    headers: adminHeaders(context)
  });

  if (!respostaProfiles.ok) {
    const erro = await respostaProfiles.text();
    throw new Error(`Erro ao listar profiles: ${erro}`);
  }

  const profiles = await respostaProfiles.json();

  const respostaGestao = await fetch(
    `${context.env.SUPABASE_URL}/rest/v1/informatica_gestao_permissoes?select=profile_id,ativo`,
    {
      method: 'GET',
      headers: adminHeaders(context)
    }
  );

  if (!respostaGestao.ok) {
    const erro = await respostaGestao.text();
    throw new Error(`Erro ao listar permissões de gestão: ${erro}`);
  }

  const permissoes = await respostaGestao.json();

  const mapaGestao = new Map();
  (Array.isArray(permissoes) ? permissoes : []).forEach((item) => {
    mapaGestao.set(item.profile_id, item.ativo === true);
  });

  const lista = Array.isArray(profiles) ? profiles.map((item) => ({
    id: item.id,
    nome: item.nome,
    email: item.email,
    ativo: item.ativo === true,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null,
    acesso_gestao: mapaGestao.get(item.id) === true
  })) : [];

  const acessoGestao = limparTexto(searchParams.get('acesso_gestao'));
  let filtrada = lista;

  if (acessoGestao === 'com_acesso') {
    filtrada = filtrada.filter((item) => item.acesso_gestao === true);
  } else if (acessoGestao === 'sem_acesso') {
    filtrada = filtrada.filter((item) => item.acesso_gestao === false);
  }

  return filtrada;
}

async function criarUsuarioAuth(context, email, senha) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(context, {
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify({
      email,
      password: senha,
      email_confirm: true
    })
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao criar usuário no Auth: ${erro}`);
  }

  return resposta.json();
}

async function atualizarSenhaAuth(context, userId, senha) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: adminHeaders(context, {
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify({
      password: senha
    })
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao atualizar senha do usuário: ${erro}`);
  }

  return resposta.json();
}

async function upsertProfile(context, { id, nome, email, ativo }) {
  const resposta = await fetch(
    `${context.env.SUPABASE_URL}/rest/v1/profiles?on_conflict=id`,
    {
      method: 'POST',
      headers: adminHeaders(context, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      body: JSON.stringify([{
        id,
        nome,
        email,
        ativo
      }])
    }
  );

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao gravar profile: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : retorno;
}

async function upsertPermissaoGestao(context, profileId, ativo) {
  const resposta = await fetch(
    `${context.env.SUPABASE_URL}/rest/v1/informatica_gestao_permissoes?on_conflict=profile_id`,
    {
      method: 'POST',
      headers: adminHeaders(context, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      body: JSON.stringify([{
        profile_id: profileId,
        ativo
      }])
    }
  );

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao gravar permissão de gestão: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : retorno;
}

async function criarUsuario(context, body) {
  const email = limparTexto(body.email).toLowerCase();
  const nome = limparTexto(body.nome);
  const senha = limparTexto(body.senha);
  const ativo = body.ativo === true;
  const acessoGestao = body.acesso_gestao === true;

  if (!email) throw new Error('E-mail é obrigatório.');
  if (!nome) throw new Error('Nome é obrigatório.');
  if (!senha || senha.length < 6) throw new Error('Senha inicial inválida.');

  const authUser = await criarUsuarioAuth(context, email, senha);
  const userId = authUser?.id;

  if (!userId) {
    throw new Error('Usuário criado sem ID retornado pelo Auth.');
  }

  await upsertProfile(context, {
    id: userId,
    nome,
    email,
    ativo
  });

  await upsertPermissaoGestao(context, userId, acessoGestao);

  return { id: userId, email, nome, ativo, acesso_gestao: acessoGestao };
}

async function atualizarUsuario(context, body) {
  const id = limparTexto(body.id);
  const nome = limparTexto(body.nome);
  const email = limparTexto(body.email).toLowerCase();
  const senha = limparTexto(body.senha);
  const ativo = body.ativo === true;
  const acessoGestao = body.acesso_gestao === true;

  if (!id) throw new Error('ID do usuário é obrigatório.');
  if (!nome) throw new Error('Nome é obrigatório.');
  if (!email) throw new Error('E-mail é obrigatório.');

  await upsertProfile(context, {
    id,
    nome,
    email,
    ativo
  });

  await upsertPermissaoGestao(context, id, acessoGestao);

  if (senha) {
    await atualizarSenhaAuth(context, id, senha);
  }

  return { id, email, nome, ativo, acesso_gestao: acessoGestao };
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
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de usuários.' }, { status: 403 });
    }

    const url = new URL(context.request.url);

    if (url.searchParams.get('check_access') === '1') {
      return Response.json({
        ok: true,
        permitido: true,
        profile_id: perfil.id
      });
    }

    const usuarios = await listarUsuarios(context, url.searchParams);

    return Response.json({
      ok: true,
      usuarios,
      total: Array.isArray(usuarios) ? usuarios.length : 0
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error.message || 'Erro ao consultar gestão de usuários.' },
      { status: 500 }
    );
  }
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

    const permitido = await validarAcessoGestao(context, usuario, perfil);
    if (!permitido) {
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de usuários.' }, { status: 403 });
    }

    const body = await context.request.json();
    const criado = await criarUsuario(context, body);

    return Response.json({
      ok: true,
      usuario: criado,
      message: 'Usuário criado com sucesso.'
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error.message || 'Erro ao criar usuário.' },
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
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de usuários.' }, { status: 403 });
    }

    const body = await context.request.json();
    const atualizado = await atualizarUsuario(context, body);

    return Response.json({
      ok: true,
      usuario: atualizado,
      message: 'Usuário atualizado com sucesso.'
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error.message || 'Erro ao atualizar usuário.' },
      { status: 500 }
    );
  }
}
