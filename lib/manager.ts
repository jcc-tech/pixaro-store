import { headers } from "next/headers";

export async function managerAccess() {
  const identity = await headers();
  const email = identity.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) return "anonymous";
  const { env } = await import("cloudflare:workers");
  const settings = env as unknown as { PIXARO_MANAGER_EMAILS?: string };
  const allowed = (settings.PIXARO_MANAGER_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase());
  return allowed.includes(email) ? "manager" : "forbidden";
}

export async function rejectNonManager() {
  const access = await managerAccess();
  return access === "manager" ? null : Response.json({ error: "需要管理權限" }, {
    status: access === "anonymous" ? 401 : 403, headers: { "Cache-Control": "no-store" }
  });
}
