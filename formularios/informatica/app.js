import {
  requireAuth,
  bindLogoutButtons,
  renderUserDisplayName,
  setupUserMenu,
  getAccessToken
} from "/assets/supabase-auth.js";

const loading = document.getElementById("loadingAuth");
const content = document.getElementById("conteudoProtegido");
const cardGestaoEquipamentos = document.getElementById("cardGestaoEquipamentos");
const cardGestaoUsuarios = document.getElementById("cardGestaoUsuarios");

async function revelarCardsGestao() {
  const accessToken = await getAccessToken();
  if (!accessToken) return;

  try {
    const resposta = await fetch('/api/gestao-usuarios?check_access=1', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const resultado = await resposta.json().catch(() => ({ ok: false }));
    const permitido = resposta.ok && resultado.ok && resultado.permitido === true;

    if (permitido) {
      if (cardGestaoEquipamentos) cardGestaoEquipamentos.hidden = false;
      if (cardGestaoUsuarios) cardGestaoUsuarios.hidden = false;
    } else {
      if (cardGestaoEquipamentos) cardGestaoEquipamentos.remove();
      if (cardGestaoUsuarios) cardGestaoUsuarios.remove();
    }
  } catch {
    if (cardGestaoEquipamentos) cardGestaoEquipamentos.remove();
    if (cardGestaoUsuarios) cardGestaoUsuarios.remove();
  }
}

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  renderUserDisplayName("#authUserName", session);
  setupUserMenu();
  bindLogoutButtons();

  await revelarCardsGestao();

  loading.hidden = true;
  content.hidden = false;
})();
