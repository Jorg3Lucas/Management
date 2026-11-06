import { groupServers } from "@/lib/server-groups";
import type { ServerRow } from "@/lib/types";

export function ServerAccessGrid({
  servers,
  selectedIds,
}: {
  servers: ServerRow[];
  selectedIds: number[];
}) {
  const selected = new Set(selectedIds);
  return (
    <>
      {groupServers(servers).map(([group, list]) => (
        <div key={group} className="server-list-group">
          <div className="group-title">{group}</div>
          <div className="access-grid">
            {list.map((server) => (
              <label key={server.id} className="access-item check">
                <input
                  type="checkbox"
                  name="servers"
                  value={server.id}
                  defaultChecked={selected.has(server.id)}
                />
                <span>
                  <span style={{ fontWeight: 600 }}>{server.label}</span>
                  <span className="code">{server.code}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
