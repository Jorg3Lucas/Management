import { getSessionUser } from "@/lib/auth";
import { getServerByCode } from "@/lib/queries";
import { syncEnabledServers, syncServer } from "@/lib/sync";

export const runtime = "nodejs";

async function isAuthorized(request: Request): Promise<boolean> {
  const token = process.env.SYNC_TOKEN;
  const header = request.headers.get("authorization");
  if (token && header === `Bearer ${token}`) return true;

  const user = await getSessionUser();
  return user?.role === "ADMIN";
}

/**
 * Sincronização por HTTP, para uso em cron/agendador:
 *   POST /api/sync                      -> todos os servidores habilitados
 *   POST /api/sync?server=EU011         -> apenas um servidor
 * Autenticação: Authorization: Bearer $SYNC_TOKEN ou sessão de admin.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await isAuthorized(request))) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  let serverCode = url.searchParams.get("server");

  if (!serverCode && request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = (await request.json()) as { server?: string };
      serverCode = body.server ?? null;
    } catch {
      // corpo vazio/inválido: segue com todos
    }
  }

  if (serverCode) {
    const server = getServerByCode(serverCode.toUpperCase());
    if (!server) {
      return Response.json({ error: `Servidor ${serverCode} não encontrado.` }, { status: 404 });
    }
    const result = await syncServer(server.id, { source: "api" });
    return Response.json({ results: [result] });
  }

  const results = await syncEnabledServers("api");
  return Response.json({ results });
}
