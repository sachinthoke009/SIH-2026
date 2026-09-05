import { db } from "@/db";
import { attachments, auditLogs, instruments, ruleSets, testReports, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { DEFAULT_R76_RULES, type R76RuleConfig } from "./r76/rules";
import type { InstrumentSpec } from "./r76/engine";
import { alias } from "drizzle-orm/pg-core";

export async function getActiveRuleSet() {
  const [rs] = await db.select().from(ruleSets).where(eq(ruleSets.active, true)).orderBy(desc(ruleSets.effectiveFrom)).limit(1);
  return rs ?? null;
}

export async function getRuleConfig(ruleSetId?: number | null): Promise<{ id: number | null; config: R76RuleConfig; label: string }> {
  if (ruleSetId) {
    const [rs] = await db.select().from(ruleSets).where(eq(ruleSets.id, ruleSetId)).limit(1);
    if (rs) return { id: rs.id, config: rs.config as R76RuleConfig, label: `${rs.code} ${rs.version}` };
  }
  const active = await getActiveRuleSet();
  if (active) return { id: active.id, config: active.config as R76RuleConfig, label: `${active.code} ${active.version}` };
  return { id: null, config: DEFAULT_R76_RULES, label: `${DEFAULT_R76_RULES.code} ${DEFAULT_R76_RULES.version}` };
}

export function specFromInstrument(i: typeof instruments.$inferSelect): InstrumentSpec {
  return {
    accuracyClass: i.accuracyClass as InstrumentSpec["accuracyClass"],
    unit: i.unit as "kg" | "g",
    max: i.maxCapacity,
    min: i.minCapacity,
    e: i.verificationInterval,
    d: i.actualInterval,
    indicationType: i.indicationType,
  };
}

export async function getReportBundle(id: number) {
  const tester = alias(users, "tester");
  const reviewer = alias(users, "reviewer");
  const rows = await db
    .select({ report: testReports, instrument: instruments, tester, reviewer })
    .from(testReports)
    .innerJoin(instruments, eq(testReports.instrumentId, instruments.id))
    .leftJoin(tester, eq(testReports.testedById, tester.id))
    .leftJoin(reviewer, eq(testReports.reviewedById, reviewer.id))
    .where(eq(testReports.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const files = await db
    .select({ id: attachments.id, fileName: attachments.fileName, mimeType: attachments.mimeType, caption: attachments.caption, size: attachments.size, createdAt: attachments.createdAt })
    .from(attachments)
    .where(eq(attachments.reportId, id))
    .orderBy(attachments.createdAt);
  const logs = await db
    .select({ log: auditLogs, userName: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(eq(auditLogs.reportId, id))
    .orderBy(desc(auditLogs.createdAt));
  const rule = await getRuleConfig(rows[0].report.ruleSetId);
  return { ...rows[0], attachments: files, logs, rule };
}

export type ReportBundle = NonNullable<Awaited<ReturnType<typeof getReportBundle>>>;

export async function nextReportNumber() {
  const year = new Date().getFullYear();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testReports)
    .where(sql`${testReports.reportNumber} like ${`RRSL/NAWI/${year}/%`}`);
  return `RRSL/NAWI/${year}/${String(Number(count) + 1).padStart(4, "0")}`;
}

export async function logAudit(reportId: number | null, userId: number, action: string, details?: string) {
  await db.insert(auditLogs).values({ reportId, userId, action, details });
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};
