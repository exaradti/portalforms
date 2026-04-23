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
const resumoUsuarios = document.getElementById('resumoUsuarios');
const tbodyUsuarios = document.getElementById('tbodyUsuarios');
const formCriarUsuario = document.getElementById('formCriarUsuario');
const btnCriarUsuario = document.getElementById('btnCriarUsuario');
const formFiltrosUsuarios = document.getElementById('formFiltrosUsuarios');
const btnLimparUsuarios = document.getElementById('btnLimparUsuarios');

function mostrarMensagem(texto, tipo) {
  mensagemTela.textContent = texto;
  mensagemTela.classList.remove('form-message--success', 'form-message--error');
  if (tipo) mensagemTela.classList.add(`form-message--${tipo}`);
}

function formataData(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function getBadgeClass(valor, tipo) {
  return valor ? `row-badge--${tipo === 'gestao' ? 'com-gestao' : 'ativo'}` : `row-badge--${tipo === 'gestao' ? 'sem-gestao' : 'inativo'}`;
}

function getQueryString() {
  const formData = new FormData(formFiltrosUsuarios);
  const params = new URLSearchParams();

  for (const [chave, valor] of formData.entries()) {
    const texto = String(valor).trim();
    if (texto) params.set(chave, texto);
  }

  return params.toString();
}

async function validarPermissaoTela() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    window.location.href = `/formularios/informatica/login/index.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return false;
  }

  const resposta = await fetch('/api/gestao-usuarios?check_access=1', {
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

function criarLinhaUsuario(usuario) {
  const tr = document.createElement('tr');
  const nomeAtual = usuario.nome || usuario.email || '-';

  tr.innerHTML = `
    <td>
      <strong>${nomeAtual}</strong>
      <div class="row-meta">ID: ${usuario.id}</div>
    </td>
    <td>
      <strong>${usuario.email || '-'}</strong>
      <div class="row-meta">Criado em: ${formataData(usuario.created_at)}</div>
    </td>
    <td>
      <span class="row-badge ${getBadgeClass(usuario.ativo, 'ativo')}">${usuario.ativo ? 'Ativo' : 'Inativo'}</span>
    </td>
    <td>
      <span class="row-badge ${getBadgeClass(usuario.acesso_gestao, 'gestao')}">${usuario.acesso_gestao ? 'Com acesso' : 'Sem acesso'}</span>
    </td>
    <td>${formataData(usuario.last_sign_in_at)}</td>
    <td>
      <div class="row-edit">
        <input type="text" data-role="nome" value="${nomeAtual}" placeholder="Nome do usuário">
        <input type="text" data-role="senha" value="" placeholder="Nova senha (opcional)">
        <div class="row-checks">
          <label><input type="checkbox" data-role="ativo" ${usuario.ativo ? 'checked' : ''}> Usuário ativo no portal</label>
          <label><input type="checkbox" data-role="gestao" ${usuario.acesso_gestao ? 'checked' : ''}> Acesso à gestão</label>
        </div>
        <button type="button" class="btn-row-save">Salvar</button>
      </div>
    </td>
  `;

  const inputNome = tr.querySelector('[data-role="nome"]');
  const inputSenha = tr.querySelector('[data-role="senha"]');
  const checkAtivo = tr.querySelector('[data-role="ativo"]');
  const checkGestao = tr.querySelector('[data-role="gestao"]');
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
      const resposta = await fetch('/api/gestao-usuarios', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          id: usuario.id,
          nome: inputNome.value.trim(),
          senha: inputSenha.value.trim(),
          ativo: checkAtivo.checked,
          acesso_gestao: checkGestao.checked
        })
      });

      const resultado = await resposta.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }));

      if (!resposta.ok || !resultado.ok) {
        throw new Error(resultado.message || 'Erro ao atualizar usuário.');
      }

      mostrarMensagem('Usuário atualizado com sucesso.', 'success');
      await carregarUsuarios();
    } catch (error) {
      mostrarMensagem(error.message || 'Erro ao atualizar usuário.', 'error');
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar';
    }
  });

  return tr;
}

async function carregarUsuarios() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    window.location.href = `/formularios/informatica/login/index.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  mostrarMensagem('', '');
  resumoUsuarios.textContent = 'Carregando usuários...';
  tbodyUsuarios.innerHTML = '';

  try {
    const resposta = await fetch(`/api/gestao-usuarios?${getQueryString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const resultado = await resposta.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }));

    if (resposta.status === 403) {
      throw new Error(resultado.message || 'Acesso não autorizado a esta tela.');
    }

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || 'Erro ao carregar usuários.');
    }

    const usuarios = Array.isArray(resultado.usuarios) ? resultado.usuarios : [];
    resumoUsuarios.textContent = `${usuarios.length} usuário(s) localizado(s).`;

    if (!usuarios.length) {
      tbodyUsuarios.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum usuário encontrado para os filtros informados.</td></tr>';
      return;
    }

    const fragment = document.createDocumentFragment();
    usuarios.forEach((usuario) => fragment.appendChild(criarLinhaUsuario(usuario)));
    tbodyUsuarios.appendChild(fragment);
  } catch (error) {
    resumoUsuarios.textContent = 'Não foi possível carregar os usuários.';
    tbodyUsuarios.innerHTML = '<tr><td colspan="6" class="empty-state">Falha ao carregar os usuários.</td></tr>';
    mostrarMensagem(error.message || 'Erro ao consultar usuários.', 'error');
  }
}

formCriarUsuario.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!formCriarUsuario.reportValidity()) return;

  const accessToken = await getAccessToken();
  if (!accessToken) {
    window.location.href = `/formularios/informatica/login/index.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return;
  }

  btnCriarUsuario.disabled = true;
  btnCriarUsuario.textContent = 'Criando...';
  mostrarMensagem('', '');

  try {
    const formData = new FormData(formCriarUsuario);

    const resposta = await fetch('/api/gestao-usuarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        nome: String(formData.get('nome') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        senha: String(formData.get('senha') || '').trim(),
        ativo: document.getElementById('novo_ativo').checked,
        acesso_gestao: document.getElementById('novo_acesso_gestao').checked
      })
    });

    const resultado = await resposta.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }));

    if (!resposta.ok || !resultado.ok) {
      throw new Error(resultado.message || 'Erro ao criar usuário.');
    }

    formCriarUsuario.reset();
    document.getElementById('novo_ativo').checked = true;
    document.getElementById('novo_acesso_gestao').checked = false;
    mostrarMensagem('Usuário criado com sucesso.', 'success');
    await carregarUsuarios();
  } catch (error) {
    mostrarMensagem(error.message || 'Erro ao criar usuário.', 'error');
  } finally {
    btnCriarUsuario.disabled = false;
    btnCriarUsuario.textContent = 'Criar usuário';
  }
});

formFiltrosUsuarios.addEventListener('submit', async (event) => {
  event.preventDefault();
  await carregarUsuarios();
});

btnLimparUsuarios.addEventListener('click', async () => {
  formFiltrosUsuarios.reset();
  await carregarUsuarios();
});

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

  await carregarUsuarios();
})().catch((error) => {
  mostrarMensagem(error.message || 'Erro ao carregar a tela de gestão de usuários.', 'error');
  loading.hidden = true;
  content.hidden = false;
});
