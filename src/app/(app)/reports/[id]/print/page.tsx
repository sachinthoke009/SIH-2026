import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getReportBundle, specFromInstrument } from "@/lib/data";
import { checkClassification, type EvaluationOutput } from "@/lib/r76/engine";
import { fmtDate, fmtDateTime } from "@/components/ui";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const b = await getReportBundle(Number(id));
  if (!b) notFound();
  const { report: r, instrument: i } = b;
  const res = r.results as EvaluationOutput;
  const cls = checkClassification(specFromInstrument(i), b.rule.config);
  const sig = r.signature as { signedBy: string; signedAt: string; hash: string } | null;
  const images = b.attachments.filter((a) => a.mimeType.startsWith("image/"));

  const kv = (rows: [string, string | number | null | undefined][]) => (
    <table className="w-full border-collapse text-[12px]">
      <tbody>{rows.map(([k, v]) => <tr key={k} className="border-b border-slate-200"><td className="w-1/3 bg-slate-50 px-2 py-1 font-medium text-slate-600">{k}</td><td className="px-2 py-1">{v ?? "—"}</td></tr>)}</tbody>
    </table>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex justify-end gap-2"><PrintButton /></div>
      <article className="print-page rounded-lg border border-slate-200 bg-white p-10 text-slate-900 shadow">
        <header className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">Government of India · Ministry of Consumer Affairs, Food & Public Distribution</div>
            <h1 className="mt-1 text-xl font-bold">{r.labName}</h1>
            <div className="text-xs text-slate-600">{r.labAddress}</div>
            <div className="text-xs text-slate-600">{r.labAccreditation}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">TEST REPORT</div>
            <div className="text-xs text-slate-600">Non-Automatic Weighing Instrument</div>
            <div className="text-xs text-slate-600">as per {b.rule.label}</div>
            <div className="mt-2 font-mono text-sm font-semibold">{r.reportNumber}</div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-6">
          <div>
            <h2 className="mb-1 text-sm font-bold uppercase text-slate-700">1. Application</h2>
            {kv([["Purpose", r.purpose], ["Application ref.", r.applicationRef], ["Applicant", i.applicant], ["Applicant address", i.applicantAddress], ["Test period", `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`], ["Test location", r.testLocation]])}
          </div>
          <div>
            <h2 className="mb-1 text-sm font-bold uppercase text-slate-700">2. Environmental conditions</h2>
            {kv([["Temperature", r.temperature != null ? `${r.temperature} °C` : null], ["Relative humidity", r.humidity != null ? `${r.humidity} %` : null], ["Atmospheric pressure", r.pressure != null ? `${r.pressure} hPa` : null], ["Reference standards", r.referenceStandards], ["Rule set applied", b.rule.label]])}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-1 text-sm font-bold uppercase text-slate-700">3. Instrument under test</h2>
          <div className="grid grid-cols-2 gap-6">
            {kv([["Manufacturer", i.manufacturer], ["Manufacturer address", i.manufacturerAddress], ["Model / type", i.model], ["Serial number", i.serialNumber], ["Instrument type", i.instrumentType], ["Indication", i.indicationType], ["Software version", i.softwareVersion]])}
            {kv([["Accuracy class", i.accuracyClass], ["Max", `${i.maxCapacity} ${i.unit}`], ["Min", `${i.minCapacity} ${i.unit}`], ["Verification scale interval e", `${i.verificationInterval} ${i.unit}`], ["Actual scale interval d", `${i.actualInterval} ${i.unit}`], ["n = Max / e", cls.n.toLocaleString()], ["Load cell / indicator", [i.loadCell, i.indicator].filter(Boolean).join(" / ")], ["Temperature range", `${i.tempRangeMin} °C to ${i.tempRangeMax} °C`]])}
          </div>
          <p className={`mt-2 text-[11px] ${cls.ok ? "text-emerald-700" : "text-rose-700"}`}>{cls.ok ? "Instrument classification conforms to R 76-1 Table 3." : cls.issues.join(" ")}</p>
        </section>

        <section className="mt-5">
          <h2 className="mb-1 text-sm font-bold uppercase text-slate-700">4. Summary of results</h2>
          <table className="w-full border-collapse text-[12px]">
            <thead><tr className="bg-slate-800 text-white"><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Test</th><th className="px-2 py-1 text-left">Clause</th><th className="px-2 py-1 text-left">Result</th></tr></thead>
            <tbody>{res.tests?.map((t, idx) => <tr key={t.testId} className="border-b border-slate-200"><td className="px-2 py-1">{idx + 1}</td><td className="px-2 py-1">{t.title}</td><td className="px-2 py-1 text-slate-500">{t.clause}</td><td className={`px-2 py-1 font-bold ${t.verdict === "PASS" ? "text-emerald-700" : t.verdict === "FAIL" ? "text-rose-700" : "text-slate-500"}`}>{t.verdict.replace("_", " ")}</td></tr>)}</tbody>
          </table>
          <div className={`mt-3 rounded-md border-2 p-3 text-center text-lg font-bold ${r.overallVerdict === "PASS" ? "border-emerald-600 text-emerald-700" : r.overallVerdict === "FAIL" ? "border-rose-600 text-rose-700" : "border-amber-500 text-amber-700"}`}>
            OVERALL: {r.overallVerdict === "PASS" ? "COMPLIES with OIML R 76-1" : r.overallVerdict === "FAIL" ? "DOES NOT COMPLY with OIML R 76-1" : "EVALUATION INCOMPLETE"}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-1 text-sm font-bold uppercase text-slate-700">5. Detailed test results</h2>
          {res.tests?.filter((t) => t.verdict !== "NOT_TESTED").map((t, idx) => (
            <div key={t.testId} className="mt-4">
              <h3 className="text-[13px] font-semibold">5.{idx + 1} {t.title} <span className="font-normal text-slate-500">({t.clause})</span> — <span className={t.verdict === "PASS" ? "text-emerald-700" : t.verdict === "FAIL" ? "text-rose-700" : "text-amber-700"}>{t.verdict}</span></h3>
              <table className="mt-1 w-full border-collapse text-[11px]">
                <thead><tr className="bg-slate-100">{t.headers.map((h) => <th key={h} className="border border-slate-300 px-1.5 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody>{t.rows.map((row, ri) => <tr key={ri}>{row.cells.map((c, ci) => <td key={ci} className={`border border-slate-300 px-1.5 py-0.5 ${ci === row.cells.length - 1 ? (row.pass === false ? "font-bold text-rose-700" : row.pass ? "font-semibold text-emerald-700" : "") : ""}`}>{c}</td>)}</tr>)}</tbody>
              </table>
              <p className="mt-1 text-[11px] text-slate-600">{t.summary}</p>
              {t.warnings.length > 0 && <p className="text-[11px] text-amber-700">Notes: {t.warnings.join(" ")}</p>}
            </div>
          ))}
        </section>

        {r.remarks && <section className="mt-5"><h2 className="mb-1 text-sm font-bold uppercase text-slate-700">6. Remarks</h2><p className="text-[12px]">{r.remarks}</p></section>}

        {images.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-1 text-sm font-bold uppercase text-slate-700">7. Photographs</h2>
            <div className="grid grid-cols-3 gap-3">
              {images.map((a) => (
                <figure key={a.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/attachments/${a.id}`} alt={a.caption ?? a.fileName} className="h-36 w-full rounded border object-cover" />
                  <figcaption className="mt-1 text-[10px] text-slate-600">{a.caption || a.fileName}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 grid grid-cols-2 gap-10 text-[12px]">
          <div><div className="h-12 border-b border-slate-400" /><div className="mt-1 font-medium">Tested by: {b.tester?.name ?? "—"}</div><div className="text-slate-500">{b.tester?.designation}</div></div>
          <div>
            <div className="h-12 border-b border-slate-400" />
            <div className="mt-1 font-medium">Approved by: {b.reviewer?.name ?? "—"}</div>
            <div className="text-slate-500">{b.reviewer?.designation}</div>
            {sig && <div className="mt-1 break-all font-mono text-[9px] text-emerald-700">Digitally signed {fmtDateTime(sig.signedAt)} · SHA-256 {sig.hash}</div>}
          </div>
        </section>
        <footer className="mt-8 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
          Generated by SmartNAWI on {fmtDateTime(new Date())} · Report {r.reportNumber} · This report relates only to the instrument tested. Reproduction in part is not permitted without written approval of the laboratory.
        </footer>
      </article>
    </div>
  );
}
