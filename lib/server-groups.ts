import type { ServerRow } from "./types";

export function groupServers(servers: ServerRow[]): [string, ServerRow[]][] {
  const groups = new Map<string, ServerRow[]>();
  for (const server of servers) {
    const list = groups.get(server.group_name) ?? [];
    list.push(server);
    groups.set(server.group_name, list);
  }
  return [...groups.entries()];
}
