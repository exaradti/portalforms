import { requireAuth } from '/assets/supabase-auth.js';

const tabela = document.getElementById('tabela');
const btnBuscar = document.getElementById('btnBuscar');
const tipoEl = document.getElementById('tipo');
const buscaEl = document.getElementById('busca');
const ordenacaoEl = document.getElementById('ordenacao');
const resumoEl = document.getElementById('resumoResultados');
const paginacaoEl = document.getElementById('paginacao');
const modalAtivo = document.getElementById('modalAtivo');
const modalAtivoBody = document.getElementById('modalAtivoBody');
const modalAtivoTitulo = document.getElementById('modalAtivoTitulo');
const btnFecharModal = document.getElementById('btnFecharModal');

let listaAtual = [];
let paginaAtual = 1;
const itensPorPagina = 50;

function escaparHtml(valor) {
  return (valor ?? '-')
    .toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ordenarLista(lista) {
  const tipo = ordenacaoEl?.value || 'asc';

  return [...lista].sort((a, b) => {
    const nomeA = a.nome || '';
    const nomeB = b.nome || '';

    const resultado = nomeA.localeCompare(nomeB, 'pt-BR', {
      numeric: true,
      sensitivity: 'base'
    });

    return tipo === 'asc' ? resultado : resultado * -1;
  });
}

function classeStatus(status) {
  const valor = (status || '').toString().toLowerCase();

  if (valor.includes('ativo') || valor.includes('uso')) return 'status--ativo';
  if (valor.includes('inativo') || valor.includes('fora')) return 'status--inativo';
  if (valor.includes('manutenção') || valor.includes('manutencao')) return 'status--manutencao';

  return 'status--neutro';
}

function rolarParaResultados() {
  document.querySelector('.results-shell')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function renderLoading() {
  tabela.innerHTML = '<tr><td colspan="6" class="glpi-loading">Carregando ativos do GLPI...</td></tr>';
  if (resumoEl) resumoEl.textContent = 'Carregando ativos...';
  if (paginacaoEl) paginacaoEl.innerHTML = '';
}

function renderEmpty() {
  tabela.innerHTML = '<tr><td colspan="6" class="glpi-empty">Nenhum ativo encontrado.</td></tr>';
  if (resumoEl) resumoEl.textContent = '0 ativos encontrados';
  if (paginacaoEl) paginacaoEl.innerHTML = '';
}

function renderErro(msg) {
  tabela.innerHTML = `<tr><td colspan="6" class="glpi-empty">${escaparHtml(msg)}</td></tr>`;
  if (resumoEl) resumoEl.textContent = 'Erro ao carregar ativos';
  if (paginacaoEl) paginacaoEl.innerHTML = '';
}

function getListaPaginada(lista) {
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  return lista.slice(inicio, fim);
}

function renderResumo(total) {
  if (!resumoEl) return;

  if (!total) {
    resumoEl.textContent = '0 ativos encontrados';
    return;
  }

  const inicio = (paginaAtual - 1) * itensPorPagina + 1;
  const fim = Math.min(paginaAtual * itensPorPagina, total);

  resumoEl.textContent = `Mostrando ${inicio}–${fim} de ${total} ativo(s)`;
}

function renderPaginacao(total) {
  if (!paginacaoEl) return;

  const totalPaginas = Math.ceil(total / itensPorPagina);

  if (totalPaginas <= 1) {
    paginacaoEl.innerHTML = '';
    return;
  }

  paginacaoEl.innerHTML = `
    <button type="button" class="pagination__btn" ${paginaAtual === 1 ? 'disabled' : ''} data-page="prev">
      ← Anterior
    </button>

    <span class="pagination__info">
      Página ${paginaAtual} de ${totalPaginas}
    </span>

    <button type="button" class="pagination__btn" ${paginaAtual === totalPaginas ? 'disabled' : ''} data-page="next">
      Próxima →
    </button>
  `;

  paginacaoEl.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const acao = btn.dataset.page;

      if (acao === 'prev' && paginaAtual > 1) {
        paginaAtual--;
      }

      if (acao === 'next' && paginaAtual < totalPaginas) {
        paginaAtual++;
      }

      renderAtivos(ordenarLista(listaAtual));
      rolarParaResultados();
    });
  });
}

function renderAtivos(lista) {
  if (!lista.length) {
    renderEmpty();
    return;
  }

  const total = lista.length;
  const pagina = getListaPaginada(lista);

  tabela.innerHTML = '';

  pagina.forEach((item) => {
    const tr = document.createElement('tr');
    const statusTexto = item.status || '-';

    tr.innerHTML = `
      <td>${escaparHtml(item.tipo || '-')}</td>
      <td><strong>${escaparHtml(item.nome || '-')}</strong></td>
      <td>${escaparHtml(item.serial || '-')}</td>
      <td>
        <span class="status-badge ${classeStatus(statusTexto)}">
          ${escaparHtml(statusTexto)}
        </span>
      </td>
      <td>${escaparHtml(item.localizacao || '-')}</td>
      <td>${escaparHtml(item.entidade || '-')}</td>
    `;

    tr.addEventListener('click', () => abrirModalAtivo(item));
    tabela.appendChild(tr);
  });

  renderResumo(total);
  renderPaginacao(total);
}

function detalheLinha(rotulo, valor) {
  return `
    <div class="detail-label">${escaparHtml(rotulo)}</div>
    <div class="detail-value">${escaparHtml(valor || '-')}</div>
  `;
}

function detalheStatus(rotulo, valor) {
  const status = valor || '-';
  return `
    <div class="detail-label">${escaparHtml(rotulo)}</div>
    <div class="detail-value">
      <span class="status-badge ${classeStatus(status)}">${escaparHtml(status)}</span>
    </div>
  `;
}

function montarDetalhesExtras(item) {
  if (item.tipo === 'Computador') {
    return `
      ${detalheLinha('IP', item.ip)}
      ${detalheLinha('Sistema operacional', item.sistema)}
      ${detalheLinha('Processador', item.processador)}
      ${detalheLinha('Memória RAM', item.memoria)}
      ${detalheLinha('Armazenamento', item.armazenamento)}
      ${detalheLinha('Fabricante', item.fabricante)}
      ${detalheLinha('Modelo', item.modelo)}
    `;
  }

  if (item.tipo === 'Telefone') {
    return `
      ${detalheLinha('IP', item.ip)}
      ${detalheLinha('Sistema operacional', item.sistema)}
    `;
  }

  if (item.tipo === 'Monitor') {
    return `
      ${detalheLinha('Computador conectado', item.computador)}
      ${detalheLinha('Modelo', item.modelo)}
      ${detalheLinha('Fabricante', item.fabricante)}
    `;
  }

  if (item.tipo === 'Impressora') {
    return `
      ${detalheLinha('IP', item.ip)}
      ${detalheLinha('Fabricante', item.fabricante)}
      ${detalheLinha('Modelo', item.modelo)}
    `;
  }

  return '';
}

function renderModal(item, carregando = false) {
  if (!modalAtivo || !modalAtivoBody) return;

  if (modalAtivoTitulo) {
    modalAtivoTitulo.textContent = item?.nome || 'Ativo GLPI';
  }

  if (carregando) {
    modalAtivoBody.innerHTML = '<p class="glpi-loading">Carregando detalhes do ativo...</p>';
    return;
  }

  modalAtivoBody.innerHTML = `
    <div class="detail-grid">
      ${detalheLinha('Tipo', item.tipo)}
      ${detalheLinha('Nome', item.nome)}
      ${detalheLinha('Serial', item.serial)}
      ${detalheStatus('Status', item.status)}
      ${detalheLinha('Localização', item.localizacao)}
      ${detalheLinha('Entidade', item.entidade)}
      ${montarDetalhesExtras(item)}
    </div>
  `;
}

async function abrirModalAtivo(item) {
  if (!modalAtivo || !modalAtivoBody) return;

  modalAtivo.hidden = false;
  renderModal(item, true);

  try {
    const params = new URLSearchParams();
    params.set('detalhe', '1');
    params.set('tipo_ativo', item.tipo);
    params.set('id', item.id);

    const resposta = await fetch(`/api/ativos-glpi?${params.toString()}`);
    const resultado = await resposta.json();

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || 'Erro ao carregar detalhes do ativo.');
    }

    renderModal({ ...item, ...(resultado.data || {}) });
  } catch (error) {
    modalAtivoBody.innerHTML = `
      <p class="form-message form-message--error">${escaparHtml(error.message || 'Erro ao carregar detalhes do ativo.')}</p>
      <div class="detail-grid">
        ${detalheLinha('Tipo', item.tipo)}
        ${detalheLinha('Nome', item.nome)}
        ${detalheLinha('Serial', item.serial)}
        ${detalheStatus('Status', item.status)}
        ${detalheLinha('Localização', item.localizacao)}
        ${detalheLinha('Entidade', item.entidade)}
      </div>
    `;
  }
}

function fecharModalAtivo() {
  if (modalAtivo) modalAtivo.hidden = true;
}

async function carregarAtivos() {
  renderLoading();
  paginaAtual = 1;

  const tipo = tipoEl.value || 'todos';
  const busca = buscaEl.value.trim();

  try {
    const params = new URLSearchParams();
    params.set('tipo', tipo);
    if (busca) params.set('busca', busca);

    const resposta = await fetch(`/api/ativos-glpi?${params.toString()}`);
    const resultado = await resposta.json();

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || 'Erro ao consultar ativos no GLPI.');
    }

    listaAtual = resultado.data || [];
    renderAtivos(ordenarLista(listaAtual));
  } catch (error) {
    renderErro(error.message || 'Erro ao carregar ativos.');
  }
}

btnBuscar.addEventListener('click', carregarAtivos);
tipoEl.addEventListener('change', carregarAtivos);

if (buscaEl) {
  buscaEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') carregarAtivos();
  });
}

if (ordenacaoEl) {
  ordenacaoEl.addEventListener('change', () => {
    paginaAtual = 1;
    renderAtivos(ordenarLista(listaAtual));
    rolarParaResultados();
  });
}

if (btnFecharModal) {
  btnFecharModal.addEventListener('click', fecharModalAtivo);
}

if (modalAtivo) {
  modalAtivo.addEventListener('click', (event) => {
    if (event.target === modalAtivo) fecharModalAtivo();
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') fecharModalAtivo();
});

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  await carregarAtivos();
})();
