import type { ServerRow } from "../types";

export type RankingRow = {
  rank: number;
  name: string;
  clan: string | null;
  power: number;
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      try {
        return String.fromCodePoint(Number(dec));
      } catch {
        return "";
      }
    })
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);
}

function stripHtml(value: string): string {
  return decodeEntities(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O ranking do fórum vem renderizado no HTML quando a página é carregada com
 * `loaded=1`. Cada linha tem 4 células: posição, personagem, clã, poder.
 */
export function parseForumRanking(html: string): RankingRow[] {
  const rows: RankingRow[] = [];
  const rowPattern = /<tr[^>]*class="[^"]*list_article[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const match of html.matchAll(rowPattern)) {
    const rowHtml = match[1];
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[1]));

    const rankMatch = /<span class="num">\s*([\d,]+)\s*<\/span>/.exec(rowHtml);
    const nameMatch = /<span class="user_name">([\s\S]*?)<\/span>/.exec(rowHtml);
    if (!rankMatch || !nameMatch) continue;

    const rank = Number(rankMatch[1].replace(/[^\d]/g, ""));
    const name = stripHtml(nameMatch[1]);
    const clan = cells[2] ? cells[2] : null;
    const powerCell = cells.length >= 4 ? cells[cells.length - 1] : cells[cells.length - 1];
    const power = Number((powerCell ?? "").replace(/[^\d]/g, ""));

    if (!name || !Number.isFinite(rank) || !Number.isFinite(power)) continue;
    rows.push({ rank, name, clan: clan && clan.length > 0 ? clan : null, power });
  }

  return rows;
}

export function rankingUrl(server: Pick<ServerRow, "worldgroup_id" | "world_id">, page: number): string {
  const base = (process.env.MIR4_RANK_BASE || "https://forum.mir4global.com").replace(/\/+$/, "");
  return `${base}/rank?ranktype=1&worldgroupid=${server.worldgroup_id}&worldid=${server.world_id}&loaded=1&page=${page}`;
}

export async function fetchRankingPage(
  server: Pick<ServerRow, "worldgroup_id" | "world_id" | "code">,
  page: number,
): Promise<string> {
  const url = rankingUrl(server, page);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
      Referer: "https://forum.mir4global.com/rank?ranktype=1",
    },
  });

  if (!response.ok) {
    throw new Error(`O fórum respondeu HTTP ${response.status} para ${server.code} (página ${page}).`);
  }

  return response.text();
}

export function isRankingEmptyMessage(html: string): boolean {
  return /being compiled|is being complied|ranking is being/i.test(html);
}
