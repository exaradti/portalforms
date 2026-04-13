export async function onRequestPost(context) {
  try {
    const data = await context.request.json();

    const nome = (data.nome || "").trim();
    const email = (data.email || "").trim();
    const tipo = (data.tipo || "").trim();
    const descricao = (data.descricao || "").trim();

    if (!nome || !email || !tipo) {
      return Response.json(
        { ok: false, message: "Preencha todos os campos obrigatórios." },
        { status: 400 }
      );
    }

    const corpo = `
Nova solicitação ao RH

Nome: ${nome}
E-mail: ${email}
Tipo de solicitação: ${tipo}

Descrição:
${descricao || "Não informada"}
    `.trim();

    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: context.env.EMAIL_FROM,
        to: context.env.EMAIL_RH_DESTINO,
        subject: "Nova solicitação ao RH",
        text: corpo,
        reply_to: email,
      }),
    });

    if (!emailResp.ok) {
      const erroTexto = await emailResp.text();
      return Response.json(
        { ok: false, message: `Erro ao enviar email do RH: ${erroTexto}` },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      message: "Solicitação enviada com sucesso.",
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: "Erro interno ao processar a solicitação." },
      { status: 500 }
    );
  }
}
