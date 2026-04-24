function normalizarTexto(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (typeof valor === 'object') {
    if (valor.name) return String(valor.name).trim();
    if (valor.completename) return String(valor.completename).trim();
    if (valor.value) return String(valor.value).trim();
    return '';
  }
  return String(valor).trim();
}

function primeiroTexto(...valores) {
  for (const valor of valores) {
    const texto = normalizarTexto(valor);
    if (texto) return texto;
  }
  return '-';
}

function primeiroValor(...valores) {
  for (const valor of valores) {
    if (valor !== null && valor !== undefined && valor !== '') return valor;
  }
  return null;
}

function mapTipo(tipo) {
  if (tipo === 'computador') return [{ endpoint: 'Computer', label: 'Computador', tipo: 'computador' }];
  if (tipo === 'monitor') return [{ endpoint: 'Monitor', label: 'Monitor', tipo: 'monitor' }];
  if (tipo === 'impressora') return [{ endpoint: 'Printer', label: 'Impressora', tipo: 'impressora' }];
  if (tipo === 'telefone') return [{ endpoint: 'Phone', label: 'Telefone', tipo: 'telefone' }];

  return [
    { endpoint: 'Computer', label: 'Computador', tipo: 'computador' },
    { endpoint: 'Monitor', label: 'Monitor', tipo: 'monitor' },
    { endpoint: 'Printer', label: 'Impressora', tipo: 'impressora' },
    { endpoint: 'Phone', label: 'Telefone', tipo: 'telefone' }
  ];
}

function getTipoPorLabel(label) {
  const valor = normalizarTexto(label).toLowerCase();
  if (valor === 'computador') return { endpoint: 'Computer', label: 'Computador', tipo: 'computador' };
  if (valor === 'monitor') return { endpoint: 'Monitor', label: 'Monitor', tipo: 'monitor' };
  if (valor === 'impressora') return { endpoint: 'Printer', label: 'Impressora', tipo: 'impressora' };
  if (valor === 'telefone') return { endpoint: 'Phone', label: 'Telefone', tipo: 'telefone' };
  return null;
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

async function glpiGet(env, sessionToken, path) {
  const separador = path.includes('?') ? '&' : '?';
  const resposta = await fetch(`${env.GLPI_URL}/${path}${separador}expand_dropdowns=true`, {
    method: 'GET',
    headers: {
      'App-Token': env.GLPI_APP_TOKEN,
      'Session-Token': sessionToken
    }
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro ao consultar GLPI (${path}): ${texto}`);
  }

  return resposta.json();
}

async function glpiGetOpcional(env, sessionToken, path) {
  try {
    return await glpiGet(env, sessionToken, path);
  } catch (_) {
    return null;
  }
}

function extrairNomeRelacao(valor) {
  if (!valor) return '';
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor).trim();
  if (Array.isArray(valor)) {
    const primeiro = valor[0];
    return extrairNomeRelacao(primeiro);
  }
  return normalizarTexto(valor.name || valor.completename || valor.value || valor.id);
}

function extrairIpDeObjeto(item) {
  const candidatos = [
    item.ip,
    item.ip_address,
    item.ipaddresses_id,
    item.address,
    item.addresses,
    item.networkports_id,
    item.networks,
    item.NetworkPort,
    item.networkport
  ];

  for (const candidato of candidatos) {
    if (!candidato) continue;
    if (typeof candidato === 'string' || typeof candidato === 'number') {
      const texto = String(candidato).trim();
      if (texto && texto !== '0') return texto;
    }
    if (Array.isArray(candidato)) {
      for (const sub of candidato) {
        const ip = extrairIpDeObjeto(sub || {});
        if (ip && ip !== '-') return ip;
      }
    }
    if (typeof candidato === 'object') {
      const ip = extrairIpDeObjeto(candidato);
      if (ip && ip !== '-') return ip;
    }
  }

  return '';
}

function extrairTextoLista(lista, camposPreferidos = []) {
  if (!Array.isArray(lista) || !lista.length) return '';

  return lista
    .map((item) => {
      if (!item) return '';
      for (const campo of camposPreferidos) {
        const texto = normalizarTexto(item[campo]);
        if (texto) return texto;
      }
      return primeiroTexto(item.designation, item.name, item.type, item.serial, item.id);
    })
    .filter(Boolean)
    .join(', ');
}

function normalizarAtivo(item, endpoint, label, tipoInterno) {
  return {
    id: item.id,
    endpoint,
    tipo_interno: tipoInterno,
    tipo: label,
    nome: primeiroTexto(item.name),
    serial: primeiroTexto(item.serial, item.otherserial),
    status: primeiroTexto(item.states_id, item.state_name),
    localizacao: primeiroTexto(item.locations_id, item.location_name),
    entidade: primeiroTexto(item.entities_id, item.entity_name)
  };
}

async function buscarAtivosPorTipo(env, sessionToken, endpoint, label, tipoInterno) {
  const data = await glpiGet(env, sessionToken, `${endpoint}?range=0-999`);

  return (Array.isArray(data) ? data : []).map((item) => normalizarAtivo(item, endpoint, label, tipoInterno));
}

async function buscarIp(env, sessionToken, endpoint, id, itemCompleto) {
  const ipDireto = extrairIpDeObjeto(itemCompleto || {});
  if (ipDireto) return ipDireto;

  const portas = await glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/NetworkPort`);
  const ipPortas = extrairIpDeObjeto(portas || {});
  if (ipPortas) return ipPortas;

  return '-';
}

async function buscarDetalhesHardware(env, sessionToken, endpoint, id) {
  const [processadores, memorias, discos] = await Promise.all([
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceProcessor`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceMemory`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceHardDrive`)
  ]);

  return {
    processador: extrairTextoLista(processadores, ['designation', 'name', 'deviceprocessors_id']) || '-',
    memoria: extrairTextoLista(memorias, ['designation', 'name', 'size', 'devicememories_id']) || '-',
    armazenamento: extrairTextoLista(discos, ['designation', 'name', 'capacity', 'deviceharddrives_id']) || '-'
  };
}

async function buscarDetalheAtivo(env, sessionToken, tipo, id) {
  const tipoInfo = getTipoPorLabel(tipo) || mapTipo(tipo)[0];
  if (!tipoInfo || !id) throw new Error('Tipo ou ID inválido para detalhe do ativo.');

  const item = await glpiGet(env, sessionToken, `${tipoInfo.endpoint}/${id}`);
  const base = normalizarAtivo(item, tipoInfo.endpoint, tipoInfo.label, tipoInfo.tipo);

  if (tipoInfo.tipo === 'computador') {
    const hardware = await buscarDetalhesHardware(env, sessionToken, tipoInfo.endpoint, id);
    return {
      ...base,
      ip: await buscarIp(env, sessionToken, tipoInfo.endpoint, id, item),
      sistema: primeiroTexto(item.operatingsystems_id, item.operatingsystem_name, item.os, item.os_name),
      processador: primeiroTexto(item.cpu, item.processors_id, hardware.processador),
      memoria: primeiroTexto(item.memory, item.ram, hardware.memoria),
      armazenamento: primeiroTexto(item.disk, item.storage, hardware.armazenamento),
      fabricante: primeiroTexto(item.manufacturers_id),
      modelo: primeiroTexto(item.computermodels_id, item.model)
    };
  }

  if (tipoInfo.tipo === 'telefone') {
    return {
      ...base,
      ip: await buscarIp(env, sessionToken, tipoInfo.endpoint, id, item),
      sistema: primeiroTexto(item.operatingsystems_id, item.operatingsystem_name, item.os, item.os_name)
    };
  }

  if (tipoInfo.tipo === 'monitor') {
    return {
      ...base,
      modelo: primeiroTexto(item.monitormodels_id, item.model, item.models_id),
      fabricante: primeiroTexto(item.manufacturers_id),
      computador: primeiroTexto(
        item.computers_id,
        item.computer_name,
        item.items_id,
        item.item_name,
        extrairNomeRelacao(item.Computer)
      )
    };
  }

  if (tipoInfo.tipo === 'impressora') {
    return {
      ...base,
      fabricante: primeiroTexto(item.manufacturers_id),
      modelo: primeiroTexto(item.printermodels_id, item.model, item.models_id),
      ip: await buscarIp(env, sessionToken, tipoInfo.endpoint, id, item)
    };
  }

  return base;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const tipo = normalizarTexto(url.searchParams.get('tipo')) || 'todos';
  const busca = normalizarTexto(url.searchParams.get('busca')).toLowerCase();
  const detalhe = url.searchParams.get('detalhe') === '1';
  const detalheId = normalizarTexto(url.searchParams.get('id'));
  const detalheTipo = normalizarTexto(url.searchParams.get('tipo_ativo'));

  let sessionToken = null;

  try {
    sessionToken = await iniciarSessao(env);

    if (detalhe) {
      const item = await buscarDetalheAtivo(env, sessionToken, detalheTipo || tipo, detalheId);
      return Response.json({ ok: true, data: item });
    }

    const tipos = mapTipo(tipo);
    let ativos = [];

    for (const item of tipos) {
      const lista = await buscarAtivosPorTipo(env, sessionToken, item.endpoint, item.label, item.tipo);
      ativos = ativos.concat(lista);
    }

    if (busca) {
      ativos = ativos.filter((item) =>
        item.nome.toLowerCase().includes(busca) ||
        item.serial.toLowerCase().includes(busca) ||
        item.localizacao.toLowerCase().includes(busca) ||
        item.entidade.toLowerCase().includes(busca)
      );
    }

    ativos.sort((a, b) => {
      const nomeA = a.nome || '';
      const nomeB = b.nome || '';
      return nomeA.localeCompare(nomeB, 'pt-BR', {
        numeric: true,
        sensitivity: 'base'
      });
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
