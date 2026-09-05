import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { instruments, testReports } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getRuleConfig, specFromInstrument } from "@/lib/data";
import { checkClassification } from "@/lib/r76/engine";
import { Card, Empty, PageHeader, StatusBadge, VerdictBadge, btnPrimary, btnSecondary, fmtDate } from "@/components/ui";
import { InstrumentForm } from "@/components/InstrumentForm";

export const dynamic = "force-dynamic";

export default async function InstrumentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { edit } = await searchParams;
  const [inst] = await db.select().from(instruments).where(eq(instruments.id, Number(id))).limit(1);
  if (!inst) notFound();
  const rule = await getRuleConfig();
  const check = checkClassification(specFromInstrument(inst), rule.config);
  const history = await db.select().from(testReports).where(eq(testReports.instrumentId, inst.id)).orderBy(desc(testReports.createdAt));

  if (edit && user.role !== "reviewer") {
    return (
      <>
        <PageHeader title={`Edit – ${inst.manufacturer} ${inst.model}`} />
        <InstrumentForm rules={rule.config} instrument={inst} />
      </>
    );
  }

  const rows: [string, string | number | null | undefined][] = [
    ["Manufacturer", inst.manufacturer], ["Manufacturer address", inst.manufacturerAddress], ["Applicant", inst.applicant], ["Applicant address", inst.applicantAddress],
    ["Model", inst.model], ["Serial number", inst.serialNumber], ["Type", inst.instrumentType], ["Indication", inst.indicationType],
    ["Accuracy class", inst.accuracyClass], ["Max", `${inst.maxCapacity} ${inst.unit}`], ["Min", `${inst.minCapacity} ${inst.unit}`], ["e", `${inst.verificationInterval} ${inst.unit}`], ["d", `${inst.actualInterval} ${inst.unit}`], ["n = Max/e", check.n.toLocaleString()],
    ["Load cell(s)", inst.loadCell], ["Indicator", inst.indicator], ["Software", inst.softwareVersion], ["Power supply", inst.powerSupply], ["Temperature range", `${inst.tempRangeMin} °C to ${inst.tempRangeMax} °C`], ["Description", inst.description],
  ];

  return (
    <>
      <PageHeader
        title={`${inst.manufacturer} – ${inst.model}`}
        subtitle={`S/N ${inst.serialNumber} · ${inst.instrumentType} · Class ${inst.accuracyClass}`}
        actions={user.role !== "reviewer" && <><Link href={`/instruments/${inst.id}?edit=1`} className={btnSecondary}>Edit</Link><Link href={`/reports/new?instrumentId=${inst.id}`} className={btnPrimary}>＋ New test report</Link></>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Specifications" className="xl:col-span-2">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-50 py-1"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-800">{v ?? "—"}</dd></div>
            ))}
          </dl>
        </Card>
        <div className="space-y-6">
          <Card title="R 76 classification">
            <div className={`rounded-lg p-3 text-sm ${check.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              <div className="font-semibold">{check.ok ? "✔ Conforms to Table 3" : "✖ Classification issues"}</div>
              <ul className="mt-1 space-y-1 text-xs">{check.issues.map((i) => <li key={i}>• {i}</li>)}{check.notes.map((i) => <li key={i} className="opacity-80">• {i}</li>)}</ul>
            </div>
          </Card>
          <Card title="Test history">
            {history.length === 0 ? <Empty text="No reports yet." /> : (
              <ul className="space-y-2 text-sm">
                {history.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2">
                    <div><Link href={`/reports/${r.id}`} className="font-mono text-teal-700 hover:underline">{r.reportNumber}</Link><div className="text-xs text-slate-500">{fmtDate(r.startDate)}</div></div>
                    <div className="flex gap-1"><StatusBadge status={r.status} /><VerdictBadge verdict={r.overallVerdict} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
