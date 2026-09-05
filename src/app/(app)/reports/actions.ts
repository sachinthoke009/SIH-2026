"use server";

import { db } from "@/db";
import { attachments, instruments, testReports } from "@/db/schema";
import { requireRole, requireUser, can } from "@/lib/auth";
import { getRuleConfig, logAudit, nextReportNumber, specFromInstrument } from "@/lib/data";
import { evaluate, type TestData } from "@/lib/r76/engine";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "crypto";

const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const n = (fd: FormData, k: string) => {
  const v = s(fd, k);
  if (v === null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const dt = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v ? new Date(v) : null;
};

export async function createReportAction(_prev: { error?: string } | undefined, fd: FormData) {
  const user = await requireRole("admin", "tester");
  const instrumentId = n(fd, "instrumentId");
  if (!instrumentId) return { error: "Please select an instrument." };
  const [inst] = await db.select().from(instruments).where(eq(instruments.id, instrumentId)).limit(1);
  if (!inst) return { error: "Instrument not found." };
  const rule = await getRuleConfig();
  const reportNumber = s(fd, "reportNumber") ?? (await nextReportNumber());
  const [r] = await db
    .insert(testReports)
    .values({
      reportNumber,
      instrumentId,
      ruleSetId: rule.id,
      status: "draft",
      purpose: s(fd, "purpose") ?? "Model Approval (Type Evaluation)",
      applicationRef: s(fd, "applicationRef"),
      labName: s(fd, "labName") ?? "Regional Reference Standards Laboratory (RRSL)",
      labAddress: s(fd, "labAddress"),
      labAccreditation: s(fd, "labAccreditation"),
      testLocation: s(fd, "testLocation"),
      temperature: n(fd, "temperature"),
      humidity: n(fd, "humidity"),
      pressure: n(fd, "pressure"),
      referenceStandards: s(fd, "referenceStandards"),
      startDate: dt(fd, "startDate") ?? new Date(),
      endDate: dt(fd, "endDate"),
      testedById: user.id,
      testData: {},
      results: evaluate({}, specFromInstrument(inst), rule.config),
      overallVerdict: "INCOMPLETE",
      createdBy: user.id,
    })
    .returning({ id: testReports.id });
  await logAudit(r.id, user.id, "created", `Report ${reportNumber} created for ${inst.manufacturer} ${inst.model}`);
  revalidatePath("/reports");
  redirect(`/reports/${r.id}?tab=tests`);
}

export async function updateReportMetaAction(_prev: { error?: string; ok?: boolean } | undefined, fd: FormData) {
  const user = await requireRole("admin", "tester");
  const id = n(fd, "id")!;
  await db
    .update(testReports)
    .set({
      purpose: s(fd, "purpose") ?? "Model Approval (Type Evaluation)",
      applicationRef: s(fd, "applicationRef"),
      labName: s(fd, "labName") ?? "",
      labAddress: s(fd, "labAddress"),
      labAccreditation: s(fd, "labAccreditation"),
      testLocation: s(fd, "testLocation"),
      temperature: n(fd, "temperature"),
      humidity: n(fd, "humidity"),
      pressure: n(fd, "pressure"),
      referenceStandards: s(fd, "referenceStandards"),
      startDate: dt(fd, "startDate"),
      endDate: dt(fd, "endDate"),
      remarks: s(fd, "remarks"),
      updatedAt: new Date(),
    })
    .where(eq(testReports.id, id));
  await logAudit(id, user.id, "details_updated", "Laboratory / environmental details updated");
  revalidatePath(`/reports/${id}`);
  return { ok: true };
}

export async function saveObservationsAction(reportId: number, data: TestData) {
  const user = await requireUser();
  if (!can.editReport(user)) return { error: "Not permitted." };
  const [row] = await db.select({ r: testReports, i: instruments }).from(testReports).innerJoin(instruments, eq(testReports.instrumentId, instruments.id)).where(eq(testReports.id, reportId)).limit(1);
  if (!row) return { error: "Report not found." };
  if (row.r.status === "approved") return { error: "Approved reports are locked." };
  const rule = await getRuleConfig(row.r.ruleSetId);
  const results = evaluate(data, specFromInstrument(row.i), rule.config);
  const status = row.r.status === "draft" ? "in_progress" : row.r.status === "rejected" ? "in_progress" : row.r.status;
  await db.update(testReports).set({ testData: data, results, overallVerdict: results.overall, status, updatedAt: new Date() }).where(eq(testReports.id, reportId));
  await logAudit(reportId, user.id, "observations_saved", `Observations evaluated – overall ${results.overall} (${results.summary.passed} pass / ${results.summary.failed} fail / ${results.summary.incomplete} incomplete)`);
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { ok: true, results };
}

export async function workflowAction(fd: FormData) {
  const user = await requireUser();
  const id = n(fd, "id")!;
  const action = s(fd, "action");
  const note = s(fd, "note");
  const [r] = await db.select().from(testReports).where(eq(testReports.id, id)).limit(1);
  if (!r) return;

  if (action === "submit" && can.editReport(user)) {
    await db.update(testReports).set({ status: "under_review", updatedAt: new Date() }).where(eq(testReports.id, id));
    await logAudit(id, user.id, "submitted", "Submitted for technical review");
  } else if (action === "approve" && can.review(user)) {
    const payload = JSON.stringify({ id: r.id, reportNumber: r.reportNumber, testData: r.testData, results: r.results, verdict: r.overallVerdict, signer: user.email, at: new Date().toISOString() });
    const hash = createHash("sha256").update(payload).digest("hex");
    await db
      .update(testReports)
      .set({ status: "approved", reviewedById: user.id, signature: { signedBy: user.name, signerEmail: user.email, signedAt: new Date().toISOString(), hash, algorithm: "SHA-256 over report payload" }, updatedAt: new Date() })
      .where(eq(testReports.id, id));
    await logAudit(id, user.id, "approved", `Report approved and digitally signed (SHA-256 ${hash.slice(0, 12)}…)`);
  } else if (action === "reject" && can.review(user)) {
    await db.update(testReports).set({ status: "rejected", reviewedById: user.id, updatedAt: new Date() }).where(eq(testReports.id, id));
    await logAudit(id, user.id, "rejected", note ? `Returned to tester: ${note}` : "Returned to tester for correction");
  } else if (action === "reopen" && can.admin(user)) {
    await db.update(testReports).set({ status: "in_progress", signature: null, updatedAt: new Date() }).where(eq(testReports.id, id));
    await logAudit(id, user.id, "reopened", "Report re-opened by administrator");
  } else if (action === "delete" && can.admin(user)) {
    await db.delete(testReports).where(eq(testReports.id, id));
    revalidatePath("/reports");
    redirect("/reports");
  }
  revalidatePath(`/reports/${id}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export async function uploadAttachmentAction(fd: FormData) {
  const user = await requireRole("admin", "tester");
  const id = n(fd, "id")!;
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 3 * 1024 * 1024) return;
  const buf = Buffer.from(await file.arrayBuffer());
  await db.insert(attachments).values({
    reportId: id,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    caption: s(fd, "caption"),
    size: file.size,
    dataBase64: buf.toString("base64"),
    uploadedBy: user.id,
  });
  await logAudit(id, user.id, "attachment_added", file.name);
  revalidatePath(`/reports/${id}`);
}

export async function deleteAttachmentAction(fd: FormData) {
  const user = await requireRole("admin", "tester");
  const attId = n(fd, "attachmentId")!;
  const id = n(fd, "id")!;
  await db.delete(attachments).where(eq(attachments.id, attId));
  await logAudit(id, user.id, "attachment_removed", `Attachment #${attId} removed`);
  revalidatePath(`/reports/${id}`);
}
