import { requireAuth } from '/assets/supabase-auth.js';

const tabela = document.getElementById('tabela');
const btnBuscar = document.getElementById('btnBuscar');
const tipoEl = document.getElementById('tipo');
const buscaEl = document.getElementById('busca');
const ordenacaoEl = document.getElementById('ordenacao');
const resumoEl = document.getElementById('resumoResultados');
const paginacaoEl = document.getElementById('paginacao');

let listaAtual = [];
let paginaAtual = 1;
const itensPorPagina = 50;

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
  tabela.innerHTML = `<tr><td colspan="6" class="glpi-empty">${msg}</td></tr>`;
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
      <td>${item.tipo || '-'}</td>
      <td><strong>${item.nome || '-'}</strong></td>
      <td>${item.serial || '-'}</td>
      <td>
        <span class="status-badge ${classeStatus(statusTexto)}">
          ${statusTexto}
        </span>
      </td>
      <td>${item.localizacao || '-'}</td>
      <td>${item.entidade || '-'}</td>
    `;

    tabela.appendChild(tr);
  });

  renderResumo(total);
  renderPaginacao(total);
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

if (ordenacaoEl) {
  ordenacaoEl.addEventListener('change', () => {
    paginaAtual = 1;
    renderAtivos(ordenarLista(listaAtual));
    rolarParaResultados();
  });
}

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  await carregarAtivos();
})();
