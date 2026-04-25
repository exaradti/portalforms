function normalizarTexto(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  if (typeof valor === 'object') {
    if (valor.name) return String(valor.name).trim();
    if (valor.completename) return String(valor.completename).trim();
    if (valor.value) return String(valor.value).trim();
    if (valor.content) return String(valor.content).trim();
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

function textoValido(valor) {
  const texto = normalizarTexto(valor);

  if (!texto || texto === '0' || texto === '-') return '';
  if (texto.includes('apirest.php')) return '';
  if (texto.includes('http://') || texto.includes('https://')) return '';
  if (texto.length > 120) return '';

  return texto;
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

function ipValido(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;

  const partes = ip.split('.').map(Number);
  if (partes.some((parte) => parte < 0 || parte > 255)) return false;

  if (partes[3] === 0 || partes[3] === 255) return false;

  return true;
}

function extrairIpsDeObjeto(obj, encontrados = new Set(), redes = new Set()) {
  if (!obj) return { encontrados, redes };

  if (typeof obj === 'string' || typeof obj === 'number') {
    const texto = String(obj).trim();
    const matches = texto.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);

    if (matches) {
      matches.forEach((ip) => {
        if (ipValido(ip)) encontrados.add(ip);
        else redes.add(ip);
      });
    }

    return { encontrados, redes };
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => extrairIpsDeObjeto(item, encontrados, redes));
    return { encontrados, redes };
  }

  if (typeof obj === 'object') {
    Object.values(obj).forEach((valor) => extrairIpsDeObjeto(valor, encontrados, redes));
  }

  return { encontrados, redes };
}

function numeroParaGB(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  const texto = String(valor).replace(',', '.').trim();
  const numero = Number(texto);

  if (!Number.isFinite(numero) || numero <= 0) return '';

  let gb;

  if (numero > 1073741824) {
    gb = numero / 1073741824;
  } else if (numero > 1048576) {
    gb = numero / 1048576;
  } else if (numero >= 1024) {
    gb = numero / 1024;
  } else {
    gb = numero;
  }

  const arredondado = Math.round(gb * 10) / 10;
  return `${arredondado.toLocaleString('pt-BR')} GB`;
}

function valorNumericoCampo(item, campo) {
  const bruto = item?.[campo];
  if (bruto === null || bruto === undefined || bruto === '') return 0;

  const valor = Number(String(bruto).replace(',', '.'));
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

function somarCampoNumerico(lista, campos = []) {
  if (!Array.isArray(lista)) return 0;

  return lista.reduce((total, item) => {
    if (!item) return total;

    for (const campo of campos) {
      const valor = valorNumericoCampo(item, campo);
      if (valor > 0) return total + valor;
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
  const coletados = new Set();
  const redes = new Set();

  extrairIpsDeObjeto(itemCompleto, coletados, redes);

  const portas = await glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/NetworkPort`);
  extrairIpsDeObjeto(portas, coletados, redes);

  if (Array.isArray(portas)) {
    for (const porta of portas) {
      const portaId = porta?.id;
      if (!portaId) continue;

      const nomesRede = await glpiGetOpcional(env, sessionToken, `NetworkPort/${portaId}/NetworkName`);
      extrairIpsDeObjeto(nomesRede, coletados, redes);

      if (Array.isArray(nomesRede)) {
        for (const nomeRede of nomesRede) {
          const nomeRedeId = nomeRede?.id;
          if (!nomeRedeId) continue;

          const ipsRede = await glpiGetOpcional(env, sessionToken, `NetworkName/${nomeRedeId}/IPAddress`);
          extrairIpsDeObjeto(ipsRede, coletados, redes);
        }
      }
    }
  }

  const ipsDireto = await glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/IPAddress`);
  extrairIpsDeObjeto(ipsDireto, coletados, redes);

  if (coletados.size) return Array.from(coletados).join(', ');
  if (redes.size) return Array.from(redes).join(', ');

  return '-';
}

async function buscarSistemaOperacional(env, sessionToken, endpoint, id, item) {
  const direto = primeiroTexto(
    item.operatingsystems_id,
    item.operatingsystem_name,
    item.operatingsystem,
    item.operatingsystemversions_id,
    item.operatingsystem_version,
    item.operatingsystemservicepacks_id,
    item.os,
    item.os_name
  );

  if (direto !== '-') return direto;

  const relacoes = await glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_OperatingSystem`);

  if (Array.isArray(relacoes) && relacoes.length) {
    const nomes = relacoes
      .map((os) => primeiroTexto(
        os.operatingsystems_id,
        os.operating_system,
        os.operatingsystem_name,
        os.name,
        os.version,
        os.operatingsystemversions_id,
        os.operatingsystemservicepacks_id,
        os.operatingsystemarchitectures_id
      ))
      .filter((x) => x && x !== '-');

    if (nomes.length) return nomes.join(', ');
  }

  return '-';
}

function extrairCapacidadeDisco(item) {
  if (!item) return 0;

  const camposDiretos = [
    'capacity',
    'size',
    'totalsize',
    'total_size',
    'disksize',
    'logical_volume_size',
    'harddrive_size',
    'storage',
    'bytes',
    'disk_size',
    'volumesize',
    'volume_size'
  ];

  for (const campo of camposDiretos) {
    const valor = valorNumericoCampo(item, campo);
    if (valor > 0) return valor;
  }

  const texto = [
    item.name,
    item.designation,
    item.comment,
    item.deviceharddrives_id,
    item.devicestorages_id,
    item.type
  ].map(normalizarTexto).join(' ');

  const match = texto.match(/(\d+(?:[\.,]\d+)?)\s*(tb|tib|gb|gib|mb|mib)/i);
  if (!match) return 0;

  const numero = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) return 0;

  const unidade = match[2].toLowerCase();
  if (unidade === 'tb' || unidade === 'tib') return numero * 1024;
  if (unidade === 'gb' || unidade === 'gib') return numero;
  if (unidade === 'mb' || unidade === 'mib') return numero;

  return 0;
}

function somarDiscos(lista) {
  if (!Array.isArray(lista)) return 0;
  return lista.reduce((total, item) => total + extrairCapacidadeDisco(item), 0);
}

function juntarListas(...listas) {
  return listas.flatMap((lista) => Array.isArray(lista) ? lista : []);
}

function textoCpuValido(texto) {
  const valor = textoValido(texto);
  if (!valor) return '';

  const lower = valor.toLowerCase();

  if (!lower.includes('intel') && !lower.includes('amd') && !lower.includes('celeron') && !lower.includes('ryzen')) {
    return '';
  }

  if (lower.includes('http') || lower.includes('apirest') || lower.includes('entity')) return '';
  if (valor.length > 90) return '';

  return valor;
}

function extrairProcessadores(processadores) {
  if (!Array.isArray(processadores)) return '-';

  const encontrados = new Set();

  for (const item of processadores) {
    const candidatos = [
      item?.designation,
      item?.name,
      item?.deviceprocessors_id,
      item?.comment
    ];

    for (const candidato of candidatos) {
      const texto = textoCpuValido(candidato);
      if (texto) encontrados.add(texto);
    }
  }

  return Array.from(encontrados).slice(0, 2).join(', ') || '-';
}

async function buscarDetalhesHardware(env, sessionToken, endpoint, id) {
  const [
    processadores,
    memorias,
    discosHardDrive,
    discosStorage,
    discosDrive,
    discosDisk,
    discosVolume
  ] = await Promise.all([
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceProcessor`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceMemory`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceHardDrive`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceStorage`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_DeviceDrive`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Disk`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Volume`)
  ]);

  const discosFisicos = juntarListas(discosHardDrive, discosStorage, discosDrive);
  const discosLogicos = juntarListas(discosDisk, discosVolume);

  const memoriaTotal = somarCampoNumerico(memorias, [
    'size',
    'capacity',
    'memory',
    'total',
    'totalsize',
    'total_size'
  ]);

  const discoFisicoTotal = somarDiscos(discosFisicos);
  const discoLogicoTotal = somarDiscos(discosLogicos);
  const discoTotal = discoFisicoTotal || discoLogicoTotal;

  return {
    processador: extrairProcessadores(processadores),

    memoria: memoriaTotal
      ? numeroParaGB(memoriaTotal)
      : '-',

    armazenamento: discoTotal
      ? numeroParaGB(discoTotal)
      : '-'
  };
}

function nomeComputadorValido(nome) {
  const texto = textoValido(nome);
  if (!texto) return '';

  if (texto.includes('>')) return '';
  if (texto.includes(',')) return '';
  if (texto.length > 60) return '';

  if (/^EXARADPC/i.test(texto)) return texto;
  if (/^DESKTOP-/i.test(texto)) return texto;
  if (/^NOTE/i.test(texto)) return texto;
  if (/^PC[-_A-Z0-9]/i.test(texto)) return texto;

  return '';
}

function extrairNomesComputadoresDasConexoes(obj) {
  const nomes = new Set();

  function visitar(valor) {
    if (!valor) return;

    if (Array.isArray(valor)) {
      valor.forEach(visitar);
      return;
    }

    if (typeof valor !== 'object') return;

    const candidatos = [
      valor.name,
      valor.computer_name,
      valor.item_name,
      valor.items_name
    ];

    for (const candidato of candidatos) {
      const nome = nomeComputadorValido(candidato);
      if (nome) nomes.add(nome);
    }

    if (valor.itemtype === 'Computer' || valor.itemtype_1 === 'Computer' || valor.itemtype_2 === 'Computer') {
      const nome = nomeComputadorValido(valor.name || valor.item_name || valor.items_name);
      if (nome) nomes.add(nome);
    }

    Object.values(valor).forEach(visitar);
  }

  visitar(obj);

  return Array.from(nomes).join(', ');
}

async function buscarComputadorRelacionado(env, sessionToken, endpoint, id, item) {
  const idDireto = normalizarTexto(item.computers_id || item.computer_id);

  if (idDireto && idDireto !== '0' && /^\d+$/.test(idDireto)) {
    const computador = await glpiGetOpcional(env, sessionToken, `Computer/${idDireto}`);
    const nome = nomeComputadorValido(computador?.name);
    if (nome) return nome;
  }

  const nomeDireto = nomeComputadorValido(item.computer_name || item.item_name);
  if (nomeDireto) return nomeDireto;

  const conexoes = await Promise.all([
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Computer`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Connection`),
    glpiGetOpcional(env, sessionToken, `${endpoint}/${id}/Item_Computer`)
  ]);

  const nome = extrairNomesComputadoresDasConexoes(conexoes);
  return nome || '-';
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
      sistema: await buscarSistemaOperacional(env, sessionToken, tipoInfo.endpoint, id, item),
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
      sistema: await buscarSistemaOperacional(env, sessionToken, tipoInfo.endpoint, id, item),
      fabricante: primeiroTexto(item.manufacturers_id),
      modelo: primeiroTexto(item.phonemodels_id, item.model)
    };
  }

  if (tipoInfo.tipo === 'monitor') {
    return {
      ...base,
      modelo: primeiroTexto(item.monitormodels_id, item.model, item.models_id),
      fabricante: primeiroTexto(item.manufacturers_id),
      computador: await buscarComputadorRelacionado(env, sessionToken, tipoInfo.endpoint, id, item)
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
