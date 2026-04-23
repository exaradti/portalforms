import {
  requireAuth,
  getAccessToken,
  bindLogoutButtons,
  renderUserDisplayName,
  setupUserMenu
} from "/assets/supabase-auth.js";

const loading = document.getElementById("loadingAuth");
const content = document.getElementById("conteudoProtegido");
const cardGestao = document.getElementById("cardGestaoEquipamentos");

async function aplicarPermissaoGestao() {
  if (!cardGestao) return;

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      cardGestao.remove();
      return;
    }

    const resposta = await fetch('/api/gestao-equipamentos?check_access=1', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const resultado = await resposta.json().catch(() => ({}));
    const permitido = resposta.ok && resultado.ok && resultado.permitido === true;
    if (!permitido) {
      cardGestao.remove();
      return;
    }

    cardGestao.hidden = false;
  } catch {
    cardGestao.remove();
  }
}

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  renderUserDisplayName("#authUserName", session);
  setupUserMenu();
  bindLogoutButtons();
  await aplicarPermissaoGestao();

  loading.hidden = true;
  content.hidden = false;
})();
