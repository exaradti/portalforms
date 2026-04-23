document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".card[href]");

  cards.forEach((card) => {
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        card.click();
      }
    });
  });

  console.log("Central de Formulários carregada com sucesso.");
});