function normalizarTexto(valor) {
  return (valor || '').toString().trim();
}

function mapTipo(tipo) {
  if (tipo === 'computador') return [{ endpoint: 'Computer', label: 'Computador' }];
  if (tipo === 'monitor') return [{ endpoint: 'Monitor', label: 'Monitor' }];
  if (tipo === 'impressora') return [{ endpoint: 'Printer', label: 'Impressora' }];
  if (tipo === 'telefone') return [{ endpoint: 'Phone', label: 'Telefone' }];

  return [
    { endpoint: 'Computer', label: 'Computador' },
    { endpoint: 'Monitor', label: 'Monitor' },
    { endpoint: 'Printer', label: 'Impressora' },
    { endpoint: 'Phone', label: 'Telefone' } // 👈 NOVO
  ];
}

async function iniciarSessao(env) {
  const resposta = await fetch(`${env.GLPI_URL}/initSession`, {
    method: 'GET',
    headers: {
      'App-Token': env.GLPI_APP_TOKEN,
      Authorization: `user_token ${env.GLPI_USER_TOKEN}`
    }
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro ao iniciar sessão no GLPI: ${texto}`);
  }

  const data = await resposta.json();
  if (!data.session_token) {
    throw new Error('GLPI não retornou session_token.');
  }

  return data.session_token;
}

async function encerrarSessao(env, sessionToken) {
  if (!sessionToken) return;

  await fetch(`${env.GLPI_URL}/killSession`, {
    method: 'GET',
    headers: {
      'App-Token': env.GLPI_APP_TOKEN,
      'Session-Token': sessionToken
    }
  }).catch(() => {});
}

async function buscarAtivosPorTipo(env, sessionToken, endpoint, label) {
  const resposta = await fetch(`${env.GLPI_URL}/${endpoint}?range=0-999`, {
    method: 'GET',
    headers: {
      'App-Token': env.GLPI_APP_TOKEN,
      'Session-Token': sessionToken
    }
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro ao consultar ${label}: ${texto}`);
  }

  const data = await resposta.json();

  return (Array.isArray(data) ? data : []).map((item) => ({
    tipo: label,
    nome: normalizarTexto(item.name),
    serial: normalizarTexto(item.serial),
    status: normalizarTexto(item.states_id),
    localizacao: normalizarTexto(item.locations_id)
  }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const tipo = normalizarTexto(url.searchParams.get('tipo')) || 'todos';
  const busca = normalizarTexto(url.searchParams.get('busca')).toLowerCase();

  let sessionToken = null;

  try {
    sessionToken = await iniciarSessao(env);

    const tipos = mapTipo(tipo);
    let ativos = [];

    for (const item of tipos) {
      const lista = await buscarAtivosPorTipo(env, sessionToken, item.endpoint, item.label);
      ativos = ativos.concat(lista);
    }

    if (busca) {
      ativos = ativos.filter((item) =>
        item.nome.toLowerCase().includes(busca) ||
        item.serial.toLowerCase().includes(busca)
      );
    }

    ativos.sort((a, b) => {
      const nomeA = a.nome || '';
      const nomeB = b.nome || '';
      return nomeA.localeCompare(nomeB, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });

    return Response.json({
      ok: true,
      total: ativos.length,
      data: ativos
    });
  } catch (error) {
    return Response.json({
      ok: false,
      message: error.message || 'Erro ao consultar ativos do GLPI.'
    }, { status: 500 });
  } finally {
    await encerrarSessao(env, sessionToken);
  }
}