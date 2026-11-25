import { NextRequest, NextResponse } from "next/server";
import { transcribeAudioBuffer } from "@/lib/audio";
import { prisma } from "@/lib/prisma";
import { normalizeCRPhone } from "@/lib/format";
import { qualifyLeadAndNotifySeller } from "@/lib/ai-agent";
import { runTriggerAutomations } from "@/lib/automations";

// Accepts multipart audio file (.ogg, .mp3, .wav, .m4a) to transcribe & ingest as a WhatsApp voice note
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const senderName = String(formData.get("senderName") || "Cliente Audio WhatsApp");
    const company = String(formData.get("company") || senderName);
    const contact = normalizeCRPhone(String(formData.get("contact") || "8855-1122"));
    const fallbackTranscript = String(formData.get("fallbackTranscript") || "");

    let transcript = fallbackTranscript;
    let provider = "simulated-audio";

    if (file && file.size > 0) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const res = await transcribeAudioBuffer(bytes, file.type || "audio/ogg", fallbackTranscript || undefined);
      transcript = res.transcript;
      provider = res.provider;
    }

    if (!transcript) {
      return NextResponse.json({ error: "Sube un archivo de audio o escribe una transcripción de prueba." }, { status: 400 });
    }

    let client = await prisma.client.findFirst({
      where: { OR: [{ whatsapp: contact }, { phone: contact }] },
    });
    if (!client) {
      client = await prisma.client.create({
        data: {
          company,
          contactName: senderName,
          phone: contact,
          whatsapp: contact,
          stage: "NUEVO",
          source: "WHATSAPP",
          notes: "Creado desde nota de voz de WhatsApp.",
        },
      });
    }

    let conv = await prisma.conversation.findFirst({
      where: { channel: "WHATSAPP", externalId: contact },
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          channel: "WHATSAPP",
          externalId: contact,
          subject: company,
          clientId: client.id,
          unreadCount: 1,
          lastMessageAt: new Date(),
          lastMessagePreview: `🎤 Audio: ${transcript.slice(0, 120)}`,
        },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastMessagePreview: `🎤 Audio: ${transcript.slice(0, 120)}`,
        },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: "INBOUND",
        senderName,
        senderRole: "CLIENT",
        body: `🎤 [Nota de voz transcrita (${provider})]:\n${transcript}`,
        status: "DELIVERED",
      },
    });

    const qualification = await qualifyLeadAndNotifySeller({
      clientId: client.id,
      conversationId: conv.id,
      messageBody: transcript,
      isAudio: true,
    });

    const automations = await runTriggerAutomations("NEW_WHATSAPP_MESSAGE", {
      clientId: client.id,
      conversationId: conv.id,
      messageBody: transcript,
      channel: "WHATSAPP",
    });

    return NextResponse.json({
      ok: true,
      conversationId: conv.id,
      transcript,
      provider,
      qualification,
      automations,
    });
  } catch (err) {
    console.error("Audio ingest error:", err);
    return NextResponse.json({ error: "Error procesando audio." }, { status: 500 });
  }
}
