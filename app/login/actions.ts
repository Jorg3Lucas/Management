"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, verifyCredentials } from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    redirect("/login?error=" + encodeURIComponent("Informe usuário e senha."));
  }

  const user = verifyCredentials(username, password);
  if (!user) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    redirect("/login?error=" + encodeURIComponent("Usuário ou senha inválidos."));
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
