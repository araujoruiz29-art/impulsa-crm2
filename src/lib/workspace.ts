import { cookies } from "next/headers";

export const WORKSPACE_COOKIE = "crm_workspace_id";

export async function getActiveWorkspaceId(): Promise<string> {
  try {
    const store = await cookies();
    const id = store.get(WORKSPACE_COOKIE)?.value;
    if (id && id.trim()) return id.trim();
  } catch {
    // Fallback outside request context (scripts / webhooks)
  }
  return "default";
}
