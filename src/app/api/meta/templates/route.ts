import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { normalizeCRPhone } from "@/lib/format";

export interface MetaTemplateItem {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string;
  headerText: string;
  variableCount: number;
}

// GET: Fetch approved WhatsApp Message Templates directly from the company's Meta WABA
export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const cfg = await getIntegrationSettings(workspaceId);

    if (!cfg.metaAccessToken || !cfg.metaWabaId) {
      return NextResponse.json(
        {
          templates: [],
          warning:
            "Falta configurar el Token Permanente y el WABA ID en Conexiones y empresa → Meta Cloud API.",
        },
        { status: 200 }
      );
    }

    const url = `https://graph.facebook.com/v21.0/${cfg.metaWabaId}/message_templates?limit=60&fields=id,name,language,category,status,components`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.metaAccessToken}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          templates: [],
          error: data?.error?.message || `Error consultando plantillas en Meta (${res.status})`,
        },
        { status: 400 }
      );
    }

    const rawList = Array.isArray(data.data) ? data.data : [];
    const templates: MetaTemplateItem[] = rawList
      .filter((t: { status?: string; name?: string }) => {
        if (String(t.status || "").toUpperCase() !== "APPROVED") return false;
        // Hide Meta's demo hello_world template on real production numbers
        if (t.name === "hello_world") return false;
        return true;
      })
      .map(
        (t: {
          id?: string;
          name?: string;
          language?: string;
          category?: string;
          status?: string;
          components?: Array<{ type?: string; text?: string }>;
        }) => {
          const comps = Array.isArray(t.components) ? t.components : [];
          const bodyComp = comps.find((c) => String(c.type || "").toUpperCase() === "BODY");
          const headerComp = comps.find((c) => String(c.type || "").toUpperCase() === "HEADER");
          const bodyText = String(bodyComp?.text || "");
          const headerText = String(headerComp?.text || "");
          const matches = bodyText.match(/\{\{\d+\}\}/g) || [];
          const uniqueVars = new Set(matches);

          return {
            id: String(t.id || t.name || ""),
            name: String(t.name || ""),
            language: String(t.language || "es"),
            category: String(t.category || "UTILITY"),
            status: String(t.status || "APPROVED"),
            bodyText,
            headerText,
            variableCount: uniqueVars.size,
          };
        }
      );

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("Fetch Meta templates error:", err);
    return NextResponse.json(
      { templates: [], error: "No se pudieron consultar las plantillas de Meta." },
      { status: 500 }
    );
  }
}

// POST: Send an approved Meta Template to a WhatsApp conversation (works even after the 24h window expires!)
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const [cfg, company] = await Promise.all([
      getIntegrationSettings(workspaceId),
      getCompanySettings(workspaceId),
    ]);

    if (!cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
      return NextResponse.json(
        { error: "Meta Cloud API no está configurada en esta empresa." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const conversationId = String(body.conversationId || "").trim();
    const toPhone = normalizeCRPhone(String(body.to || ""));
    const templateName = String(body.templateName || "").trim();
    const language = String(body.language || "es").trim();
    const variables: string[] = Array.isArray(body.variables)
      ? body.variables.map((v: unknown) => String(v ?? "").trim())
      : [];
    const renderedPreview = String(body.renderedPreview || `📋 Plantilla Meta: ${templateName}`).trim();

    if (!templateName || !toPhone) {
      return NextResponse.json(
        { error: "Falta el nombre de la plantilla o el número de destino." },
        { status: 400 }
      );
    }

    const components =
      variables.length > 0
        ? [
            {
              type: "body",
              parameters: variables.map((v) => ({ type: "text", text: v || "Cliente" })),
            },
          ]
        : undefined;

    const payload = {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        ...(components ? { components } : {}),
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.metaPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.metaAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || `Error enviando plantilla (${res.status})` },
        { status: 400 }
      );
    }

    const externalMessageId = data?.messages?.[0]?.id || `tpl-${Date.now()}`;

    if (conversationId) {
      await prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          senderName: `${company.defaultSeller} · Plantilla Meta`,
          senderRole: "AGENT",
          body: `📋 [${templateName}]\n${renderedPreview}`,
          externalMessageId,
          status: "SENT",
        },
      });
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          unreadCount: 0,
          lastMessageAt: new Date(),
          lastMessagePreview: `📋 ${renderedPreview.slice(0, 125)}`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      externalMessageId,
      message: `Plantilla "${templateName}" enviada correctamente vía WhatsApp Cloud API.`,
    });
  } catch (err) {
    console.error("Send Meta template error:", err);
    return NextResponse.json({ error: "Error enviando plantilla de Meta." }, { status: 500 });
  }
}
