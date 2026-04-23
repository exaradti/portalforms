import {
  getSession,
  signInWithPassword
} from "/assets/supabase-auth.js";

const form = document.getElementById("loginForm");
const mensagem = document.getElementById("mensagemLogin");
const btnSubmit = form.querySelector("button[type='submit']");

const redirectParam =
  new URLSearchParams(window.location.search).get("redirect") ||
  "/formularios/informatica/index.html";

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.classList.remove("form-message--success", "form-message--error");
  if (tipo) mensagem.classList.add(`form-message--${tipo}`);
}

function setLoading(ativo) {
  btnSubmit.disabled = ativo;
  btnSubmit.textContent = ativo ? "Entrando..." : "Entrar";
}

(async () => {
  const session = await getSession();
  if (session) {
    window.location.href = redirectParam;
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    mostrarMensagem("Preencha e-mail e senha.", "error");
    return;
  }

  try {
    setLoading(true);
    mostrarMensagem("", "");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await signInWithPassword(email, password);

    if (error) throw error;

    mostrarMensagem("Login realizado com sucesso. Redirecionando...", "success");
    window.location.href = redirectParam;
  } catch (error) {
    mostrarMensagem(error.message || "Não foi possível autenticar.", "error");
  } finally {
    setLoading(false);
  }
});
