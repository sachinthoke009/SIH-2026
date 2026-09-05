"use server";

import { db } from "@/db";
import { ruleSets, users } from "@/db/schema";
import { hashPassword, requireRole } from "@/lib/auth";
import { DEFAULT_R76_RULES, type R76RuleConfig } from "@/lib/r76/rules";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createUserAction(_prev: { error?: string; ok?: boolean } | undefined, fd: FormData) {
  await requireRole("admin");
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const role = String(fd.get("role") ?? "tester");
  const designation = String(fd.get("designation") ?? "").trim() || null;
  if (!name || !email || password.length < 6) return { error: "Name, email and a password of at least 6 characters are required." };
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists.length) return { error: "A user with this email already exists." };
  await db.insert(users).values({ name, email, passwordHash: hashPassword(password), role, designation });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleUserAction(fd: FormData) {
  const me = await requireRole("admin");
  const id = Number(fd.get("id"));
  const active = String(fd.get("active")) === "true";
  if (id === me.id) return;
  await db.update(users).set({ active }).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function setRoleAction(fd: FormData) {
  const me = await requireRole("admin");
  const id = Number(fd.get("id"));
  const role = String(fd.get("role"));
  if (id === me.id || !["admin", "tester", "reviewer"].includes(role)) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function publishRuleSetAction(_prev: { error?: string; ok?: boolean } | undefined, fd: FormData) {
  await requireRole("admin");
  const version = String(fd.get("version") ?? "").trim();
  const title = String(fd.get("title") ?? "").trim();
  const raw = String(fd.get("config") ?? "");
  let config: R76RuleConfig;
  try {
    config = JSON.parse(raw);
  } catch {
    return { error: "Configuration is not valid JSON." };
  }
  for (const k of ["classes", "mpeBands", "weighing", "repeatability", "eccentricity"] as const) if (!(k in config)) return { error: `Configuration is missing required key "${k}".` };
  if (!version) return { error: "Version label is required." };
  const activate = String(fd.get("activate")) === "on";
  if (activate) await db.update(ruleSets).set({ active: false });
  await db.insert(ruleSets).values({ code: config.code || DEFAULT_R76_RULES.code, version, title: title || config.title || DEFAULT_R76_RULES.title, config: { ...config, version, title: title || config.title }, active: activate });
  revalidatePath("/admin/rules");
  return { ok: true };
}

export async function activateRuleSetAction(fd: FormData) {
  await requireRole("admin");
  const id = Number(fd.get("id"));
  await db.update(ruleSets).set({ active: false });
  await db.update(ruleSets).set({ active: true }).where(eq(ruleSets.id, id));
  revalidatePath("/admin/rules");
}
