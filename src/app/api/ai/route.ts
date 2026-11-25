import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractQuoteDraftFromText, generateAiReply } from "@/lib/ai-agent";
import { formatMoney } from "@/lib/format";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { getIntegrationSettings } from "@/lib/prisma";
import { callGeminiResilient } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "reply";

    if (action === "test") {
      const cfg = await getIntegrationSettings();
      if (!cfg.aiApiKey) {
        return NextResponse.json({ ok: false, error: "Primero pega tu API Key y guarda." }, { status: 400 });
      }
      if (cfg.aiProvider === "gemini") {
        const res = await callGeminiResilient({
          apiKey: cfg.aiApiKey,
          preferredModel: cfg.aiModel,
          parts: [{ text: "Responde únicamente: Conexión Gemini OK" }],
          maxOutputTokens: 40,
        });
        return NextResponse.json({
          ok: true,
          message: `Gemini conectado correctamente (modelo activo: ${res.modelUsed})`,
        });
      }
      return NextResponse.json({ ok: true, message: `Proveedor ${cfg.aiProvider} configurado.` });
    }

    if (action === "extract_quote") {
      const text = String(body.text || "").trim();
      if (!text) {
        return NextResponse.json({ error: "Ingresa el texto o mensaje del cliente." }, { status: 400 });
      }
      const draft = await extractQuoteDraftFromText(text);
      return NextResponse.json({ draft });
    }

    // Internal CRM Assistant: queries live CRM data and can create tasks / appointments!
    if (action === "assistant_chat") {
      const workspaceId = await getActiveWorkspaceId();
      const prompt = String(body.message || "").trim();
      const lower = prompt.toLowerCase();

      const [clients, quotes, tasks] = await Promise.all([
        prisma.client.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 30 }),
        prisma.quote.findMany({ where: { workspaceId }, orderBy: { number: "desc" }, take: 20 }),
        prisma.activity.findMany({ where: { workspaceId, completed: false }, include: { client: true }, take: 15 }),
      ]);

      // Check if user wants to create a task / appointment / call
      if (
        lower.includes("agendar") ||
        lower.includes("agenda ") ||
        lower.includes("crear tarea") ||
        lower.includes("recordar") ||
        lower.includes("cita") ||
        lower.includes("llamar a")
      ) {
        const matchedClient = clients.find(
          (c) =>
            lower.includes(c.company.toLowerCase()) ||
            (c.contactName && lower.includes(c.contactName.toLowerCase()))
        );
        const isTomorrow = lower.includes("mañana") || lower.includes("manana");
        const dueDate = new Date(Date.now() + (isTomorrow ? 24 : 4) * 3600 * 1000);
        const type = lower.includes("llam") ? "LLAMADA" : "TAREA";

        const created = await prisma.activity.create({
          data: {
            workspaceId,
            clientId: matchedClient?.id || null,
            type,
            title: prompt.slice(0, 120),
            description: "Creada automáticamente por el Asistente IA del CRM.",
            dueDate,
            completed: false,
          },
        });

        return NextResponse.json({
          reply: `✅ Listo, creé la ${type === "LLAMADA" ? "llamada" : "tarea/cita"} en tu Agenda:\n• **${created.title}**${
            matchedClient ? `\n• Cliente vinculado: **${matchedClient.company}**` : ""
          }\n• Fecha programada: ${dueDate.toLocaleString("es-CR")}\n\nPuedes verla en la sección **Agenda y Reportes**.`,
          createdTaskId: created.id,
        });
      }

      // Check if user asks about pending quotes / pipeline / clients
      if (lower.includes("proforma") || lower.includes("cotizac") || lower.includes("pendiente") || lower.includes("resumen")) {
        const sent = quotes.filter((q) => ["ENVIADA", "SEGUIMIENTO"].includes(q.status));
        const sentSum = sent.reduce((a, q) => a + q.total, 0);
        const list = sent
          .slice(0, 5)
          .map((q) => `• Proforma #${q.number} — ${q.clientCompany} (${formatMoney(q.total, q.currency)}) [${q.status}]`)
          .join("\n");
        const taskList = tasks
          .slice(0, 5)
          .map((t) => `• ${t.title}${t.client ? ` (${t.client.company})` : ""}`)
          .join("\n");

        return NextResponse.json({
          reply: `📊 **Resumen en vivo de tu CRM:**\n• Clientes totales: **${clients.length}**\n• Proformas en seguimiento: **${sent.length}** por un total de **${formatMoney(sentSum)}**\n${
            list ? `\n**Proformas activas:**\n${list}` : ""
          }\n${taskList ? `\n**Tareas / Citas pendientes (${tasks.length}):**\n${taskList}` : "\nNo tienes tareas pendientes."}\n\n💡 También puedes decirme: *"Agenda llamada con Tico Frut mañana para confirmar botas"*.`,
        });
      }

      // Reactivation query
      if (lower.includes("reactiva") || lower.includes("compraron") || lower.includes("clientes")) {
        const summary = clients
          .slice(0, 6)
          .map((c) => `• **${c.company}** (${c.stage}) — Est: ${formatMoney(c.estimatedValue)} · Tel: ${c.phone || "-"}`)
          .join("\n");
        return NextResponse.json({
          reply: `👥 **Clientes en tu base de datos (${clients.length}):**\n${summary}\n\nPuedes ejecutar la regla de **Reactivación de clientes anteriores** o pedirle al asistente que agende una llamada con cualquiera de ellos.`,
        });
      }

      // General AI response with CRM context
      const crmContext = `Clientes activos: ${clients.length}. Proformas: ${quotes.length}. Tareas pendientes: ${tasks.length}.`;
      const result = await generateAiReply({
        userMessage: `[Consulta interna del vendedor sobre el CRM. ${crmContext}] ${prompt}`,
        channel: "INTERNAL",
        clientName: "Jelsing",
      });
      return NextResponse.json(result);
    }

    let conversationHistory: { role: string; body: string }[] = [];
    let clientName = body.clientName || "";
    let clientCompany = body.clientCompany || "";
    let channel = body.channel || "WHATSAPP";
    let userMessage = String(body.message || "").trim();

    if (body.conversationId) {
      const conv = await prisma.conversation.findUnique({
        where: { id: String(body.conversationId) },
        include: { client: true, messages: { orderBy: { createdAt: "asc" }, take: 12 } },
      });
      if (conv) {
        channel = conv.channel;
        clientName = conv.client?.contactName || conv.client?.company || conv.subject;
        clientCompany = conv.client?.company || "";
        conversationHistory = conv.messages.map((m) => ({
          role: m.direction === "INBOUND" ? "Cliente" : "Asistente",
          body: m.body,
        }));
        if (!userMessage) {
          const lastInbound = [...conv.messages].reverse().find((m) => m.direction === "INBOUND");
          userMessage = lastInbound?.body || "Hola, solicito información para cotizar.";
        }
      }
    }

    const result = await generateAiReply({
      userMessage: userMessage || "Hola, quiero cotizar uniformes y bordados.",
      channel,
      clientName,
      clientCompany,
      conversationHistory,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("AI endpoint error:", err);
    return NextResponse.json({ error: "Error en el Agente de IA." }, { status: 500 });
  }
}
