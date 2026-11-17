"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeOwnPassword, requireUser, verifyUserPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getT } from "@/lib/i18n";
import { validatePassword } from "@/lib/password";

function back(kind: "ok" | "error", message: string): string {
  return `/account?${kind}=${encodeURIComponent(message)}`;
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const { t } = await getT();

  const current = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !password || !confirm) redirect(back("error", t("err.accountFields")));
  if (!verifyUserPassword(user.id, current)) redirect(back("error", t("err.passwordCurrent")));
  if (password !== confirm) redirect(back("error", t("err.passwordMismatch")));
  if (password === current) redirect(back("error", t("err.passwordSame")));

  const passwordError = validatePassword(password);
  if (passwordError) redirect(back("error", passwordError));

  await changeOwnPassword(user.id, password);

  logAudit({
    user,
    action: "user.password.self",
    entity: "user",
    entityId: user.id,
    detail: user.username,
  });

  revalidatePath("/account");
  redirect(back("ok", t("account.passwordChanged")));
}
