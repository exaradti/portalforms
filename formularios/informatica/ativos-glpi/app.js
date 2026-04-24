import { requireAuth } from '/assets/supabase-auth.js';

const tabela = document.getElementById('tabela');
const btnBuscar = document.getElementById('btnBuscar');
const tipoEl = document.getElementById('tipo');
const buscaEl = document.getElementById('busca');
const ordenacaoEl = document.getElementById('ordenacao');

let listaAtual = [];

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

function renderLoading() {
  tabela.innerHTML = '<tr><td colspan="6" class="glpi-loading">Carregando ativos do GLPI...</td></tr>';
}

function renderEmpty() {
  tabela.innerHTML = '<tr><td colspan="6" class="glpi-empty">Nenhum ativo encontrado.</td></tr>';
}

function renderErro(msg) {
  tabela.innerHTML = `<tr><td colspan="6" class="glpi-empty">${msg}</td></tr>`;
}

function renderAtivos(lista) {
  if (!lista.length) {
    renderEmpty();
    return;
  }

  tabela.innerHTML = '';

  lista.forEach((item) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${item.tipo || '-'}</td>
      <td><strong>${item.nome || '-'}</strong></td>
      <td>${item.serial || '-'}</td>
      <td>${item.status || '-'}</td>
      <td>${item.localizacao || '-'}</td>
      <td>${item.entidade || '-'}</td>
    `;

    tabela.appendChild(tr);
  });
}

async function carregarAtivos() {
  renderLoading();

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
    renderAtivos(ordenarLista(listaAtual));
  });
}

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  await carregarAtivos();
})();
