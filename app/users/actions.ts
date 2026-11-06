"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  countAdmins,
  createUser,
  getUserById,
  requireAdmin,
  resetUserPassword,
  setUserActive,
  setUserServers,
} from "@/lib/auth";
import { execute } from "@/lib/db";
import { listServers } from "@/lib/queries";
import { validatePassword } from "@/lib/password";
import type { Role } from "@/lib/types";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parseRole(value: FormDataEntryValue | null): Role | null {
  return value === "ADMIN" || value === "USER" ? value : null;
}

function validServerIds(formData: FormData): number[] {
  const allowed = new Set(listServers().map((server) => server.id));
  return [...new Set(formData.getAll("servers").map((value) => Number(value)))].filter((id) =>
    allowed.has(id),
  );
}

export async function createUserAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const username = cleanText(formData.get("username"), 32).toLowerCase();
  const displayName = cleanText(formData.get("displayName"), 60);
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    redirect(back("/users", "error", "Usuário deve ter de 3 a 32 caracteres: letras, números, ponto, hífen ou _."));
  }
  if (!displayName) redirect(back("/users", "error", "Informe o nome de exibição."));
  if (!role) redirect(back("/users", "error", "Papel inválido."));
  const passwordError = validatePassword(password);
  if (passwordError) redirect(back("/users", "error", passwordError));

  let userId: number;
  try {
    userId = createUser({ username, displayName, password, role });
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("UNIQUE");
    redirect(back("/users", "error", duplicate ? "Esse usuário já existe." : "Não foi possível criar o usuário."));
  }

  setUserServers(userId, validServerIds(formData));
  revalidatePath("/users");
  redirect(back(`/users/${userId}`, "ok", `Usuário ${username} criado. Defina os servidores liberados abaixo.`));
}

export async function updateUserProfileAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const target = getUserById(userId);
  const path = `/users/${userId}`;

  if (!target) redirect(back("/users", "error", "Usuário não encontrado."));

  const displayName = cleanText(formData.get("displayName"), 60);
  const role = parseRole(formData.get("role"));

  if (!displayName) redirect(back(path, "error", "Informe o nome de exibição."));
  if (!role) redirect(back(path, "error", "Papel inválido."));

  if (userId === admin.id && role !== target.role) {
    redirect(back(path, "error", "Você não pode alterar o seu próprio papel."));
  }
  if (target.role === "ADMIN" && role !== "ADMIN" && target.active && countAdmins() <= 1) {
    redirect(back(path, "error", "Precisa existir pelo menos um administrador ativo."));
  }

  execute("UPDATE users SET display_name = ?, role = ? WHERE id = ?", displayName, role, userId);
  revalidatePath("/users");
  redirect(back(path, "ok", "Perfil atualizado."));
}

export async function updateUserAccessAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const target = getUserById(userId);
  const path = `/users/${userId}`;

  if (!target) redirect(back("/users", "error", "Usuário não encontrado."));

  const serverIds = validServerIds(formData);
  setUserServers(userId, serverIds);

  revalidatePath(path);
  revalidatePath("/users");
  revalidatePath("/");
  redirect(
    back(
      path,
      "ok",
      serverIds.length === 0
        ? "Acessos removidos. O usuário não verá nenhum servidor."
        : `${serverIds.length} servidor(es) liberado(s).`,
    ),
  );
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const target = getUserById(userId);
  const path = `/users/${userId}`;
  const password = String(formData.get("password") ?? "");

  if (!target) redirect(back("/users", "error", "Usuário não encontrado."));
  const passwordError = validatePassword(password);
  if (passwordError) redirect(back(path, "error", passwordError));

  resetUserPassword(userId, password);
  redirect(back(path, "ok", "Senha redefinida. Sessões antigas foram encerradas."));
}

export async function toggleUserActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const target = getUserById(userId);
  const path = `/users/${userId}`;
  const activate = formData.get("active") === "1";

  if (!target) redirect(back("/users", "error", "Usuário não encontrado."));
  if (userId === admin.id) redirect(back(path, "error", "Você não pode desativar o seu próprio usuário."));
  if (!activate && target.role === "ADMIN" && target.active && countAdmins() <= 1) {
    redirect(back(path, "error", "Precisa existir pelo menos um administrador ativo."));
  }

  setUserActive(userId, activate);
  revalidatePath("/users");
  redirect(back(path, "ok", activate ? "Usuário reativado." : "Usuário desativado."));
}
