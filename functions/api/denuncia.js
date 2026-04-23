const MAX_ARQUIVOS = 5;
const MAX_MB_POR_ARQUIVO = 10;
const MAX_BYTES_POR_ARQUIVO = MAX_MB_POR_ARQUIVO * 1024 * 1024;

const EXTENSOES_PERMITIDAS = [
  "jpg",
  "jpeg",
  "png",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "mp3",
  "mp4",
  "wav",
];

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^\w.\-() ]+/g, "_");
}

function getFileExtension(fileName) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function isAllowedExtension(fileName) {
  return EXTENSOES_PERMITIDAS.includes(getFileExtension(fileName));
}

export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();

    const descricao = (formData.get("descricao") || "").toString().trim();
    const links = (formData.get("links_provas") || "").toString().trim();
    const arquivosRecebidos = formData.getAll("provas");

    if (!descricao) {
      return Response.json(
        { ok: false, message: "Descreva a situação antes de enviar." },
        { status: 400 }
      );
    }

    const arquivos = arquivosRecebidos.filter(
      (item) => item && typeof item.name === "string" && item.name
    );

    if (arquivos.length > MAX_ARQUIVOS) {
      return Response.json(
        { ok: false, message: `Você pode anexar no máximo ${MAX_ARQUIVOS} arquivos.` },
        { status: 400 }
      );
    }

    const attachments = [];
    const nomesArquivos = [];

    for (const file of arquivos) {
      const originalName = file.name || "arquivo";
      const safeName = sanitizeFileName(originalName);

      if (!isAllowedExtension(safeName)) {
        return Response.json(
          { ok: false, message: `O arquivo "${originalName}" não possui um formato permitido.` },
          { status: 400 }
        );
      }

      if (file.size > MAX_BYTES_POR_ARQUIVO) {
        return Response.json(
          {
            ok: false,
            message: `O arquivo "${originalName}" excede o limite de ${MAX_MB_POR_ARQUIVO} MB.`,
          },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const base64Content = arrayBufferToBase64(buffer);

      nomesArquivos.push(safeName);

      attachments.push({
        filename: safeName,
        content: base64Content,
      });
    }

    const corpo = `
Nova denúncia recebida

Descrição:
${descricao}

Links de provas:
${links || "Não informado"}

Arquivos enviados:
${nomesArquivos.length ? nomesArquivos.join(", ") : "Nenhum arquivo enviado"}
    `.trim();

    const payload = {
      from: context.env.EMAIL_FROM,
      to: context.env.EMAIL_DENUNCIA_DESTINO,
      subject: "Nova denúncia recebida",
      text: corpo,
    };

    if (attachments.length > 0) {
      payload.attachments = attachments;
    }

    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!emailResp.ok) {
      const erroTexto = await emailResp.text();
      return Response.json(
        { ok: false, message: `Erro ao enviar email da denúncia: ${erroTexto}` },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      message: "Denúncia enviada com sucesso.",
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: "Erro interno ao processar a denúncia." },
      { status: 500 }
    );
  }
}