function limparTexto(valor) {
  return (valor || "").toString().trim();
}

export async function onRequestGet(context) {
  try {
    if (!context.env.SUPABASE_URL) {
      throw new Error("SUPABASE_URL não configurada no Pages.");
    }

    if (!context.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no Pages.");
    }

    const resposta = await fetch(
      `${context.env.SUPABASE_URL}/rest/v1/form_unidades?select=id,nome,ordem,ativo&ativo=eq.true&order=ordem.asc,nome.asc`,
      {
        method: "GET",
        headers: {
          apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Accept: "application/json"
        }
      }
    );

    if (!resposta.ok) {
      const erro = await resposta.text();
      throw new Error(`Erro ao consultar unidades: ${erro}`);
    }

    const retorno = await resposta.json();
    const unidades = Array.isArray(retorno)
      ? retorno.map((item) => ({
          id: item.id,
          nome: limparTexto(item.nome),
          ordem: item.ordem
        }))
      : [];

    return Response.json({ ok: true, unidades });
  } catch (error) {
    return Response.json(
      { ok: false, message: error.message || "Erro ao carregar unidades." },
      { status: 500 }
    );
  }
}
