import {
  requireAuth,
  bindLogoutButtons,
  renderUserDisplayName,
  setupUserMenu
} from "/assets/supabase-auth.js";

const loading = document.getElementById("loadingAuth");
const content = document.getElementById("conteudoProtegido");

(async () => {
  const session = await requireAuth(window.location.pathname);
  if (!session) return;

  renderUserDisplayName("#authUserName", session);
  setupUserMenu();
  bindLogoutButtons();

  loading.hidden = true;
  content.hidden = false;
})();
