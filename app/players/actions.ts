"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ensureClan, logClanChange } from "@/lib/clans";
import { execute, queryOne } from "@/lib/db";
import { playerForCharacter, setHomeServer } from "@/lib/players";
import { getCharacterWithServer, getServerById } from "@/lib/queries";
import { zonedInputToUtc } from "@/lib/time";
import { WAR_TYPES } from "@/lib/format";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parsePower(value: FormDataEntryValue | null): number | null {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const power = Number(digits);
  if (!Number.isFinite(power) || power <= 0 || power > 100_000_000) return null;
  return power;
}

function parseLevel(value: FormDataEntryValue | null): number | null {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const level = Number(digits);
  if (!Number.isFinite(level) || level < 1 || level > 200) return null;
  return level;
}

export async function createCharacterAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back("/players", "error", "Servidor inválido ou sem permissão de edição."));
  }

  const name = cleanText(formData.get("name"), 60);
  const power = parsePower(formData.get("power"));
  const clan = cleanText(formData.get("clan"), 60) || null;
  const className = cleanText(formData.get("className"), 40) || null;
  const level = parseLevel(formData.get("level"));

  if (!name) redirect(back("/players", "error", "Informe o nome do personagem."));
  if (power === null) redirect(back("/players", "error", "Informe um poder válido."));

  const now = new Date().toISOString();
  const clanRow = clan ? ensureClan(clan) : null;
  let characterId: number;

  try {
    const result = execute(
      `INSERT INTO characters
        (server_id, name, clan, clan_id, class_name, level, power_score, peak_power, peak_power_at,
         rank_position, notes, sync_locked, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, ?, ?)`,
      serverId,
      name,
      clan,
      clanRow?.id ?? null,
      className,
      level,
      power,
      power,
      now,
      now,
      now,
    );
    characterId = result.lastInsertRowid;
    execute(
      `INSERT INTO power_history (character_id, power_score, rank_position, source, captured_at)
       VALUES (?, ?, NULL, 'manual', ?)`,
      characterId,
      power,
      now,
    );
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("UNIQUE");
    redirect(
      back(
        "/players",
        "error",
        duplicate ? "Já existe um personagem com esse nome neste servidor." : "Não foi possível cadastrar o personagem.",
      ),
    );
  }

  logAudit({
    user,
    action: "character.create",
    entity: "character",
    entityId: characterId,
    serverId,
    detail: `${name} (${power}) cadastrado manualmente`,
  });

  revalidatePath("/players");
  revalidatePath("/");
  redirect(back(`/players/${characterId}`, "ok", "Personagem cadastrado manualmente."));
}

export async function updateCharacterAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const characterId = Number(formData.get("characterId"));
  const character = getCharacterWithServer(characterId);

  if (!character) redirect(back("/players", "error", "Personagem não encontrado."));
  if (!canEditServer(user, character.server_id)) {
    redirect(back("/players", "error", "Sem permissão de edição neste servidor."));
  }

  const detail = `/players/${characterId}`;
  const name = cleanText(formData.get("name"), 60);
  const power = parsePower(formData.get("power"));
  const clan = cleanText(formData.get("clan"), 60) || null;
  const className = cleanText(formData.get("className"), 40) || null;
  const level = parseLevel(formData.get("level"));
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  const syncLocked = formData.get("syncLocked") === "on" ? 1 : 0;

  if (!name) redirect(back(detail, "error", "O nome não pode ficar vazio."));
  if (power === null) redirect(back(detail, "error", "Informe um poder válido."));

  const now = new Date().toISOString();
  const peak = Math.max(character.peak_power, power);
  const peakAt = power > character.peak_power ? now : character.peak_power_at;
  const clanRow = clan ? ensureClan(clan) : null;

  try {
    execute(
      `UPDATE characters
       SET name = ?, clan = ?, clan_id = ?, class_name = ?, level = ?, power_score = ?, peak_power = ?,
           peak_power_at = ?, notes = ?, sync_locked = ?, updated_at = ?
       WHERE id = ?`,
      name,
      clan,
      clanRow?.id ?? null,
      className,
      level,
      power,
      peak,
      peakAt,
      notes,
      syncLocked,
      now,
      characterId,
    );
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("UNIQUE");
    redirect(
      back(detail, "error", duplicate ? "Já existe outro personagem com esse nome no servidor." : "Não foi possível salvar."),
    );
  }

  if (clan !== character.clan) {
    logClanChange({
      characterId,
      previousName: character.clan,
      previousId: character.clan_id,
      nextName: clan,
      nextId: clanRow?.id ?? null,
      source: "manual",
      changedAt: now,
    });
  }

  if (power !== character.power_score) {
    execute(
      `INSERT INTO power_history (character_id, power_score, rank_position, source, captured_at)
       VALUES (?, ?, ?, 'manual', ?)`,
      characterId,
      power,
      character.rank_position,
      now,
    );
  }

  logAudit({
    user,
    action: "character.update",
    entity: "character",
    entityId: characterId,
    serverId: character.server_id,
    detail: `${character.name}: poder ${character.power_score} → ${power}${
      clan !== character.clan ? `, clã ${character.clan ?? "sem clã"} → ${clan ?? "sem clã"}` : ""
    }`,
  });

  revalidatePath(detail);
  revalidatePath("/players");
  revalidatePath("/");
  redirect(back(detail, "ok", "Dados do jogador atualizados."));
}

export async function addWarSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const characterId = Number(formData.get("characterId"));
  const character = getCharacterWithServer(characterId);

  if (!character) redirect(back("/wars", "error", "Personagem não encontrado."));
  if (!canEditServer(user, character.server_id)) {
    redirect(back("/wars", "error", "Sem permissão de edição neste servidor."));
  }

  const detail = `/players/${characterId}`;
  const warServerId = Number(formData.get("warServerId")) || character.server_id;
  if (!getServerById(warServerId) || !canEditServer(user, warServerId)) {
    redirect(back(detail, "error", "Servidor da guerra inválido ou sem acesso."));
  }

  const warType = String(formData.get("warType") ?? "server_war");
  if (!(warType in WAR_TYPES)) redirect(back(detail, "error", "Tipo de guerra inválido."));

  const started = zonedInputToUtc(String(formData.get("startedAt") ?? ""));
  if (!started) redirect(back(detail, "error", "Informe o início da guerra."));

  const endedRaw = String(formData.get("endedAt") ?? "").trim();
  const ended = endedRaw ? zonedInputToUtc(endedRaw) : null;
  if (endedRaw && !ended) redirect(back(detail, "error", "Data de fim inválida."));
  if (ended && ended.getTime() <= started.getTime()) {
    redirect(back(detail, "error", "O fim precisa ser depois do início."));
  }

  const opponent = cleanText(formData.get("opponent"), 60) || null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;

  execute(
    `INSERT INTO war_sessions
      (character_id, server_id, war_type, opponent, started_at, ended_at, notes, source, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
    characterId,
    warServerId,
    warType,
    opponent,
    started.toISOString(),
    ended ? ended.toISOString() : null,
    notes,
    user.id,
    new Date().toISOString(),
  );

  revalidatePath(detail);
  revalidatePath("/wars");
  revalidatePath("/");
  redirect(back(detail, "ok", ended ? "Guerra registrada e encerrada." : "Guerra iniciada. O tempo está sendo contado."));
}

export async function endWarSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sessionId = Number(formData.get("sessionId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/wars");

  const session = queryOne<{
    id: number;
    character_id: number;
    started_at: string;
    ended_at: string | null;
    home_server_id: number;
  }>(
    `SELECT w.id, w.character_id, w.started_at, w.ended_at, c.server_id AS home_server_id
     FROM war_sessions w JOIN characters c ON c.id = w.character_id
     WHERE w.id = ?`,
    sessionId,
  );

  if (!session) redirect(back(redirectTo, "error", "Guerra não encontrada."));
  if (!canEditServer(user, session.home_server_id)) {
    redirect(back(redirectTo, "error", "Sem permissão para alterar este registro."));
  }
  if (session.ended_at) redirect(back(redirectTo, "error", "Essa guerra já está encerrada."));

  const now = new Date();
  if (now.getTime() <= Date.parse(session.started_at)) {
    redirect(back(redirectTo, "error", "O início da guerra está no futuro. Ajuste o registro."));
  }

  execute("UPDATE war_sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL", now.toISOString(), sessionId);

  revalidatePath(redirectTo);
  revalidatePath("/wars");
  revalidatePath("/");
  redirect(back(redirectTo, "ok", "Guerra encerrada."));
}

export async function deleteWarSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sessionId = Number(formData.get("sessionId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/wars");

  const session = queryOne<{ id: number; home_server_id: number }>(
    `SELECT w.id, c.server_id AS home_server_id
     FROM war_sessions w JOIN characters c ON c.id = w.character_id
     WHERE w.id = ?`,
    sessionId,
  );

  if (!session) redirect(back(redirectTo, "error", "Guerra não encontrada."));
  if (!canEditServer(user, session.home_server_id)) {
    redirect(back(redirectTo, "error", "Sem permissão para alterar este registro."));
  }

  execute("DELETE FROM war_sessions WHERE id = ?", sessionId);

  revalidatePath(redirectTo);
  revalidatePath("/wars");
  revalidatePath("/");
  redirect(back(redirectTo, "ok", "Registro de guerra removido."));
}

/** Define o servidor casa do jogador (identidade compartilhada pelos personagens). */
export async function setHomeServerAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const characterId = Number(formData.get("characterId"));
  const serverId = Number(formData.get("serverId"));
  const character = getCharacterWithServer(characterId);
  const detail = `/players/${characterId}`;

  if (!character) redirect(back("/players", "error", "Personagem não encontrado."));
  if (!canEditServer(user, character.server_id)) {
    redirect(back(detail, "error", "Sem permissão de edição neste servidor."));
  }

  const player = playerForCharacter(characterId);
  if (!player) redirect(back(detail, "error", "Este personagem ainda não está ligado a um jogador."));

  const server = getServerById(serverId);
  if (!server) redirect(back(detail, "error", "Servidor inválido."));

  setHomeServer(player.id, server.id);

  logAudit({
    user,
    action: "player.home",
    entity: "player",
    entityId: player.id,
    serverId: server.id,
    detail: `${player.display_name}: servidor casa em ${server.label}`,
  });

  revalidatePath(detail);
  redirect(back(detail, "ok", `Servidor casa definido: ${server.label}.`));
}
