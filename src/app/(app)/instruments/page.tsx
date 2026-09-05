import Link from "next/link";
import { db } from "@/db";
import { instruments, testReports } from "@/db/schema";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { Card, Empty, PageHeader, btnPrimary, inputCls, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InstrumentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const where = q ? or(ilike(instruments.manufacturer, `%${q}%`), ilike(instruments.model, `%${q}%`), ilike(instruments.serialNumber, `%${q}%`), ilike(instruments.instrumentType, `%${q}%`)) : undefined;
  const rows = await db
    .select({ i: instruments, reports: sql<number>`count(${testReports.id})::int` })
    .from(instruments)
    .leftJoin(testReports, eq(testReports.instrumentId, instruments.id))
    .where(where)
    .groupBy(instruments.id)
    .orderBy(desc(instruments.createdAt));

  return (
    <>
      <PageHeader title="Instruments" subtitle="Registry of instruments under type evaluation with instrument-wise test history." actions={user.role !== "reviewer" && <Link href="/instruments/new" className={btnPrimary}>＋ Register instrument</Link>} />
      <Card>
        <form className="mb-4 flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search manufacturer, model, serial no., type…" className={inputCls} />
          <button className="rounded-md bg-slate-800 px-4 text-sm font-medium text-white">Search</button>
        </form>
        {rows.length === 0 ? <Empty text="No instruments found." /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2">Manufacturer / Model</th><th className="pb-2">Serial No.</th><th className="pb-2">Type</th><th className="pb-2">Class</th><th className="pb-2">Max / e</th><th className="pb-2">n</th><th className="pb-2">Reports</th><th className="pb-2">Registered</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ i, reports }) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="py-2"><Link href={`/instruments/${i.id}`} className="font-medium text-teal-700 hover:underline">{i.manufacturer} – {i.model}</Link></td>
                  <td className="py-2 font-mono text-xs">{i.serialNumber}</td>
                  <td className="py-2">{i.instrumentType}</td>
                  <td className="py-2 font-semibold">{i.accuracyClass}</td>
                  <td className="py-2">{i.maxCapacity} {i.unit} / {i.verificationInterval} {i.unit}</td>
                  <td className="py-2">{Math.round(i.maxCapacity / i.verificationInterval).toLocaleString()}</td>
                  <td className="py-2">{reports}</td>
                  <td className="py-2 text-slate-500">{fmtDate(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
