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
const btnFecharModal = document.getElementById('btnFecharModal');

let listaAtual = [];
let paginaAtual = 1;
const itensPorPagina = 50;

function decodificarHtml(valor) {
  const texto = (valor || '-').toString();
  const textarea = document.createElement('textarea');
  textarea.innerHTML = texto;
  return textarea.value || '-';
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
  tabela.innerHTML = `<tr><td colspan="6" class="glpi-empty">${decodificarHtml(msg)}</td></tr>`;
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

      if (acao === 'prev' && paginaAtual > 1) paginaAtual--;
      if (acao === 'next' && paginaAtual < totalPaginas) paginaAtual++;

      renderAtivos(ordenarLista(listaAtual));

      document.querySelector('.results-shell')?.scrollIntoView({
        behavior: 'smooth'
      });
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
    const statusTexto = decodificarHtml(item.status || '-');

    tr.innerHTML = `
      <td>${decodificarHtml(item.tipo || '-')}</td>
      <td><strong>${decodificarHtml(item.nome || '-')}</strong></td>
      <td>${decodificarHtml(item.serial || '-')}</td>
      <td>
        <span class="status-badge ${classeStatus(statusTexto)}">
          ${statusTexto}
        </span>
      </td>
      <td>${decodificarHtml(item.localizacao || '-')}</td>
      <td>${decodificarHtml(item.entidade || '-')}</td>
    `;

    tr.addEventListener('click', () => abrirModalAtivo(item));
    tabela.appendChild(tr);
  });

  renderResumo(total);
  renderPaginacao(total);
}

function linhaDetalhe(label, valor) {
  return `
    <div class="detail-label">${label}</div>
    <div class="detail-value">${decodificarHtml(valor || '-')}</div>
  `;
}

function renderModal(item) {
  const statusTexto = decodificarHtml(item.status || '-');

  let extras = '';

  if (item.tipo === 'Computador') {
    extras = `
      ${linhaDetalhe('IP', item.ip)}
      ${linhaDetalhe('Sistema operacional', item.sistema)}
      ${linhaDetalhe('Processador', item.processador)}
      ${linhaDetalhe('Memória RAM', item.memoria)}
      ${linhaDetalhe('Armazenamento', item.armazenamento)}
      ${linhaDetalhe('Fabricante', item.fabricante)}
      ${linhaDetalhe('Modelo', item.modelo)}
    `;
  }

  if (item.tipo === 'Telefone') {
    extras = `
      ${linhaDetalhe('IP', item.ip)}
      ${linhaDetalhe('Sistema operacional', item.sistema)}
      ${linhaDetalhe('Fabricante', item.fabricante)}
      ${linhaDetalhe('Modelo', item.modelo)}
    `;
  }

  if (item.tipo === 'Monitor') {
    extras = `
      ${linhaDetalhe('Computador conectado', item.computador)}
      ${linhaDetalhe('Fabricante', item.fabricante)}
      ${linhaDetalhe('Modelo', item.modelo)}
    `;
  }

  if (item.tipo === 'Impressora') {
    extras = `
      ${linhaDetalhe('IP', item.ip)}
      ${linhaDetalhe('Fabricante', item.fabricante)}
      ${linhaDetalhe('Modelo', item.modelo)}
    `;
  }

  modalAtivoBody.innerHTML = `
    <div class="detail-grid">
      ${linhaDetalhe('Tipo', item.tipo)}
      ${linhaDetalhe('Nome', item.nome)}
      ${linhaDetalhe('Serial', item.serial)}
      <div class="detail-label">Status</div>
      <div class="detail-value">
        <span class="status-badge ${classeStatus(statusTexto)}">${statusTexto}</span>
      </div>
      ${linhaDetalhe('Localização', item.localizacao)}
      ${linhaDetalhe('Entidade', item.entidade)}
      ${extras}
    </div>
  `;
}

async function abrirModalAtivo(item) {
  if (!modalAtivo || !modalAtivoBody) return;

  modalAtivo.hidden = false;
  modalAtivoBody.innerHTML = '<div class="glpi-loading">Carregando detalhes do ativo...</div>';

  try {
    const params = new URLSearchParams();
    params.set('detalhe', '1');
    params.set('id', item.id);
    params.set('tipo_ativo', item.tipo);

    const resposta = await fetch(`/api/ativos-glpi?${params.toString()}`);
    const resultado = await resposta.json();

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || 'Erro ao carregar detalhes do ativo.');
    }

    renderModal(resultado.data || item);
  } catch (error) {
    modalAtivoBody.innerHTML = `
      <div class="glpi-empty">
        ${decodificarHtml(error.message || 'Erro ao carregar detalhes.')}
      </div>
    `;
  }
}

function fecharModalAtivo() {
  if (modalAtivo) modalAtivo.hidden = true;
}

btnFecharModal?.addEventListener('click', fecharModalAtivo);

modalAtivo?.addEventListener('click', (e) => {
  if (e.target === modalAtivo) fecharModalAtivo();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharModalAtivo();
});

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

ordenacaoEl?.addEventListener('change', () => {
  paginaAtual = 1;
  renderAtivos(ordenarLista(listaAtual));
});

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  await carregarAtivos();
})();
