import { NextRequest, NextResponse } from "next/server";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { syncCrmFromConversation } from "@/lib/crm-autopilot";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const { id } = await context.params;
    const result = await syncCrmFromConversation(id, workspaceId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("Manual CRM autopilot sync error:", err);
    return NextResponse.json(
      { error: "No se pudo analizar la conversación con IA." },
      { status: 500 }
    );
  }
}
