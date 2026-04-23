import { resetPasswordForEmail } from "/assets/supabase-auth.js";

const form = document.getElementById("forgotPasswordForm");
const mensagem = document.getElementById("mensagemForgot");
const btnSubmit = form.querySelector("button[type='submit']");

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.classList.remove("form-message--success", "form-message--error");
  if (tipo) mensagem.classList.add(`form-message--${tipo}`);
}

function setLoading(ativo) {
  btnSubmit.disabled = ativo;
  btnSubmit.textContent = ativo ? "Enviando..." : "Enviar link";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    mostrarMensagem("Informe um e-mail válido.", "error");
    return;
  }

  const email = document.getElementById("email").value.trim();

  try {
    setLoading(true);
    mostrarMensagem("", "");

    const redirectTo = `${window.location.origin}/formularios/informatica/reset-password/index.html`;
    const { error } = await resetPasswordForEmail(email, redirectTo);

    if (error) throw error;

    mostrarMensagem("Link de recuperação enviado. Verifique sua caixa de entrada e também a pasta de spam.", "success");
  } catch (error) {
    mostrarMensagem(error.message || "Não foi possível enviar o link de recuperação.", "error");
  } finally {
    setLoading(false);
  }
});
