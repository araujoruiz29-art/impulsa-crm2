import { NextRequest, NextResponse } from "next/server";
import { getIntegrationSettings, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, getCurrentSession, requireOwnerOrAdmin } from "@/lib/workspace";
import {
  configureWhatsAppCallingSettings,
  controlWhatsAppCall,
  getWhatsAppCallingSettings,
  sendWhatsAppCallPermissionRequest,
} from "@/lib/meta";
import { normalizeCRPhone } from "@/lib/format";
import { callGeminiResilient } from "@/lib/gemini";
import { logAuditEvent } from "@/lib/audit";

// GET /api/voip/whatsapp — Poll active calls (softphone) or fetch full call history
export async function GET(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId.startsWith("__")) {
    return NextResponse.json({ error: "Sin acceso activo." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "1";

  // Auto-expire stale RINGING calls older than 60s so softphone never gets stuck
  const staleCutoff = new Date(Date.now() - 60 * 1000);
  await prisma.whatsAppCall
    .updateMany({
      where: { workspaceId, status: "RINGING", startedAt: { lt: staleCutoff } },
      data: { status: "MISSED", endedAt: new Date() },
    })
    .catch(() => {});

  if (activeOnly) {
    const activeCalls = await prisma.whatsAppCall.findMany({
      where: { workspaceId, status: { in: ["RINGING", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    return NextResponse.json({ ok: true, activeCalls });
  }

  const [calls, callingMeta] = await Promise.all([
    prisma.whatsAppCall.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    getWhatsAppCallingSettings(workspaceId),
  ]);
  return NextResponse.json({
    ok: true,
    calls,
    callingStatus: callingMeta.status,
    callingDetail: callingMeta.detail || "",
  });
}

// POST /api/voip/whatsapp — Manage WhatsApp Business Calling API actions + Gemini audio summary
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    if (workspaceId.startsWith("__")) {
      return NextResponse.json({ error: "Sin acceso activo." }, { status: 403 });
    }
    const session = await getCurrentSession();
    const contentType = req.headers.get("content-type") || "";

    // Multipart upload: summarize browser-recorded call audio with Gemini
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const callDbId = String(fd.get("callId") || "");
      const file = fd.get("audio") as File | null;
      if (!callDbId || !file || file.size === 0) {
        return NextResponse.json({ error: "Falta audio o ID de llamada." }, { status: 400 });
      }
      const callRow = await prisma.whatsAppCall.findFirst({ where: { id: callDbId, workspaceId } });
      if (!callRow) return NextResponse.json({ error: "Llamada no encontrada." }, { status: 404 });

      const cfg = await getIntegrationSettings(workspaceId);
      if (!cfg.aiApiKey) {
        return NextResponse.json({ error: "Configura tu API Key de Gemini para transcribir llamadas." }, { status: 400 });
      }

      const buf = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "audio/webm";
      const { text } = await callGeminiResilient({
        apiKey: cfg.aiApiKey,
        preferredModel: cfg.aiModel || "gemini-flash-lite-latest",
        temperature: 0.2,
        maxOutputTokens: 900,
        parts: [
          {
            text: `Transcribe esta llamada comercial de WhatsApp en español y entrega ÚNICAMENTE JSON válido:
{
  "transcript": "Transcripción clara y fiel de lo hablado",
  "summary": "Resumen ejecutivo en 2-3 frases con acuerdos, productos, cantidades, precios o próximo paso"
}`,
          },
          { inlineData: { mimeType, data: buf.toString("base64") } },
        ],
      });

      let transcript = text.trim();
      let aiSummary = text.trim().slice(0, 300);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.transcript) transcript = String(parsed.transcript);
          if (parsed.summary) aiSummary = String(parsed.summary);
        } catch {
          // keep fallback
        }
      }

      await prisma.whatsAppCall.update({
        where: { id: callRow.id },
        data: { transcript, aiSummary },
      });

      if (callRow.clientId) {
        await prisma.activity.create({
          data: {
            workspaceId,
            clientId: callRow.clientId,
            type: "LLAMADA",
            title: `🧠 Resumen IA de llamada WhatsApp (${callRow.callerName})`,
            description: `${aiSummary}\n\nTranscripción:\n${transcript.slice(0, 1200)}`,
            completed: true,
          },
        });
      }

      return NextResponse.json({ ok: true, transcript, aiSummary });
    }

    const body = await req.json();
    const action = String(body.action || "");

    // 1. Enable/Disable WhatsApp Business Calling on the Meta phone number (OWNER/SUPERADMIN)
    if (action === "enable_calling" || action === "disable_calling") {
      const guard = await requireOwnerOrAdmin();
      if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
      const res = await configureWhatsAppCallingSettings({
        workspaceId: guard.workspaceId,
        enabled: action === "enable_calling",
      });
      if (res.ok) {
        await logAuditEvent({
          workspaceId: guard.workspaceId,
          action: action === "enable_calling" ? "WA_VOIP_ENABLED" : "WA_VOIP_DISABLED",
          entityType: "VoIP",
          summary: res.info || "Actualizó estado de WhatsApp Calling API.",
        });
      }
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    // 2. Request official Call Permission from customer via WhatsApp interactive card
    if (action === "request_permission") {
      const to = normalizeCRPhone(String(body.to || ""));
      const res = await sendWhatsAppCallPermissionRequest({
        workspaceId,
        to,
        bodyText: typeof body.bodyText === "string" ? body.bodyText : undefined,
      });
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    // 3. Outbound WebRTC Call (Business-Initiated)
    if (action === "connect") {
      const to = normalizeCRPhone(String(body.to || ""));
      const sdp = String(body.sdp || "");
      const callerName = String(body.callerName || to);
      const clientId = typeof body.clientId === "string" ? body.clientId : null;
      if (!to || !sdp) {
        return NextResponse.json({ error: "Falta número de destino o SDP WebRTC." }, { status: 400 });
      }
      const metaRes = await controlWhatsAppCall({
        workspaceId,
        action: "connect",
        to,
        sdp,
        sdpType: "offer",
      });
      if (!metaRes.ok) {
        return NextResponse.json({ ok: false, error: metaRes.error }, { status: 400 });
      }
      const callRow = await prisma.whatsAppCall.create({
        data: {
          workspaceId,
          externalCallId: metaRes.callId || `out-${Date.now()}`,
          direction: "OUTBOUND",
          status: "RINGING",
          toPhone: to,
          callerName,
          clientId,
          agentEmail: session?.email || "",
          offerSdp: sdp,
        },
      });
      return NextResponse.json({ ok: true, call: callRow });
    }

    // 4. Accept Inbound WebRTC Call (pre_accept + accept with browser SDP answer)
    if (action === "accept") {
      const callDbId = String(body.callDbId || "");
      const answerSdp = String(body.sdp || "");
      const callRow = await prisma.whatsAppCall.findFirst({ where: { id: callDbId, workspaceId } });
      if (!callRow || !answerSdp) {
        return NextResponse.json({ error: "Llamada o SDP answer no válidos." }, { status: 400 });
      }
      await controlWhatsAppCall({
        workspaceId,
        action: "pre_accept",
        callId: callRow.externalCallId,
        sdp: answerSdp,
        sdpType: "answer",
      });
      const acc = await controlWhatsAppCall({
        workspaceId,
        action: "accept",
        callId: callRow.externalCallId,
        sdp: answerSdp,
        sdpType: "answer",
      });
      if (!acc.ok) {
        return NextResponse.json({ ok: false, error: acc.error }, { status: 400 });
      }
      const updated = await prisma.whatsAppCall.update({
        where: { id: callRow.id },
        data: {
          status: "ACTIVE",
          answerSdp,
          agentEmail: session?.email || "",
          answeredAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, call: updated });
    }

    // 5. Reject or Terminate active call
    if (action === "reject" || action === "terminate") {
      const callDbId = String(body.callDbId || "");
      const callRow = await prisma.whatsAppCall.findFirst({ where: { id: callDbId, workspaceId } });
      if (!callRow) return NextResponse.json({ error: "Llamada no encontrada." }, { status: 404 });

      if (callRow.externalCallId) {
        await controlWhatsAppCall({
          workspaceId,
          action,
          callId: callRow.externalCallId,
        }).catch(() => {});
      }

      const dur = callRow.answeredAt
        ? Math.max(1, Math.round((Date.now() - callRow.answeredAt.getTime()) / 1000))
        : 0;
      const updated = await prisma.whatsAppCall.update({
        where: { id: callRow.id },
        data: {
          status: action === "reject" ? "REJECTED" : "ENDED",
          durationSeconds: dur,
          endedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, call: updated });
    }

    return NextResponse.json({ error: "Acción VoIP no reconocida." }, { status: 400 });
  } catch (err) {
    console.error("VoIP WhatsApp API error:", err);
    return NextResponse.json({ error: "Error procesando llamada VoIP." }, { status: 500 });
  }
}
