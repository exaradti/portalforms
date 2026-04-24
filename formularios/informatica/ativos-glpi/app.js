import { requireAuth } from '/assets/supabase-auth.js';

const tabela = document.getElementById('tabela');
const btnBuscar = document.getElementById('btnBuscar');
const tipoEl = document.getElementById('tipo');
const buscaEl = document.getElementById('busca');

function renderLoading() {
  tabela.innerHTML = '<tr><td colspan="5" class="glpi-loading">Carregando ativos do GLPI...</td></tr>';
}

function renderEmpty() {
  tabela.innerHTML = '<tr><td colspan="5" class="glpi-empty">Nenhum ativo encontrado.</td></tr>';
}

function renderErro(msg) {
  tabela.innerHTML = `<tr><td colspan="5" class="glpi-empty">${msg}</td></tr>`;
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

    renderAtivos(resultado.data || []);
  } catch (error) {
    renderErro(error.message || 'Erro ao carregar ativos.');
  }
}

btnBuscar.addEventListener('click', carregarAtivos);
tipoEl.addEventListener('change', carregarAtivos);

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  await carregarAtivos();
})();