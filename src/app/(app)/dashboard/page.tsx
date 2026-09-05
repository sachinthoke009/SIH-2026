import Link from "next/link";
import { db } from "@/db";
import { auditLogs, instruments, testReports, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { Card, Empty, PageHeader, Stat, StatusBadge, VerdictBadge, fmtDate, fmtDateTime, btnPrimary } from "@/components/ui";
import { TEST_CATALOG, type EvaluationOutput } from "@/lib/r76/engine";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const statusCounts = await db.select({ status: testReports.status, count: sql<number>`count(*)::int` }).from(testReports).groupBy(testReports.status);
  const verdictCounts = await db.select({ verdict: testReports.overallVerdict, count: sql<number>`count(*)::int` }).from(testReports).groupBy(testReports.overallVerdict);
  const [{ instrumentCount }] = await db.select({ instrumentCount: sql<number>`count(*)::int` }).from(instruments);
  const recent = await db
    .select({ r: testReports, i: instruments })
    .from(testReports)
    .innerJoin(instruments, eq(testReports.instrumentId, instruments.id))
    .orderBy(desc(testReports.updatedAt))
    .limit(6);
  const activity = await db
    .select({ a: auditLogs, userName: users.name, reportNumber: testReports.reportNumber })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .leftJoin(testReports, eq(auditLogs.reportId, testReports.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(8);
  const allResults = await db.select({ results: testReports.results }).from(testReports);

  const sc = (s: string) => statusCounts.find((x) => x.status === s)?.count ?? 0;
  const vc = (v: string) => verdictCounts.find((x) => x.verdict === v)?.count ?? 0;
  const total = statusCounts.reduce((a, b) => a + b.count, 0);

  // per-test pass/fail aggregation
  const perTest = TEST_CATALOG.map((t) => {
    let pass = 0, fail = 0, inc = 0;
    for (const r of allResults) {
      const res = r.results as Partial<EvaluationOutput>;
      const tr = res.tests?.find((x) => x.testId === t.id);
      if (!tr || tr.verdict === "NOT_TESTED") continue;
      if (tr.verdict === "PASS") pass++;
      else if (tr.verdict === "FAIL") fail++;
      else inc++;
    }
    return { ...t, pass, fail, inc, total: pass + fail + inc };
  });
  const flagged = allResults.filter((r) => ((r.results as Partial<EvaluationOutput>).integrityFlags?.length ?? 0) > 0).length;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle="Monitoring of NAWI type-evaluation activity, report status and R 76 compliance outcomes."
        actions={(user.role === "admin" || user.role === "tester") && <Link href="/reports/new" className={btnPrimary}>＋ New Test Report</Link>}
      />
      {denied && <div className="mb-4 rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">You do not have permission to access that page.</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total reports" value={total} tone="slate" href="/reports" />
        <Stat label="In progress" value={sc("draft") + sc("in_progress")} tone="sky" href="/reports?status=in_progress" />
        <Stat label="Under review" value={sc("under_review")} tone="violet" href="/reports?status=under_review" />
        <Stat label="Approved" value={sc("approved")} tone="emerald" href="/reports?status=approved" />
        <Stat label="Non-compliant" value={vc("FAIL")} tone="rose" href="/reports?verdict=FAIL" />
        <Stat label="Instruments" value={instrumentCount} tone="teal" href="/instruments" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Recent test reports" className="xl:col-span-2" action={<Link href="/reports" className="text-xs font-medium text-teal-700 hover:underline">View repository →</Link>}>
          {recent.length === 0 ? (
            <Empty text="No reports yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="pb-2">Report No.</th><th className="pb-2">Instrument</th><th className="pb-2">Class</th><th className="pb-2">Status</th><th className="pb-2">Verdict</th><th className="pb-2">Updated</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map(({ r, i }) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2"><Link href={`/reports/${r.id}`} className="font-mono text-teal-700 hover:underline">{r.reportNumber}</Link></td>
                    <td className="py-2">{i.manufacturer} <span className="text-slate-400">·</span> {i.model}</td>
                    <td className="py-2">{i.accuracyClass}</td>
                    <td className="py-2"><StatusBadge status={r.status} /></td>
                    <td className="py-2"><VerdictBadge verdict={r.overallVerdict} /></td>
                    <td className="py-2 text-slate-500">{fmtDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Compliance outcome">
          <div className="space-y-3">
            {[
              ["PASS", vc("PASS"), "bg-emerald-500"],
              ["FAIL", vc("FAIL"), "bg-rose-500"],
              ["INCOMPLETE", vc("INCOMPLETE"), "bg-amber-400"],
            ].map(([k, v, c]) => (
              <div key={k as string}>
                <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{k}</span><span>{v}</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${c}`} style={{ width: `${total ? (Number(v) / total) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="font-semibold">👻 Ghost Mode – integrity guard</div>
            {flagged} report(s) carry integrity flags (identical or suspiciously perfect patterns) for reviewer attention.
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Test-wise outcomes (all reports)" className="xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {perTest.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2">
                <div className="w-36 text-xs font-medium text-slate-700">{t.title}</div>
                <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  {t.total > 0 && (
                    <>
                      <div className="bg-emerald-500" style={{ width: `${(t.pass / t.total) * 100}%` }} />
                      <div className="bg-rose-500" style={{ width: `${(t.fail / t.total) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(t.inc / t.total) * 100}%` }} />
                    </>
                  )}
                </div>
                <div className="w-16 text-right text-[11px] text-slate-500">{t.pass}/{t.fail}/{t.inc}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">pass / fail / incomplete</div>
        </Card>
        <Card title="Recent activity (audit trail)">
          <ul className="space-y-3 text-sm">
            {activity.map(({ a, userName, reportNumber }) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                <div>
                  <div className="text-slate-800"><span className="font-medium">{userName ?? "System"}</span> · {a.action.replace(/_/g, " ")}</div>
                  <div className="text-xs text-slate-500">{reportNumber && <Link href={`/reports/${a.reportId}`} className="font-mono text-teal-700">{reportNumber}</Link>} {a.details} · {fmtDateTime(a.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
