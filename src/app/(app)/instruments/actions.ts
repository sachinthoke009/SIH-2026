"use server";

import { db } from "@/db";
import { instruments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

function num(fd: FormData, k: string, def: number | null = null) {
  const v = String(fd.get(k) ?? "").trim();
  if (v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function str(fd: FormData, k: string) {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

export async function saveInstrumentAction(_prev: { error?: string } | undefined, fd: FormData) {
  const user = await requireRole("admin", "tester");
  const id = num(fd, "id");
  const values = {
    manufacturer: str(fd, "manufacturer") ?? "",
    manufacturerAddress: str(fd, "manufacturerAddress"),
    applicant: str(fd, "applicant"),
    applicantAddress: str(fd, "applicantAddress"),
    model: str(fd, "model") ?? "",
    serialNumber: str(fd, "serialNumber") ?? "",
    instrumentType: str(fd, "instrumentType") ?? "Other",
    accuracyClass: str(fd, "accuracyClass") ?? "III",
    unit: str(fd, "unit") ?? "kg",
    maxCapacity: num(fd, "maxCapacity", 0)!,
    minCapacity: num(fd, "minCapacity", 0)!,
    verificationInterval: num(fd, "verificationInterval", 0)!,
    actualInterval: num(fd, "actualInterval", 0)!,
    indicationType: str(fd, "indicationType") ?? "digital",
    powerSupply: str(fd, "powerSupply"),
    loadCell: str(fd, "loadCell"),
    indicator: str(fd, "indicator"),
    softwareVersion: str(fd, "softwareVersion"),
    tempRangeMin: num(fd, "tempRangeMin", -10),
    tempRangeMax: num(fd, "tempRangeMax", 40),
    description: str(fd, "description"),
  };
  if (!values.manufacturer || !values.model || !values.serialNumber) return { error: "Manufacturer, model and serial number are required." };
  if (values.maxCapacity <= 0 || values.verificationInterval <= 0 || values.actualInterval <= 0) return { error: "Max, e and d must be positive numbers." };

  let instrumentId = id;
  if (id) {
    await db.update(instruments).set(values).where(eq(instruments.id, id));
  } else {
    const [row] = await db.insert(instruments).values({ ...values, createdBy: user.id }).returning({ id: instruments.id });
    instrumentId = row.id;
  }
  revalidatePath("/instruments");
  const next = String(fd.get("next") ?? "");
  if (next === "report") redirect(`/reports/new?instrumentId=${instrumentId}`);
  redirect(`/instruments/${instrumentId}`);
}
