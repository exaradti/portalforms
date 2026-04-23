import {
  requireAuth,
  getAccessToken,
  bindLogoutButtons,
  renderUserDisplayName,
  setupUserMenu
} from '/assets/supabase-auth.js';

const loading = document.getElementById('loadingAuth');
const content = document.getElementById('conteudoProtegido');
const mensagemTela = document.getElementById('mensagemTela');
const resumoResultados = document.getElementById('resumoResultados');
const tbodyRegistros = document.getElementById('tbodyRegistros');
const formFiltros = document.getElementById('formFiltros');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');

function mostrarMensagem(texto, tipo) {
  mensagemTela.textContent = texto;
  mensagemTela.classList.remove('form-message--success', 'form-message--error');
  if (tipo) mensagemTela.classList.add(`form-message--${tipo}`);
}

function formataData(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function montarDetalhesEquipamento(registro) {
  const linhas = [
    `<strong>${registro.nome_equipamento || '-'}</strong>`
  ];

  if (registro.nome_ativo_antigo) {
    linhas.push(`<div class="row-meta">Anterior: ${registro.nome_ativo_antigo}</div>`);
  }

  if (registro.ip_equipamento) {
    linhas.push(`<div class="row-meta">IP: ${registro.ip_equipamento}</div>`);
  }

  if (registro.modelo_equipamento) {
    linhas.push(`<div class="row-meta">Modelo: ${registro.modelo_equipamento}</div>`);
  }

  if (Array.isArray(registro.programas_instalados) && registro.programas_instalados.length) {
    linhas.push(`<div class="row-meta">Programas: ${registro.programas_instalados.join(', ')}</div>`);
  }

  if (registro.observacoes) {
    linhas.push(`<div class="row-meta">Obs.: ${registro.observacoes}</div>`);
  }

  return linhas.join('');
}

function criarLinha(registro) {
  const tr = document.createElement('tr');
  const statusAtual = registro.status_glpi || 'pendente';

  tr.innerHTML = `
    <td>${formataData(registro.created_at)}</td>
    <td>
      <strong>${registro.origem === 'troca' ? 'Troca' : 'Instalação'}</strong>
      <div class="row-meta">ID: ${registro.registro_id}</div>
    </td>
    <td>${registro.tipo_ativo || '-'}</td>
    <td>${montarDetalhesEquipamento(registro)}</td>
    <td>
      <strong>${registro.unidade || '-'}</strong>
      <div class="row-meta">${registro.setor || '-'}</div>
    </td>
    <td>
      <strong>${registro.nome_tecnico || '-'}</strong>
      ${registro.glpi_atualizado_por ? `<div class="row-meta">Últ. atualização: ${registro.glpi_atualizado_por}</div>` : ''}
    </td>
    <td>
      <span class="row-badge row-badge--${statusAtual}">${statusAtual}</span>
      ${registro.glpi_atualizado_em ? `<div class="row-meta">${formataData(registro.glpi_atualizado_em)}</div>` : ''}
    </td>
    <td>
      <div class="row-meta">Atual: ${registro.glpi_tag || 'Sem tag'}</div>
    </td>
    <td>
      <div class="row-edit">
        <select data-role="status">
          <option value="pendente" ${statusAtual === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="registrado" ${statusAtual === 'registrado' ? 'selected' : ''}>Registrado</option>
        </select>
        <input type="text" data-role="tag" placeholder="Tag GLPI" value="${registro.glpi_tag || ''}">
        <button type="button" class="btn-row-save">Salvar</button>
      </div>
    </td>
  `;

  const selectStatus = tr.querySelector('[data-role="status"]');
  const inputTag = tr.querySelector('[data-role="tag"]');
  const btnSalvar = tr.querySelector('.btn-row-save');

  btnSalvar.addEventListener('click', async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      window.location.href = `/formularios/informatica/login/index.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    try {
      const resposta = await fetch('/api/gestao-equipamentos', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          origem: registro.origem,
          registro_id: registro.registro_id,
          status_glpi: selectStatus.value,
          glpi_tag: inputTag.value.trim()
        })
      });

      const resultado = await resposta.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }));

      if (!resposta.ok || !resultado.ok) {
        throw new Error(resultado.message || 'Erro ao atualizar registro.');
      }

      mostrarMensagem('Registro atualizado com sucesso.', 'success');
      await carregarRegistros();
    } catch (error) {
      mostrarMensagem(error.message || 'Erro ao atualizar registro.', 'error');
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar';
    }
  });

  return tr;
}

function getQueryString() {
  const formData = new FormData(formFiltros);
  const params = new URLSearchParams();

  for (const [chave, valor] of formData.entries()) {
    if (String(valor).trim()) {
      params.set(chave, String(valor).trim());
    }
  }

  params.set('limit', '300');
  return params.toString();
}

async function carregarRegistros() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    window.location.href = `/formularios/informatica/login/index.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  mostrarMensagem('', '');
  resumoResultados.textContent = 'Carregando registros...';
  tbodyRegistros.innerHTML = '';

  try {
    const resposta = await fetch(`/api/gestao-equipamentos?${getQueryString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const resultado = await resposta.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }));

    if (resposta.status === 403) {
      throw new Error(resultado.message || 'Acesso não autorizado a esta tela.');
    }

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || 'Erro ao carregar registros.');
    }

    const registros = Array.isArray(resultado.registros) ? resultado.registros : [];
    resumoResultados.textContent = `${registros.length} registro(s) localizado(s).`;

    if (!registros.length) {
      tbodyRegistros.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhum registro encontrado para os filtros informados.</td></tr>';
      return;
    }

    const fragment = document.createDocumentFragment();
    registros.forEach((registro) => fragment.appendChild(criarLinha(registro)));
    tbodyRegistros.appendChild(fragment);
  } catch (error) {
    resumoResultados.textContent = 'Não foi possível carregar os registros.';
    tbodyRegistros.innerHTML = '<tr><td colspan="9" class="empty-state">Falha ao carregar os registros.</td></tr>';
    mostrarMensagem(error.message || 'Erro ao consultar registros.', 'error');
  }
}

formFiltros.addEventListener('submit', async (event) => {
  event.preventDefault();
  await carregarRegistros();
});

btnLimparFiltros.addEventListener('click', async () => {
  formFiltros.reset();
  await carregarRegistros();
});

async function validarPermissaoTela() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    window.location.href = `/formularios/informatica/login/index.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return false;
  }

  const resposta = await fetch('/api/gestao-equipamentos?check_access=1', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const resultado = await resposta.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }));

  if (resposta.status === 403) {
    window.location.href = '/formularios/informatica/index.html';
    return false;
  }

  if (!resposta.ok || !resultado.ok || resultado.permitido !== true) {
    throw new Error(resultado.message || 'Acesso não autorizado a esta tela.');
  }

  return true;
}

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  renderUserDisplayName('#authUserName', session);
  setupUserMenu();
  bindLogoutButtons();

  const permitido = await validarPermissaoTela();
  if (!permitido) return;

  loading.hidden = true;
  content.hidden = false;

  await carregarRegistros();
})().catch((error) => {
  mostrarMensagem(error.message || 'Erro ao carregar a tela de gestão.', 'error');
  loading.hidden = true;
  content.hidden = false;
});
