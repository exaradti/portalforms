import { getSession, updateUserPassword } from "/assets/supabase-auth.js";

const form = document.getElementById("resetPasswordForm");
const mensagem = document.getElementById("mensagemReset");
const btnSubmit = form.querySelector("button[type='submit']");

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.classList.remove("form-message--success", "form-message--error");
  if (tipo) mensagem.classList.add(`form-message--${tipo}`);
}

function setLoading(ativo) {
  btnSubmit.disabled = ativo;
  btnSubmit.textContent = ativo ? "Atualizando..." : "Atualizar senha";
}

function lerParametrosDeErro() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  return {
    error: hash.get("error") || query.get("error"),
    errorCode: hash.get("error_code") || query.get("error_code"),
    errorDescription: hash.get("error_description") || query.get("error_description")
  };
}

(async () => {
  const { error, errorCode, errorDescription } = lerParametrosDeErro();

  if (error || errorCode) {
    const texto = errorCode === "otp_expired"
      ? "O link de redefinição expirou ou já foi usado. Solicite um novo link na página de recuperação de senha."
      : decodeURIComponent((errorDescription || "Sessão de recuperação inválida.").replace(/\+/g, " "));

    mostrarMensagem(texto, "error");
    form.querySelectorAll("input, button").forEach((el) => {
      if (el.id !== "btnVoltarForgot") el.disabled = true;
    });
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 700));
  const session = await getSession().catch(() => null);

  if (!session) {
    mostrarMensagem("Sessão de recuperação inválida ou expirada. Solicite um novo link de redefinição.", "error");
    return;
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    mostrarMensagem("Preencha os campos corretamente.", "error");
    return;
  }

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword !== confirmPassword) {
    mostrarMensagem("A confirmação da senha não confere.", "error");
    return;
  }

  try {
    setLoading(true);
    mostrarMensagem("", "");

    const { error } = await updateUserPassword(newPassword);
    if (error) throw error;

    mostrarMensagem("Senha atualizada com sucesso. Redirecionando para o login...", "success");
    setTimeout(() => {
      window.location.href = "/formularios/informatica/login/index.html";
    }, 1800);
  } catch (error) {
    mostrarMensagem(error.message || "Não foi possível atualizar a senha.", "error");
  } finally {
    setLoading(false);
  }
});
