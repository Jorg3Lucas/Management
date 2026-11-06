import { getServerByCode } from "../lib/queries";
import { syncAllServers, syncEnabledServers, syncServer } from "../lib/sync";
import type { SyncResult } from "../lib/sync";

async function main() {
  const argv = process.argv.slice(2);
  const args = argv.filter((arg) => !arg.startsWith("-"));
  const all = argv.includes("--all");
  const results: SyncResult[] = [];

  if (args.length === 0) {
    results.push(...(all ? await syncAllServers("cli") : await syncEnabledServers("cli")));
  } else {
    for (const code of args) {
      const server = getServerByCode(code.toUpperCase());
      if (!server) {
        console.error(`Servidor ${code} não encontrado.`);
        process.exitCode = 1;
        continue;
      }
      results.push(await syncServer(server.id, { source: "cli" }));
    }
  }

  for (const result of results) {
    console.log(
      `${result.serverLabel.padEnd(10)} ${result.status.padEnd(8)} ` +
        `${String(result.fetched).padStart(4)} linhas | ${result.created} novos | ` +
        `${result.updated} atualizados | ${result.skipped} protegidos | ` +
        `${result.pages} pág. | ${(result.durationMs / 1000).toFixed(1)}s` +
        (result.message ? `\n           ${result.message}` : ""),
    );
  }

  if (results.some((result) => result.status === "error")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
