import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const config = window.SUPABASE_CONFIG || {};

if (!config.url || !config.anonKey || config.url.includes("SEU-PROJETO") || config.anonKey.includes("SUA_SUPABASE")) {
  console.warn("Supabase não configurado em /assets/supabase-config.js");
}

export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function requireAuth(redirectTo) {
  const session = await getSession();
  if (!session) {
    const destino = encodeURIComponent(redirectTo || window.location.pathname);
    window.location.href = `/formularios/informatica/login/index.html?redirect=${destino}`;
    return null;
  }
  return session;
}

export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token || null;
}

export function bindLogoutButtons(selector = "[data-auth-logout]") {
  document.querySelectorAll(selector).forEach((button) => {
    if (button.dataset.authLogoutBound === "true") return;
    button.dataset.authLogoutBound = "true";

    button.addEventListener("click", async () => {
      await signOut();
      window.location.href = "/formularios/informatica/login/index.html";
    });
  });
}

export function getUserDisplayName(session) {
  const user = session?.user;
  if (!user) return "Usuário autenticado";

  return user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.user_metadata?.display_name
    || user.email
    || "Usuário autenticado";
}

export function renderUserDisplayName(selector, session) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = getUserDisplayName(session);
}

export function renderUserEmail(selector, session) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = session?.user?.email || "Usuário autenticado";
}

export function setupUserMenu({
  menuSelector = "#userMenu",
  buttonSelector = "#userMenuBtn",
  dropdownSelector = "#userMenuDropdown"
} = {}) {
  const menu = document.querySelector(menuSelector);
  const button = document.querySelector(buttonSelector);
  const dropdown = document.querySelector(dropdownSelector);

  if (!menu || !button || !dropdown) return;

  menu.hidden = false;

  const closeMenu = () => {
    dropdown.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    dropdown.hidden = false;
    button.setAttribute("aria-expanded", "true");
  };

  if (button.dataset.userMenuBound !== "true") {
    button.dataset.userMenuBound = "true";

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (dropdown.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });
  }

  closeMenu();
}

export async function resetPasswordForEmail(email, redirectTo) {
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  });
}

export async function updateUserPassword(password) {
  return await supabase.auth.updateUser({
    password
  });
}
