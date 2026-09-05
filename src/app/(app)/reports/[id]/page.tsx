import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getReportBundle, specFromInstrument } from "@/lib/data";
import { checkClassification, type EvaluationOutput, type TestData } from "@/lib/r76/engine";
import { Card, Empty, PageHeader, StatusBadge, VerdictBadge, btnDanger, btnPrimary, btnSecondary, fmtDate, fmtDateTime, inputCls } from "@/components/ui";
import { TestWorkspace } from "./TestWorkspace";
import { workflowAction, uploadAttachmentAction, deleteAttachmentAction } from "../actions";
import { ReportDetailsForm } from "./ReportDetailsForm";

export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"],
  ["details", "Lab & Conditions"],
  ["tests", "Test Observations"],
  ["attachments", "Attachments"],
  ["audit", "Audit Trail"],
] as const;

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const b = await getReportBundle(Number(id));
  if (!b) notFound();
  const { report: r, instrument: i } = b;
  const results = r.results as EvaluationOutput;
  const spec = specFromInstrument(i);
  const cls = checkClassification(spec, b.rule.config);
  const locked = r.status === "approved";
  const canEdit = can.editReport(user) && !locked;

  return (
    <>
      <PageHeader
        title={r.reportNumber}
        subtitle={<>{i.manufacturer} – {i.model} · S/N {i.serialNumber} · Class {i.accuracyClass} · Rule set {b.rule.label}</>}
        actions={
          <>
            <StatusBadge status={r.status} />
            <VerdictBadge verdict={r.overallVerdict} size="lg" />
            <Link href={`/reports/${r.id}/print`} className={btnSecondary} target="_blank">🖨 Print view</Link>
            <a href={`/api/reports/${r.id}/pdf`} className={btnSecondary}>⬇ PDF</a>
            <a href={`/api/reports/${r.id}/docx`} className={btnSecondary}>⬇ Word</a>
          </>
        }
      />

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/reports/${r.id}?tab=${k}`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {label}
            {k === "attachments" && b.attachments.length > 0 && <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-xs">{b.attachments.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Test summary">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2">#</th><th className="pb-2">Test</th><th className="pb-2">Clause</th><th className="pb-2">Result</th><th className="pb-2">Observation</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {results.tests?.map((t, idx) => (
                    <tr key={t.testId}>
                      <td className="py-2 text-slate-400">{idx + 1}</td>
                      <td className="py-2 font-medium">{t.title}</td>
                      <td className="py-2 text-xs text-slate-500">{t.clause}</td>
                      <td className="py-2"><VerdictBadge verdict={t.verdict} /></td>
                      <td className="py-2 text-xs text-slate-600">{t.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(results.integrityFlags?.length ?? 0) > 0 && (
                <div className="mt-4 rounded-md border border-violet-200 bg-violet-50 p-3 text-xs text-violet-800">
                  <div className="font-semibold">👻 Ghost Mode – integrity flags for reviewer</div>
                  <ul className="mt-1 list-disc pl-4">{results.integrityFlags.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
            </Card>
            <Card title="Instrument under test">
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {([
                  ["Manufacturer", i.manufacturer], ["Model", i.model], ["Serial No.", i.serialNumber], ["Type", i.instrumentType],
                  ["Accuracy class", i.accuracyClass], ["Max / Min", `${i.maxCapacity} / ${i.minCapacity} ${i.unit}`], ["e / d", `${i.verificationInterval} / ${i.actualInterval} ${i.unit}`], ["n = Max/e", cls.n.toLocaleString()],
                  ["Load cell", i.loadCell], ["Indicator", i.indicator], ["Software", i.softwareVersion], ["Temperature range", `${i.tempRangeMin} °C … ${i.tempRangeMax} °C`],
                ] as [string, string | null | undefined][]).map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-50 py-1"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v ?? "—"}</dd></div>)}
              </dl>
              <div className={`mt-3 rounded-md p-2 text-xs ${cls.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{cls.ok ? "✔ Instrument classification conforms to R 76-1 Table 3." : cls.issues.join(" ")}</div>
              <Link href={`/instruments/${i.id}`} className="mt-2 inline-block text-xs text-teal-700 hover:underline">View instrument & history →</Link>
            </Card>
          </div>
          <div className="space-y-6">
            <Card title="Workflow">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Tested by</span><span className="font-medium">{b.tester?.name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Reviewed by</span><span className="font-medium">{b.reviewer?.name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Period</span><span>{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Updated</span><span>{fmtDateTime(r.updatedAt)}</span></div>
              </div>
              {!!r.signature && (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <div className="font-semibold">🔏 Digitally signed</div>
                  <div>{(r.signature as { signedBy: string }).signedBy} · {fmtDateTime((r.signature as { signedAt: string }).signedAt)}</div>
                  <div className="mt-1 break-all font-mono text-[10px] text-emerald-700">SHA-256 {(r.signature as { hash: string }).hash}</div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {can.editReport(user) && (r.status === "in_progress" || r.status === "rejected" || r.status === "draft") && (
                  <form action={workflowAction}><input type="hidden" name="id" value={r.id} /><button name="action" value="submit" className={btnPrimary} disabled={r.overallVerdict === "INCOMPLETE" && r.status === "draft"}>Submit for review</button></form>
                )}
                {can.review(user) && r.status === "under_review" && (
                  <>
                    <form action={workflowAction}><input type="hidden" name="id" value={r.id} /><button name="action" value="approve" className={btnPrimary}>✔ Approve & sign</button></form>
                    <form action={workflowAction} className="flex w-full gap-2"><input type="hidden" name="id" value={r.id} /><input name="note" placeholder="Reason for return" className={inputCls} /><button name="action" value="reject" className={btnDanger}>Return</button></form>
                  </>
                )}
                {can.admin(user) && r.status === "approved" && (
                  <form action={workflowAction}><input type="hidden" name="id" value={r.id} /><button name="action" value="reopen" className={btnSecondary}>Re-open</button></form>
                )}
                {can.admin(user) && (
                  <form action={workflowAction}><input type="hidden" name="id" value={r.id} /><button name="action" value="delete" className={btnDanger}>Delete</button></form>
                )}
              </div>
              {r.status === "draft" && <p className="mt-2 text-xs text-slate-500">Enter observations under “Test Observations” to move this report to In Progress.</p>}
            </Card>
            <Card title="Remarks">
              <p className="text-sm text-slate-700">{r.remarks || <span className="text-slate-400">No remarks recorded.</span>}</p>
            </Card>
          </div>
        </div>
      )}

      {tab === "details" && <ReportDetailsForm report={r} canEdit={canEdit} />}

      {tab === "tests" && (
        <TestWorkspace reportId={r.id} spec={spec} rules={b.rule.config} initialData={(r.testData ?? {}) as TestData} canEdit={canEdit} tempRange={[i.tempRangeMin ?? -10, i.tempRangeMax ?? 40]} />
      )}

      {tab === "attachments" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Photographs & supporting documents" className="lg:col-span-2">
            {b.attachments.length === 0 ? <Empty text="No attachments yet. Add photographs of the instrument, data plate, test set-up and supporting documents." /> : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {b.attachments.map((a) => (
                  <div key={a.id} className="overflow-hidden rounded-lg border border-slate-200">
                    {a.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/attachments/${a.id}`} alt={a.caption ?? a.fileName} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="grid h-40 place-items-center bg-slate-50 text-4xl">📄</div>
                    )}
                    <div className="p-2 text-xs">
                      <div className="truncate font-medium">{a.caption || a.fileName}</div>
                      <div className="text-slate-400">{a.fileName} · {(a.size / 1024).toFixed(0)} KB</div>
                      <div className="mt-1 flex gap-2"><a href={`/api/attachments/${a.id}`} target="_blank" className="text-teal-700">Open</a>
                        {canEdit && <form action={deleteAttachmentAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="attachmentId" value={a.id} /><button className="text-rose-600">Remove</button></form>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {canEdit && (
            <Card title="Upload">
              <form action={uploadAttachmentAction} className="space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <input type="file" name="file" accept="image/*,.pdf" required className="block w-full text-sm" />
                <input name="caption" placeholder="Caption (e.g. Data plate, Eccentricity set-up)" className={inputCls} />
                <button className={btnPrimary}>Upload</button>
                <p className="text-xs text-slate-400">Images or PDF up to 3 MB. Images are embedded in the generated report.</p>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === "audit" && (
        <Card title="Audit trail – evidence chain">
          <ol className="relative space-y-4 border-l border-slate-200 pl-6">
            {b.logs.map(({ log, userName }) => (
              <li key={log.id}>
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-white" />
                <div className="text-sm"><span className="font-semibold capitalize">{log.action.replace(/_/g, " ")}</span> <span className="text-slate-500">by {userName ?? "system"}</span></div>
                <div className="text-xs text-slate-600">{log.details}</div>
                <div className="text-[11px] text-slate-400">{fmtDateTime(log.createdAt)}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}
