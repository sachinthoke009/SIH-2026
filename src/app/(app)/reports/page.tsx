import Link from "next/link";
import { db } from "@/db";
import { instruments, testReports, users } from "@/db/schema";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { Card, Empty, PageHeader, StatusBadge, VerdictBadge, btnPrimary, inputCls, fmtDate } from "@/components/ui";
import { ACCURACY_CLASSES } from "@/lib/r76/rules";
import { STATUS_LABEL } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; verdict?: string; cls?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const conds: SQL[] = [];
  if (sp.q) conds.push(or(ilike(testReports.reportNumber, `%${sp.q}%`), ilike(instruments.manufacturer, `%${sp.q}%`), ilike(instruments.model, `%${sp.q}%`), ilike(instruments.serialNumber, `%${sp.q}%`), ilike(testReports.applicationRef, `%${sp.q}%`))!);
  if (sp.status) conds.push(sp.status === "in_progress" ? or(eq(testReports.status, "in_progress"), eq(testReports.status, "draft"))! : eq(testReports.status, sp.status));
  if (sp.verdict) conds.push(eq(testReports.overallVerdict, sp.verdict));
  if (sp.cls) conds.push(eq(instruments.accuracyClass, sp.cls));

  const rows = await db
    .select({ r: testReports, i: instruments, testerName: users.name })
    .from(testReports)
    .innerJoin(instruments, eq(testReports.instrumentId, instruments.id))
    .leftJoin(users, eq(testReports.testedById, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(testReports.updatedAt));

  return (
    <>
      <PageHeader title="Test report repository" subtitle="Search and retrieve completed, in-process and historical OIML R 76 test reports." actions={user.role !== "reviewer" && <Link href="/reports/new" className={btnPrimary}>＋ New Test Report</Link>} />
      <Card>
        <form className="mb-4 grid gap-2 md:grid-cols-[1fr_160px_160px_160px_auto]">
          <input name="q" defaultValue={sp.q} placeholder="Report no., manufacturer, model, serial, application ref…" className={inputCls} />
          <select name="status" defaultValue={sp.status ?? ""} className={inputCls}><option value="">All statuses</option>{Object.entries(STATUS_LABEL).filter(([k]) => k !== "draft").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select name="verdict" defaultValue={sp.verdict ?? ""} className={inputCls}><option value="">All verdicts</option>{["PASS", "FAIL", "INCOMPLETE"].map((v) => <option key={v}>{v}</option>)}</select>
          <select name="cls" defaultValue={sp.cls ?? ""} className={inputCls}><option value="">All classes</option>{ACCURACY_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <button className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white">Filter</button>
        </form>
        {rows.length === 0 ? <Empty text="No reports match the criteria." /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2">Report No.</th><th className="pb-2">Instrument</th><th className="pb-2">Serial</th><th className="pb-2">Class</th><th className="pb-2">Tested by</th><th className="pb-2">Period</th><th className="pb-2">Status</th><th className="pb-2">Verdict</th><th className="pb-2"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ r, i, testerName }) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-2"><Link href={`/reports/${r.id}`} className="font-mono text-teal-700 hover:underline">{r.reportNumber}</Link></td>
                  <td className="py-2">{i.manufacturer} – {i.model}<div className="text-xs text-slate-400">{i.instrumentType}</div></td>
                  <td className="py-2 font-mono text-xs">{i.serialNumber}</td>
                  <td className="py-2 font-semibold">{i.accuracyClass}</td>
                  <td className="py-2">{testerName ?? "—"}</td>
                  <td className="py-2 text-slate-500">{fmtDate(r.startDate)}{r.endDate ? ` – ${fmtDate(r.endDate)}` : ""}</td>
                  <td className="py-2"><StatusBadge status={r.status} /></td>
                  <td className="py-2"><VerdictBadge verdict={r.overallVerdict} /></td>
                  <td className="py-2 text-right text-xs"><a href={`/api/reports/${r.id}/pdf`} className="text-teal-700 hover:underline">PDF</a> · <a href={`/api/reports/${r.id}/docx`} className="text-teal-700 hover:underline">DOCX</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
