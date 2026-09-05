import { db } from "@/db";
import { ruleSets } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader, fmtDate } from "@/components/ui";
import { activateRuleSetAction } from "../actions";
import { RuleSetForm } from "./RuleSetForm";
import type { R76RuleConfig } from "@/lib/r76/rules";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const user = await requireUser();
  const list = await db.select().from(ruleSets).orderBy(desc(ruleSets.active), desc(ruleSets.createdAt));
  const active = list.find((r) => r.active) ?? list[0];
  const cfg = active?.config as R76RuleConfig | undefined;

  return (
    <>
      <PageHeader title="OIML R 76 rule sets" subtitle="The calculation engine is data-driven. When the Recommendation is revised, publish a new rule set version – existing reports keep the version they were evaluated against." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Versions">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2">Code</th><th className="pb-2">Version</th><th className="pb-2">Title</th><th className="pb-2">Published</th><th className="pb-2">Status</th><th></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-mono text-xs">{r.code}</td>
                    <td className="py-2 font-medium">{r.version}</td>
                    <td className="py-2 text-xs text-slate-600">{r.title}</td>
                    <td className="py-2 text-xs text-slate-500">{fmtDate(r.createdAt)}</td>
                    <td className="py-2">{r.active ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Active</span> : <span className="text-xs text-slate-400">Archived</span>}</td>
                    <td className="py-2 text-right">{!r.active && user.role === "admin" && <form action={activateRuleSetAction}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-teal-700 hover:underline">Activate</button></form>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {cfg && (
            <Card title={`Active rules – ${active.code} ${active.version}`}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Table 3 – Accuracy classes</h4>
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th>Class</th><th>e</th><th>n min</th><th>n max</th><th>Min</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {(Object.keys(cfg.classes) as (keyof typeof cfg.classes)[]).flatMap((c) => cfg.classes[c].map((b, i) => (
                        <tr key={`${c}-${i}`}><td className="py-1 font-semibold">{c}</td><td className="py-1">{b.eMinG} g ≤ e{b.eMaxG !== null ? ` ≤ ${b.eMaxG} g` : ""}</td><td className="py-1">{b.nMin.toLocaleString()}</td><td className="py-1">{b.nMax?.toLocaleString() ?? "—"}</td><td className="py-1">{b.minCapMultiple} e</td></tr>
                      )))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Table 6 – MPE on initial verification</h4>
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th>MPE</th><th>Class I</th><th>Class II</th><th>Class III</th><th>Class IIII</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {cfg.mpeBands.map((b, i) => {
                        const prev = i === 0 ? null : cfg.mpeBands[i - 1];
                        const cellFor = (c: "I" | "II" | "III" | "IIII") => { const lo = prev?.upTo[c]; const hi = b.upTo[c]; if (hi === null && lo === null) return "—"; return `${lo ?? 0} < m${hi !== null ? ` ≤ ${hi.toLocaleString()}` : ""}`; };
                        return <tr key={b.mult}><td className="py-1 font-semibold">±{b.mult} e</td><td className="py-1">{cellFor("I")}</td><td className="py-1">{cellFor("II")}</td><td className="py-1">{cellFor("III")}</td><td className="py-1">{cellFor("IIII")}</td></tr>;
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-slate-500">In-service MPE factor: {cfg.inServiceFactor}×</p>
                </div>
              </div>
              <h4 className="mb-2 mt-6 text-xs font-semibold uppercase text-slate-500">Test criteria</h4>
              <ul className="grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
                <li>• Weighing: ≥ {cfg.weighing.minLoads} loads incl. Min & Max — {cfg.weighing.clause}</li>
                <li>• Repeatability: {cfg.repeatability.seriesRequired} series; {cfg.repeatability.weighingsIfMaxLe100kg}/{cfg.repeatability.weighingsIfMaxGt100kg} weighings (Max ≤/&gt; 100 kg) — {cfg.repeatability.clause}</li>
                <li>• Eccentricity: load ≈ Max × {cfg.eccentricity.loadFraction.toFixed(3)}, ≥ {cfg.eccentricity.minPositions} positions — {cfg.eccentricity.clause}</li>
                <li>• Discrimination: +{cfg.discrimination.extraLoadInD} d → change ≥ {cfg.discrimination.requiredChangeInD} d — {cfg.discrimination.clause}</li>
                <li>• Zero-setting: initial ≤ {cfg.zeroSetting.initialRangePct} % Max, semi-auto ≤ {cfg.zeroSetting.semiAutoRangePct} % Max, accuracy ±{cfg.zeroSetting.accuracyE} e — {cfg.zeroSetting.clause}</li>
                <li>• Warm-up checkpoints: {cfg.warmup.checkpointsMin.join(", ")} min — {cfg.warmup.clause}</li>
                <li>• Voltage: {cfg.voltage.lowPct} % / +{cfg.voltage.highPct} % — {cfg.voltage.clause}</li>
                <li>• Span stability: ≤ {cfg.spanStability.mpeFraction} |MPE| over ≥ {cfg.spanStability.minMeasurements} measurements — {cfg.spanStability.clause}</li>
              </ul>
            </Card>
          )}
        </div>
        <div>
          {user.role === "admin" ? (
            <Card title="Publish new version"><RuleSetForm initial={JSON.stringify(cfg ?? {}, null, 2)} /></Card>
          ) : (
            <Card title="Publishing"><p className="text-sm text-slate-600">Only administrators can publish or activate rule set versions.</p></Card>
          )}
        </div>
      </div>
    </>
  );
}
