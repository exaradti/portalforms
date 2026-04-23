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

function adminHeaders(context, extra = {}) {
  return {
    apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

async function buscarPerfil(context, userId) {
  if (!userId) return null;

  const resposta = await fetch(
    `${context.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,nome,email,ativo,created_at,updated_at`,
    {
      method: 'GET',
      headers: adminHeaders(context, { Accept: 'application/json' })
    }
  );

  if (!resposta.ok) return null;

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : null;
}

async function validarAcessoGestao(context, usuario, perfil) {
  const profileId = (perfil?.id || usuario?.id || '').toString().trim();
  if (!profileId) return false;

  const resposta = await fetch(
    `${context.env.SUPABASE_URL}/rest/v1/informatica_gestao_permissoes?select=id,profile_id,ativo&profile_id=eq.${encodeURIComponent(profileId)}&ativo=eq.true`,
    { method: 'GET', headers: adminHeaders(context, { Accept: 'application/json' }) }
  );

  if (!resposta.ok) return false;

  const retorno = await resposta.json();
  return Array.isArray(retorno) && retorno.length > 0;
}

async function listarAuthUsers(context) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=500`, {
    method: 'GET',
    headers: adminHeaders(context)
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao listar usuários no Auth: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno.users) ? retorno.users : [];
}

async function listarProfiles(context) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/rest/v1/profiles?select=id,nome,email,ativo,created_at,updated_at`, {
    method: 'GET',
    headers: adminHeaders(context, { Accept: 'application/json' })
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao listar profiles: ${erro}`);
  }

  return resposta.json();
}

async function listarPermissoesGestao(context) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/rest/v1/informatica_gestao_permissoes?select=profile_id,ativo`, {
    method: 'GET',
    headers: adminHeaders(context, { Accept: 'application/json' })
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao listar permissões de gestão: ${erro}`);
  }

  return resposta.json();
}

function montarUsuario(authUser, profile, permissao) {
  const metadata = authUser.user_metadata || authUser.raw_user_meta_data || {};
  return {
    id: authUser.id,
    email: authUser.email || profile?.email || '',
    nome: profile?.nome || metadata.full_name || metadata.name || authUser.email || '',
    ativo: typeof profile?.ativo === 'boolean' ? profile.ativo : true,
    acesso_gestao: permissao?.ativo === true,
    created_at: profile?.created_at || authUser.created_at || null,
    updated_at: profile?.updated_at || null,
    last_sign_in_at: authUser.last_sign_in_at || null,
    email_confirmed_at: authUser.email_confirmed_at || null
  };
}

async function listarUsuarios(context, searchParams) {
  const [authUsers, profiles, permissoes] = await Promise.all([
    listarAuthUsers(context),
    listarProfiles(context),
    listarPermissoesGestao(context)
  ]);

  const profileMap = new Map((profiles || []).map((item) => [item.id, item]));
  const permMap = new Map((permissoes || []).map((item) => [item.profile_id, item]));

  let usuarios = authUsers.map((authUser) => montarUsuario(authUser, profileMap.get(authUser.id) || null, permMap.get(authUser.id) || null));

  const q = limparTexto(searchParams.get('q')).toLowerCase();
  const ativo = limparTexto(searchParams.get('ativo'));
  const acessoGestao = limparTexto(searchParams.get('acesso_gestao'));

  if (q) {
    usuarios = usuarios.filter((usuario) =>
      (usuario.nome || '').toLowerCase().includes(q) ||
      (usuario.email || '').toLowerCase().includes(q)
    );
  }

  if (ativo === 'true' || ativo === 'false') {
    const valor = ativo === 'true';
    usuarios = usuarios.filter((usuario) => usuario.ativo === valor);
  }

  if (acessoGestao === 'true' || acessoGestao === 'false') {
    const valor = acessoGestao === 'true';
    usuarios = usuarios.filter((usuario) => usuario.acesso_gestao === valor);
  }

  usuarios.sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, 'pt-BR'));
  return usuarios;
}

async function upsertProfile(context, payload) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: adminHeaders(context, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    }),
    body: JSON.stringify([payload])
  });

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
      body: JSON.stringify([{ profile_id: profileId, ativo }])
    }
  );

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao gravar permissão de gestão: ${erro}`);
  }

  const retorno = await resposta.json();
  return Array.isArray(retorno) ? (retorno[0] || null) : retorno;
}

async function criarUsuarioAuth(context, body) {
  const resposta = await fetch(`${context.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(context, {
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify({
      email: body.email,
      password: body.senha,
      email_confirm: true,
      user_metadata: {
        name: body.nome,
        full_name: body.nome
      }
    })
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao criar usuário no Auth: ${erro}`);
  }

  return resposta.json();
}

async function atualizarUsuarioAuth(context, id, body) {
  const payload = {
    user_metadata: {
      name: body.nome,
      full_name: body.nome
    }
  };

  if (limparTexto(body.senha)) {
    payload.password = body.senha;
  }

  const resposta = await fetch(`${context.env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: adminHeaders(context, {
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(payload)
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro ao atualizar usuário no Auth: ${erro}`);
  }

  return resposta.json();
}

function validarBodyCriacao(body) {
  const nome = limparTexto(body.nome);
  const email = limparTexto(body.email).toLowerCase();
  const senha = limparTexto(body.senha);

  if (!nome) throw new Error('Informe o nome do usuário.');
  if (!email) throw new Error('Informe o e-mail do usuário.');
  if (!senha) throw new Error('Informe a senha inicial do usuário.');

  return {
    nome,
    email,
    senha,
    ativo: body.ativo !== false,
    acesso_gestao: body.acesso_gestao === true
  };
}

function validarBodyAtualizacao(body) {
  const id = limparTexto(body.id);
  const nome = limparTexto(body.nome);

  if (!id) throw new Error('ID do usuário não informado.');
  if (!nome) throw new Error('Informe o nome do usuário.');

  return {
    id,
    nome,
    senha: limparTexto(body.senha),
    ativo: body.ativo !== false,
    acesso_gestao: body.acesso_gestao === true
  };
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
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de usuários.' }, { status: 403 });
    }

    const url = new URL(context.request.url);
    if (url.searchParams.get('check_access') === '1') {
      return Response.json({ ok: true, permitido: true });
    }

    const usuarios = await listarUsuarios(context, url.searchParams);
    return Response.json({ ok: true, usuarios, total: usuarios.length });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || 'Erro ao consultar usuários.' }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const usuario = await validarUsuario(context);
    const perfil = await buscarPerfil(context, usuario.id);

    if (perfil && perfil.ativo === false) {
      return Response.json({ ok: false, message: 'Usuário inativo.' }, { status: 403 });
    }

    const permitido = await validarAcessoGestao(context, usuario, perfil);
    if (!permitido) {
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de usuários.' }, { status: 403 });
    }

    const body = validarBodyCriacao(await context.request.json());
    const authUser = await criarUsuarioAuth(context, body);

    await upsertProfile(context, {
      id: authUser.id,
      nome: body.nome,
      email: body.email,
      ativo: body.ativo
    });

    await upsertPermissaoGestao(context, authUser.id, body.acesso_gestao);

    return Response.json({ ok: true, message: 'Usuário criado com sucesso.' });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || 'Erro ao criar usuário.' }, { status: 500 });
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
      return Response.json({ ok: false, message: 'Acesso restrito à gestão de usuários.' }, { status: 403 });
    }

    const body = validarBodyAtualizacao(await context.request.json());
    const profileAtual = await buscarPerfil(context, body.id);
    const email = limparTexto(profileAtual?.email);
    if (!email) throw new Error('E-mail do usuário não encontrado no profile.');

    await atualizarUsuarioAuth(context, body.id, body);

    await upsertProfile(context, {
      id: body.id,
      nome: body.nome,
      email,
      ativo: body.ativo
    });

    await upsertPermissaoGestao(context, body.id, body.acesso_gestao);

    return Response.json({ ok: true, message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || 'Erro ao atualizar usuário.' }, { status: 500 });
  }
}
