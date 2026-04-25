function normalizarTexto(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  if (typeof valor === 'object') {
    if (valor.name) return String(valor.name).trim();
    if (valor.completename) return String(valor.completename).trim();
    if (valor.value) return String(valor.value).trim();
    if (valor.id) return String(valor.id).trim();
    return '';
  }

  return String(valor).trim();
}

function primeiroTexto(...valores) {
  for (const valor of valores) {
    const texto = normalizarTexto(valor);
    if (texto && texto !== '0') return texto;
  }
  return '-';
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

function extrairIpDeObjeto(obj) {
  if (!obj) return '';

  if (typeof obj === 'string' || typeof obj === 'number') {
    const texto = String(obj).trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(texto)) return texto;
    return '';
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const ip = extrairIpDeObjeto(item);
      if (ip) return ip;
    }
    return '';
  }

  if (typeof obj === 'object') {
    const camposIp = [
      'ip',
      'ip_address',
      'address',
      'name',
      'value'
    ];

    for (const campo of camposIp) {
      const valor = obj[campo];
      if (typeof valor === 'string' || typeof valor === 'number') {
        const texto = String(valor).trim();
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(texto)) return texto;
      }
    }

    for (const valor of Object.values(obj)) {
      const ip = extrairIpDeObjeto(valor);
      if (ip) return ip;
    }
  }

  return '';
}

function numeroParaGB(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  const texto = String(valor).replace(',', '.').trim();
  const numero = Number(texto);

  if (!Number.isFinite(numero) || numero <= 0) return '';

  const gb = numero >= 1024 ? numero / 1024 : numero;
  const arredondado = Math.round(gb * 10) / 10;

  return `${arredondado.toLocaleString('pt-BR')} GB`;
}

function extrairTextoLista(lista, camposPreferidos = []) {
  if (!Array.isArray(lista) || !lista.length) return '';

  return lista
    .map((item) => {
      if (!item) return '';

      for (const campo of camposPreferidos) {
        const texto = normalizarTexto(item[campo]);
        if (texto && texto !== '0') return texto;
      }

      return primeiroTexto(item.designation, item.name, item.type, item.serial, item.id);
    })
    .filter(Boolean)
    .join(', ');
}

function somarCampoNumerico(lista, campos = []) {
  if (!Array.isArray(lista)) return 0;

  return lista.reduce((total, item) => {
    if (!item) return total;

    for (const campo of campos) {
      const valor = Number(String(item[campo] ?? '').replace(',', '.'));
      if (Number.isFinite(valor) && valor > 0) return total + valor;
    }

    return total;
  }, 0);
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

  return (Array.isArray(data) ? data : [])
    .map((item) => normalizarAtivo(item, endpoint, label, tipoInterno));
}

async function buscarIp(env, sessionToken, endpoint, id, itemCompleto) {
  const ipDireto = extrairIpDeObjeto(itemCompleto);
  if (ipDireto) return ipDireto;

  const portas = await glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/NetworkPort`);
  const ipPortas = extrairIpDeObjeto(portas);
  if (ipPortas) return ipPortas;

  const ips = await glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/IPAddress`);
  const ipIps = extrairIpDeObjeto(ips);
  if (ipIps) return ipIps;

  return '-';
}

async function buscarDetalhesHardware(env, sessionToken, endpoint, id) {
  const [processadores, memorias, discos] = await Promise.all([
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceProcessor`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceMemory`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceHardDrive`)
  ]);

  const memoriaTotal = somarCampoNumerico(memorias, ['size', 'capacity']);
  const discoTotal = somarCampoNumerico(discos, ['capacity', 'size']);

  return {
    processador: extrairTextoLista(processadores, ['designation', 'name', 'deviceprocessors_id']) || '-',
    memoria: memoriaTotal ? numeroParaGB(memoriaTotal) : (extrairTextoLista(memorias, ['size', 'capacity', 'designation', 'name']) || '-'),
    armazenamento: discoTotal ? numeroParaGB(discoTotal) : (extrairTextoLista(discos, ['capacity', 'size', 'designation', 'name']) || '-')
  };
}

async function buscarComputadorRelacionado(env, sessionToken, item) {
  const idComputador = normalizarTexto(item.computers_id || item.computer_id || item.items_id);
  if (!idComputador || idComputador === '0') {
    return primeiroTexto(item.computer_name, item.item_name);
  }

  const computador = await glpiGetOpcional(env, sessionToken, `Computer/${idComputador}`);
  return primeiroTexto(computador?.name, item.computer_name, item.item_name, idComputador);
}

async function buscarDetalheAtivo(env, sessionToken, tipo, id) {
  const tipoInfo = getTipoPorLabel(tipo) || mapTipo(tipo)[0];

  if (!tipoInfo || !id) {
    throw new Error('Tipo ou ID inválido para detalhe do ativo.');
  }

  const item = await glpiGet(env, sessionToken, `${tipoInfo.endpoint}/${id}`);
  const base = normalizarAtivo(item, tipoInfo.endpoint, tipoInfo.label, tipoInfo.tipo);

  if (tipoInfo.tipo === 'computador') {
    const hardware = await buscarDetalhesHardware(env, sessionToken, tipoInfo.endpoint, id);

    return {
      ...base,
      ip: await buscarIp(env, sessionToken, tipoInfo.endpoint, id, item),
      sistema: primeiroTexto(item.operatingsystems_id, item.operatingsystem_name, item.os, item.os_name),
      processador: primeiroTexto(item.cpu, item.processors_id, hardware.processador),
      memoria: primeiroTexto(numeroParaGB(item.memory), numeroParaGB(item.ram), hardware.memoria),
      armazenamento: primeiroTexto(numeroParaGB(item.disk), numeroParaGB(item.storage), hardware.armazenamento),
      fabricante: primeiroTexto(item.manufacturers_id),
      modelo: primeiroTexto(item.computermodels_id, item.model)
    };
  }

  if (tipoInfo.tipo === 'telefone') {
    return {
      ...base,
      ip: await buscarIp(env, sessionToken, tipoInfo.endpoint, id, item),
      sistema: primeiroTexto(item.operatingsystems_id, item.operatingsystem_name, item.os, item.os_name),
      fabricante: primeiroTexto(item.manufacturers_id),
      modelo: primeiroTexto(item.phonemodels_id, item.model)
    };
  }

  if (tipoInfo.tipo === 'monitor') {
    return {
      ...base,
      modelo: primeiroTexto(item.monitormodels_id, item.model, item.models_id),
      fabricante: primeiroTexto(item.manufacturers_id),
      computador: await buscarComputadorRelacionado(env, sessionToken, item)
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
