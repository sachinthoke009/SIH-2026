"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { evaluate, mpeFor, TEST_CATALOG, type InstrumentSpec, type TestData, type TestResult } from "@/lib/r76/engine";
import type { R76RuleConfig } from "@/lib/r76/rules";
import { saveObservationsAction } from "../actions";
import { VerdictBadge, btnPrimary, btnSecondary } from "@/components/ui";
import { InstrumentDeviceBar } from "@/components/InstrumentDeviceBar";

type Props = { reportId: number; spec: InstrumentSpec; rules: R76RuleConfig; initialData: TestData; canEdit: boolean; tempRange: [number, number] };

const num = (v: string): number | null => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const cell = "w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-teal-600 focus:outline-none disabled:bg-slate-50";
const th = "px-2 py-1.5 text-left text-[11px] font-semibold uppercase text-slate-500";

function N({
  value,
  onChange,
  disabled,
  placeholder,
  onFocus,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  onFocus?: () => void;
}) {
  return (
    <input
      type="number"
      step="any"
      className={cell}
      disabled={disabled}
      placeholder={placeholder}
      value={value ?? ""}
      onFocus={onFocus}
      onChange={(e) => onChange(num(e.target.value))}
    />
  );
}

function ResultTable({ r }: { r: TestResult }) {
  if (r.verdict === "NOT_TESTED") return <p className="text-sm text-slate-500">Mark the test as applicable and enter observations to see the evaluation.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr>{r.headers.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {r.rows.map((row, i) => (
            <tr key={i} className={row.pass === false ? "bg-rose-50" : ""}>
              {row.cells.map((c, j) => <td key={j} className={`px-2 py-1 ${j === row.cells.length - 1 ? (row.pass === false ? "font-bold text-rose-700" : row.pass ? "font-semibold text-emerald-700" : "text-slate-400") : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TestWorkspace({ reportId, spec, rules, initialData, canEdit, tempRange }: Props) {
  const [data, setData] = useState<TestData>(initialData ?? {});
  const [active, setActive] = useState<keyof TestData>("weighing");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [lastFocusedSetter, setLastFocusedSetter] = useState<((v: number) => void) | null>(null);
  const router = useRouter();
  const u = spec.unit;

  const live = useMemo(() => evaluate(data, spec, rules), [data, spec, rules]);
  const res = live.tests.find((t) => t.testId === active)!;

  const upd = <K extends keyof TestData>(k: K, v: TestData[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };
  const save = () =>
    start(async () => {
      const r = await saveObservationsAction(reportId, data);
      if ("error" in r && r.error) setMsg(r.error);
      else {
        setMsg("Observations saved and evaluated.");
        setDirty(false);
        router.refresh();
      }
    });

  const dis = !canEdit;
  const mpe = (l: number) => mpeFor(l, spec, rules).value;
  const rnd = (v: number) => Number(v.toFixed(6));

  // Smart Auto-Capture Handler for scale readings
  const handleCaptureWeight = (weight: number) => {
    if (dis) return;
    if (lastFocusedSetter) {
      lastFocusedSetter(weight);
      setDirty(true);
      return;
    }

    // Smart fallback: Auto-fill next empty observation slot in active test tab
    if (active === "weighing") {
      const W = data.weighing ?? { applicable: true, method: "simple", zeroError: 0, rows: [] };
      let filled = false;
      const newRows = W.rows.map((r) => {
        if (!filled && r.indUp === null) {
          filled = true;
          return { ...r, indUp: weight };
        }
        if (!filled && r.indDown === null) {
          filled = true;
          return { ...r, indDown: weight };
        }
        return r;
      });
      if (filled) upd("weighing", { ...W, applicable: true, rows: newRows });
    } else if (active === "repeatability") {
      const R = data.repeatability ?? { applicable: true, series: [] };
      let filled = false;
      const newSeries = R.series.map((s) => {
        if (filled) return s;
        const newReadings = s.readings.map((r) => {
          if (!filled && r === null) {
            filled = true;
            return weight;
          }
          return r;
        });
        return { ...s, readings: newReadings };
      });
      if (filled) upd("repeatability", { ...R, applicable: true, series: newSeries });
    } else if (active === "eccentricity") {
      const E = data.eccentricity ?? { applicable: true, load: rnd(spec.max / 3), positions: [] };
      let filled = false;
      const newPositions = E.positions.map((p) => {
        if (!filled && p.indication === null) {
          filled = true;
          return { ...p, indication: weight };
        }
        return p;
      });
      if (filled) upd("eccentricity", { ...E, applicable: true, positions: newPositions });
    } else if (active === "tare") {
      const T = data.tare ?? { applicable: true, tareLoad: 0, rows: [] };
      let filled = false;
      const newRows = T.rows.map((r) => {
        if (!filled && r.indication === null) {
          filled = true;
          return { ...r, indication: weight };
        }
        return r;
      });
      if (filled) upd("tare", { ...T, applicable: true, rows: newRows });
    } else if (active === "discrimination") {
      const D = data.discrimination ?? { applicable: true, rows: [] };
      let filled = false;
      const newRows = D.rows.map((r) => {
        if (!filled && r.indication === null) {
          filled = true;
          return { ...r, indication: weight };
        }
        if (!filled && r.indicationAfter === null) {
          filled = true;
          return { ...r, indicationAfter: weight };
        }
        return r;
      });
      if (filled) upd("discrimination", { ...D, applicable: true, rows: newRows });
    } else if (active === "warmup") {
      const WU = data.warmup ?? { applicable: true, load: spec.max, rows: [] };
      let filled = false;
      const newRows = WU.rows.map((r) => {
        if (!filled && r.indication === null) {
          filled = true;
          return { ...r, indication: weight };
        }
        return r;
      });
      if (filled) upd("warmup", { ...WU, applicable: true, rows: newRows });
    } else if (active === "temperature") {
      const TP = data.temperature ?? { applicable: true, rows: [] };
      let filled = false;
      const newRows = TP.rows.map((r) => {
        if (!filled && r.indication === null) {
          filled = true;
          return { ...r, indication: weight };
        }
        return r;
      });
      if (filled) upd("temperature", { ...TP, applicable: true, rows: newRows });
    }
  };

  // ---------- suggested loads
  const suggestWeighing = () => {
    const loads = new Set<number>([spec.min]);
    for (const b of rules.mpeBands) {
      const lim = b.upTo[spec.accuracyClass];
      if (lim !== null && lim * spec.e < spec.max) loads.add(rnd(lim * spec.e));
    }
    [0.25, 0.5, 0.75, 1].forEach((f) => loads.add(rnd(spec.max * f)));
    const rows = [...loads].sort((a, b) => a - b).map((load) => ({ load, indUp: null, dLUp: null, indDown: null, dLDown: null }));
    upd("weighing", { applicable: true, method: data.weighing?.method ?? "simple", zeroError: 0, rows });
  };

  const W = data.weighing ?? { applicable: false, method: "simple" as const, zeroError: 0, rows: [] };
  const R = data.repeatability ?? { applicable: false, series: [] };
  const E = data.eccentricity ?? { applicable: false, load: rnd(spec.max / 3), positions: [] };
  const T = data.tare ?? { applicable: false, tareLoad: rnd(spec.max * 0.1), rows: [] };
  const D = data.discrimination ?? { applicable: false, rows: [] };
  const Z = data.zeroSetting ?? { applicable: false, initialRange: null, semiAutoRange: null, zeroAccuracy: null };
  const WU = data.warmup ?? { applicable: false, load: spec.max, rows: [] };
  const TP = data.temperature ?? { applicable: false, rows: [] };
  const V = data.voltage ?? { applicable: false, nominal: 230, rows: [] };
  const S = data.spanStability ?? { applicable: false, load: spec.max, rows: [] };
  const DH = data.dampHeat ?? { applicable: false, rows: [] };

  const applicableToggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={checked} disabled={dis} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-teal-700" />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      {/* Top Device Live Sync Toolbar */}
      {canEdit && (
        <InstrumentDeviceBar
          unit={u}
          onCaptureWeight={handleCaptureWeight}
          onAutoFillWeight={handleCaptureWeight}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-1">
          {TEST_CATALOG.map((t) => {
            const v = live.tests.find((x) => x.testId === t.id)?.verdict ?? "NOT_TESTED";
            return (
              <button key={t.id} onClick={() => setActive(t.id)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${active === t.id ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <span>{t.title}</span>
                <VerdictBadge verdict={v} />
              </button>
            );
          })}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <div className="mb-1 font-semibold text-slate-700">Live overall verdict</div>
            <VerdictBadge verdict={live.overall} size="lg" />
            <div className="mt-2">{live.summary.passed} pass · {live.summary.failed} fail · {live.summary.incomplete} incomplete · {live.summary.notTested} not tested</div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3">
            <div>
              <h3 className="font-semibold text-slate-900">{res.title}</h3>
              <div className="text-xs text-slate-500">{res.clause} · Class {spec.accuracyClass} · Max {spec.max} {u} · e = {spec.e} {u} · d = {spec.d} {u}</div>
            </div>
            <div className="flex items-center gap-2">
              <VerdictBadge verdict={res.verdict} size="lg" />
              {canEdit && <button onClick={save} disabled={pending || !dirty} className={btnPrimary}>{pending ? "Saving…" : dirty ? "Save & evaluate" : "Saved"}</button>}
            </div>
          </div>
          {msg && <div className="rounded-md bg-teal-50 px-4 py-2 text-sm text-teal-800">{msg}</div>}
          {!canEdit && <div className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">Read-only: this report is locked or your role does not permit editing observations.</div>}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            {/* ------------------------------------------------ WEIGHING */}
            {active === "weighing" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", W.applicable, (v) => upd("weighing", { ...W, applicable: v }))}
                  <label className="text-sm">Method:&nbsp;
                    <select disabled={dis} value={W.method} onChange={(e) => upd("weighing", { ...W, method: e.target.value as "simple" | "changeover" })} className="rounded border border-slate-300 px-2 py-1 text-sm">
                      <option value="simple">E = I − L (reading)</option>
                      <option value="changeover">Changeover point: E = I + ½d − ΔL − L</option>
                    </select>
                  </label>
                  <label className="text-sm">Error at zero E₀ ({u}):&nbsp;<input type="number" step="any" disabled={dis} className="w-24 rounded border border-slate-300 px-2 py-1 text-sm" value={W.zeroError ?? 0} onChange={(e) => upd("weighing", { ...W, zeroError: Number(e.target.value) || 0 })} /></label>
                  {!dis && <button onClick={suggestWeighing} className={btnSecondary}>Suggest test loads</button>}
                </div>
                <p className="mb-3 text-xs text-slate-500">Apply at least {rules.weighing.minLoads} loads from zero to Max and back, including Min, Max and loads near MPE changeover points ({rules.mpeBands.slice(0, -1).map((b) => `${b.upTo[spec.accuracyClass]} e`).join(", ")}). Corrected error Ec = E − E₀.</p>
                <table className="w-full">
                  <thead><tr><th className={th}>Load ({u})</th><th className={th}>Ind. ↑</th>{W.method === "changeover" && <th className={th}>ΔL ↑</th>}<th className={th}>Ind. ↓</th>{W.method === "changeover" && <th className={th}>ΔL ↓</th>}<th className={th}>MPE</th><th className={th}></th></tr></thead>
                  <tbody>
                    {W.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="p-1"><N disabled={dis} value={r.load} onChange={(v) => upd("weighing", { ...W, rows: W.rows.map((x, j) => (j === i ? { ...x, load: v ?? 0 } : x)) })} /></td>
                        <td className="p-1"><N disabled={dis} value={r.indUp} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("weighing", { ...W, rows: W.rows.map((x, j) => (j === i ? { ...x, indUp: nv } : x)) }))} onChange={(v) => upd("weighing", { ...W, rows: W.rows.map((x, j) => (j === i ? { ...x, indUp: v } : x)) })} /></td>
                        {W.method === "changeover" && <td className="p-1"><N disabled={dis} value={r.dLUp} onChange={(v) => upd("weighing", { ...W, rows: W.rows.map((x, j) => (j === i ? { ...x, dLUp: v } : x)) })} /></td>}
                        <td className="p-1"><N disabled={dis} value={r.indDown} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("weighing", { ...W, rows: W.rows.map((x, j) => (j === i ? { ...x, indDown: nv } : x)) }))} onChange={(v) => upd("weighing", { ...W, rows: W.rows.map((x, j) => (j === i ? { ...x, indDown: v } : x)) })} /></td>
                        {W.method === "changeover" && <td className="p-1"><N disabled={dis} value={r.dLDown} onChange={(v) => upd("weighing", { ...W, rows: W.rows.map((x, j) => (j === i ? { ...x, dLDown: v } : x)) })} /></td>}
                        <td className="p-1 text-xs text-slate-500">±{mpe(r.load)} {u}</td>
                        <td className="p-1">{!dis && <button onClick={() => upd("weighing", { ...W, rows: W.rows.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!dis && <button onClick={() => upd("weighing", { ...W, applicable: true, rows: [...W.rows, { load: 0, indUp: null, dLUp: null, indDown: null, dLDown: null }] })} className="mt-2 text-sm text-teal-700">+ Add load</button>}
              </>
            )}

            {/* ------------------------------------------------ REPEATABILITY */}
            {active === "repeatability" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", R.applicable, (v) => upd("repeatability", { ...R, applicable: v }))}
                  {!dis && <button className={btnSecondary} onClick={() => { const n = spec.max <= (u === "kg" ? 100 : 100000) ? rules.repeatability.weighingsIfMaxLe100kg : rules.repeatability.weighingsIfMaxGt100kg; upd("repeatability", { applicable: true, series: [{ load: rnd(spec.max / 2), readings: Array(n).fill(null) }, { load: spec.max, readings: Array(n).fill(null) }] }); }}>Prepare series (≈50 % Max & Max)</button>}
                </div>
                <p className="mb-3 text-xs text-slate-500">{rules.repeatability.seriesRequired} series; {rules.repeatability.weighingsIfMaxLe100kg} weighings if Max ≤ 100 kg, otherwise {rules.repeatability.weighingsIfMaxGt100kg}. Max − Min of the results shall not exceed |MPE| for the load.</p>
                {R.series.map((s, si) => (
                  <div key={si} className="mb-4 rounded-lg border border-slate-100 p-3">
                    <div className="mb-2 flex items-center gap-3 text-sm">Load ({u}): <input type="number" step="any" disabled={dis} className="w-28 rounded border border-slate-300 px-2 py-1" value={s.load} onChange={(e) => upd("repeatability", { ...R, series: R.series.map((x, j) => (j === si ? { ...x, load: Number(e.target.value) } : x)) })} /> <span className="text-xs text-slate-500">|MPE| = {mpe(s.load)} {u}</span>{!dis && <button onClick={() => upd("repeatability", { ...R, series: R.series.filter((_, j) => j !== si) })} className="ml-auto text-xs text-rose-600">remove series</button>}</div>
                    <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
                      {s.readings.map((v, ri) => (
                        <N
                          key={ri}
                          disabled={dis}
                          placeholder={`#${ri + 1}`}
                          value={v}
                          onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("repeatability", { ...R, series: R.series.map((x, j) => (j === si ? { ...x, readings: x.readings.map((y, k) => (k === ri ? nv : y)) } : x)) }))}
                          onChange={(nv) => upd("repeatability", { ...R, series: R.series.map((x, j) => (j === si ? { ...x, readings: x.readings.map((y, k) => (k === ri ? nv : y)) } : x)) })}
                        />
                      ))}
                    </div>
                    {!dis && <button onClick={() => upd("repeatability", { ...R, series: R.series.map((x, j) => (j === si ? { ...x, readings: [...x.readings, null] } : x)) })} className="mt-2 text-xs text-teal-700">+ reading</button>}
                  </div>
                ))}
                {!dis && <button onClick={() => upd("repeatability", { ...R, applicable: true, series: [...R.series, { load: spec.max, readings: Array(3).fill(null) }] })} className="text-sm text-teal-700">+ Add series</button>}
              </>
            )}

            {/* ------------------------------------------------ ECCENTRICITY */}
            {active === "eccentricity" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", E.applicable, (v) => upd("eccentricity", { ...E, applicable: v }))}
                  <label className="text-sm">Test load ({u}):&nbsp;<input type="number" step="any" disabled={dis} className="w-28 rounded border border-slate-300 px-2 py-1" value={E.load} onChange={(e) => upd("eccentricity", { ...E, load: Number(e.target.value) })} /></label>
                  <span className="text-xs text-slate-500">Recommended ≈ Max/3 = {rnd(spec.max / 3)} {u} · MPE ±{mpe(E.load)} {u}</span>
                  {!dis && <button className={btnSecondary} onClick={() => upd("eccentricity", { applicable: true, load: rnd(spec.max / 3), positions: [1, 2, 3, 4, 5].map((p) => ({ position: p, indication: null, dL: null })) })}>Prepare 5 positions</button>}
                </div>
                <div className="mb-3 grid grid-cols-3 gap-1 text-center text-[10px] text-slate-500" style={{ maxWidth: 160 }}>
                  <div className="rounded border p-1">2</div><div></div><div className="rounded border p-1">3</div>
                  <div></div><div className="rounded border border-teal-500 bg-teal-50 p-1">1</div><div></div>
                  <div className="rounded border p-1">5</div><div></div><div className="rounded border p-1">4</div>
                </div>
                <table className="w-full"><thead><tr><th className={th}>Position</th><th className={th}>Indication</th>{W.method === "changeover" && <th className={th}>ΔL</th>}<th className={th}></th></tr></thead>
                  <tbody>{E.positions.map((p, i) => (
                    <tr key={i}>
                      <td className="p-1"><N disabled={dis} value={p.position} onChange={(v) => upd("eccentricity", { ...E, positions: E.positions.map((x, j) => (j === i ? { ...x, position: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={p.indication} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("eccentricity", { ...E, positions: E.positions.map((x, j) => (j === i ? { ...x, indication: nv } : x)) }))} onChange={(v) => upd("eccentricity", { ...E, positions: E.positions.map((x, j) => (j === i ? { ...x, indication: v } : x)) })} /></td>
                      {W.method === "changeover" && <td className="p-1"><N disabled={dis} value={p.dL} onChange={(v) => upd("eccentricity", { ...E, positions: E.positions.map((x, j) => (j === i ? { ...x, dL: v } : x)) })} /></td>}
                      <td className="p-1">{!dis && <button onClick={() => upd("eccentricity", { ...E, positions: E.positions.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                    </tr>
                  ))}</tbody></table>
                {!dis && <button onClick={() => upd("eccentricity", { ...E, applicable: true, positions: [...E.positions, { position: E.positions.length + 1, indication: null, dL: null }] })} className="mt-2 text-sm text-teal-700">+ Add position</button>}
              </>
            )}

            {/* ------------------------------------------------ TARE */}
            {active === "tare" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", T.applicable, (v) => upd("tare", { ...T, applicable: v }))}
                  <label className="text-sm">Tare load ({u}):&nbsp;<input type="number" step="any" disabled={dis} className="w-28 rounded border border-slate-300 px-2 py-1" value={T.tareLoad} onChange={(e) => upd("tare", { ...T, tareLoad: Number(e.target.value) })} /></label>
                  {!dis && <button className={btnSecondary} onClick={() => upd("tare", { applicable: true, tareLoad: T.tareLoad, rows: [spec.min, rnd(spec.max * 0.25), rnd(spec.max * 0.5), rnd(spec.max - T.tareLoad)].filter((l) => l > 0).map((load) => ({ load, indication: null, dL: null })) })}>Suggest net loads</button>}
                </div>
                <p className="mb-3 text-xs text-slate-500">Set tare, then apply net loads; MPE is applied to the net load. Tare + net must not exceed Max.</p>
                <table className="w-full"><thead><tr><th className={th}>Net load ({u})</th><th className={th}>Indication (net)</th>{W.method === "changeover" && <th className={th}>ΔL</th>}<th className={th}>MPE</th><th className={th}></th></tr></thead>
                  <tbody>{T.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-1"><N disabled={dis} value={r.load} onChange={(v) => upd("tare", { ...T, rows: T.rows.map((x, j) => (j === i ? { ...x, load: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.indication} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("tare", { ...T, rows: T.rows.map((x, j) => (j === i ? { ...x, indication: nv } : x)) }))} onChange={(v) => upd("tare", { ...T, rows: T.rows.map((x, j) => (j === i ? { ...x, indication: v } : x)) })} /></td>
                      {W.method === "changeover" && <td className="p-1"><N disabled={dis} value={r.dL} onChange={(v) => upd("tare", { ...T, rows: T.rows.map((x, j) => (j === i ? { ...x, dL: v } : x)) })} /></td>}
                      <td className="p-1 text-xs text-slate-500">±{mpe(r.load)} {u}</td>
                      <td className="p-1">{!dis && <button onClick={() => upd("tare", { ...T, rows: T.rows.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                    </tr>
                  ))}</tbody></table>
                {!dis && <button onClick={() => upd("tare", { ...T, applicable: true, rows: [...T.rows, { load: 0, indication: null, dL: null }] })} className="mt-2 text-sm text-teal-700">+ Add net load</button>}
              </>
            )}

            {/* ------------------------------------------------ DISCRIMINATION */}
            {active === "discrimination" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", D.applicable, (v) => upd("discrimination", { ...D, applicable: v }))}
                  {!dis && <button className={btnSecondary} onClick={() => upd("discrimination", { applicable: true, rows: [spec.min, rnd(spec.max / 2), spec.max].map((load) => ({ load, indication: null, indicationAfter: null })) })}>Prepare (Min, ½ Max, Max)</button>}
                </div>
                <p className="mb-3 text-xs text-slate-500">At each load, note the indication I₁, then gently add an extra load of {rules.discrimination.extraLoadInD} d = {rnd(rules.discrimination.extraLoadInD * spec.d)} {u}. The indication I₂ must increase by at least {rules.discrimination.requiredChangeInD} d.</p>
                <table className="w-full"><thead><tr><th className={th}>Load ({u})</th><th className={th}>Indication I₁</th><th className={th}>Indication I₂ (after +1.4 d)</th><th className={th}></th></tr></thead>
                  <tbody>{D.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-1"><N disabled={dis} value={r.load} onChange={(v) => upd("discrimination", { ...D, rows: D.rows.map((x, j) => (j === i ? { ...x, load: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.indication} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("discrimination", { ...D, rows: D.rows.map((x, j) => (j === i ? { ...x, indication: nv } : x)) }))} onChange={(v) => upd("discrimination", { ...D, rows: D.rows.map((x, j) => (j === i ? { ...x, indication: v } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.indicationAfter} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("discrimination", { ...D, rows: D.rows.map((x, j) => (j === i ? { ...x, indicationAfter: nv } : x)) }))} onChange={(v) => upd("discrimination", { ...D, rows: D.rows.map((x, j) => (j === i ? { ...x, indicationAfter: v } : x)) })} /></td>
                      <td className="p-1">{!dis && <button onClick={() => upd("discrimination", { ...D, rows: D.rows.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                    </tr>
                  ))}</tbody></table>
                {!dis && <button onClick={() => upd("discrimination", { ...D, applicable: true, rows: [...D.rows, { load: 0, indication: null, indicationAfter: null }] })} className="mt-2 text-sm text-teal-700">+ Add load</button>}
              </>
            )}

            {/* ------------------------------------------------ ZERO SETTING */}
            {active === "zeroSetting" && (
              <>
                <div className="mb-3">{applicableToggle("Test applicable", Z.applicable, (v) => upd("zeroSetting", { ...Z, applicable: v }))}</div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="text-sm"><span className="block text-xs text-slate-500">Initial zero-setting range ({u}) – limit {rules.zeroSetting.initialRangePct} % Max = {rnd(spec.max * rules.zeroSetting.initialRangePct / 100)}</span><N disabled={dis} value={Z.initialRange} onChange={(v) => upd("zeroSetting", { ...Z, applicable: true, initialRange: v })} /></label>
                  <label className="text-sm"><span className="block text-xs text-slate-500">Semi-automatic zero range ({u}) – limit {rules.zeroSetting.semiAutoRangePct} % Max = {rnd(spec.max * rules.zeroSetting.semiAutoRangePct / 100)}</span><N disabled={dis} value={Z.semiAutoRange} onChange={(v) => upd("zeroSetting", { ...Z, applicable: true, semiAutoRange: v })} /></label>
                  <label className="text-sm"><span className="block text-xs text-slate-500">Zero-setting accuracy ({u}) – limit ±{rules.zeroSetting.accuracyE} e = ±{rnd(spec.e * rules.zeroSetting.accuracyE)}</span><N disabled={dis} value={Z.zeroAccuracy} onChange={(v) => upd("zeroSetting", { ...Z, applicable: true, zeroAccuracy: v })} /></label>
                </div>
              </>
            )}

            {/* ------------------------------------------------ WARM-UP */}
            {active === "warmup" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", WU.applicable, (v) => upd("warmup", { ...WU, applicable: v }))}
                  <label className="text-sm">Test load ({u}):&nbsp;<input type="number" step="any" disabled={dis} className="w-28 rounded border border-slate-300 px-2 py-1" value={WU.load} onChange={(e) => upd("warmup", { ...WU, load: Number(e.target.value) })} /></label>
                  {!dis && <button className={btnSecondary} onClick={() => upd("warmup", { applicable: true, load: WU.load || spec.max, rows: rules.warmup.checkpointsMin.map((minute) => ({ minute, zeroInd: null, indication: null })) })}>Prepare checkpoints ({rules.warmup.checkpointsMin.join(", ")} min)</button>}
                </div>
                <table className="w-full"><thead><tr><th className={th}>Time after switch-on (min)</th><th className={th}>Zero indication</th><th className={th}>Indication at load</th><th className={th}></th></tr></thead>
                  <tbody>{WU.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-1"><N disabled={dis} value={r.minute} onChange={(v) => upd("warmup", { ...WU, rows: WU.rows.map((x, j) => (j === i ? { ...x, minute: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.zeroInd} onChange={(v) => upd("warmup", { ...WU, rows: WU.rows.map((x, j) => (j === i ? { ...x, zeroInd: v } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.indication} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("warmup", { ...WU, rows: WU.rows.map((x, j) => (j === i ? { ...x, indication: nv } : x)) }))} onChange={(v) => upd("warmup", { ...WU, rows: WU.rows.map((x, j) => (j === i ? { ...x, indication: v } : x)) })} /></td>
                      <td className="p-1">{!dis && <button onClick={() => upd("warmup", { ...WU, rows: WU.rows.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                    </tr>
                  ))}</tbody></table>
                {!dis && <button onClick={() => upd("warmup", { ...WU, applicable: true, rows: [...WU.rows, { minute: 0, zeroInd: null, indication: null }] })} className="mt-2 text-sm text-teal-700">+ Add checkpoint</button>}
              </>
            )}

            {/* ------------------------------------------------ TEMPERATURE */}
            {active === "temperature" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", TP.applicable, (v) => upd("temperature", { ...TP, applicable: v }))}
                  {!dis && <button className={btnSecondary} onClick={() => upd("temperature", { applicable: true, rows: [20, tempRange[1], tempRange[0], 5, 20].map((temp) => ({ temp, load: spec.max, zeroInd: null, indication: null })) })}>Prepare sequence (20, {tempRange[1]}, {tempRange[0]}, 5, 20 °C)</button>}
                </div>
                <p className="mb-3 text-xs text-slate-500">Sequence: 20 °C → Tmax → Tmin → 5 °C → 20 °C. Errors at each temperature within MPE; zero drift ≤ 1 e per 5 °C.</p>
                <table className="w-full"><thead><tr><th className={th}>Temp (°C)</th><th className={th}>Load ({u})</th><th className={th}>Zero indication</th><th className={th}>Indication</th><th className={th}></th></tr></thead>
                  <tbody>{TP.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-1"><N disabled={dis} value={r.temp} onChange={(v) => upd("temperature", { ...TP, rows: TP.rows.map((x, j) => (j === i ? { ...x, temp: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.load} onChange={(v) => upd("temperature", { ...TP, rows: TP.rows.map((x, j) => (j === i ? { ...x, load: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.zeroInd} onChange={(v) => upd("temperature", { ...TP, rows: TP.rows.map((x, j) => (j === i ? { ...x, zeroInd: v } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.indication} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("temperature", { ...TP, rows: TP.rows.map((x, j) => (j === i ? { ...x, indication: nv } : x)) }))} onChange={(v) => upd("temperature", { ...TP, rows: TP.rows.map((x, j) => (j === i ? { ...x, indication: v } : x)) })} /></td>
                      <td className="p-1">{!dis && <button onClick={() => upd("temperature", { ...TP, rows: TP.rows.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                    </tr>
                  ))}</tbody></table>
                {!dis && <button onClick={() => upd("temperature", { ...TP, applicable: true, rows: [...TP.rows, { temp: 20, load: spec.max, zeroInd: null, indication: null }] })} className="mt-2 text-sm text-teal-700">+ Add row</button>}
              </>
            )}

            {/* ------------------------------------------------ VOLTAGE */}
            {active === "voltage" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", V.applicable, (v) => upd("voltage", { ...V, applicable: v }))}
                  <label className="text-sm">Nominal (V):&nbsp;<input type="number" step="any" disabled={dis} className="w-24 rounded border border-slate-300 px-2 py-1" value={V.nominal} onChange={(e) => upd("voltage", { ...V, nominal: Number(e.target.value) })} /></label>
                  {!dis && <button className={btnSecondary} onClick={() => upd("voltage", { applicable: true, nominal: V.nominal, rows: [rnd(V.nominal * (1 + rules.voltage.lowPct / 100)), V.nominal, rnd(V.nominal * (1 + rules.voltage.highPct / 100))].map((voltage) => ({ voltage, load: spec.max, indication: null })) })}>Prepare ({rules.voltage.lowPct} %, 0, +{rules.voltage.highPct} %)</button>}
                </div>
                <table className="w-full"><thead><tr><th className={th}>Voltage (V)</th><th className={th}>Load ({u})</th><th className={th}>Indication</th><th className={th}></th></tr></thead>
                  <tbody>{V.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-1"><N disabled={dis} value={r.voltage} onChange={(v) => upd("voltage", { ...V, rows: V.rows.map((x, j) => (j === i ? { ...x, voltage: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.load} onChange={(v) => upd("voltage", { ...V, rows: V.rows.map((x, j) => (j === i ? { ...x, load: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.indication} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("voltage", { ...V, rows: V.rows.map((x, j) => (j === i ? { ...x, indication: nv } : x)) }))} onChange={(v) => upd("voltage", { ...V, rows: V.rows.map((x, j) => (j === i ? { ...x, indication: v } : x)) })} /></td>
                      <td className="p-1">{!dis && <button onClick={() => upd("voltage", { ...V, rows: V.rows.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                    </tr>
                  ))}</tbody></table>
                {!dis && <button onClick={() => upd("voltage", { ...V, applicable: true, rows: [...V.rows, { voltage: V.nominal, load: spec.max, indication: null }] })} className="mt-2 text-sm text-teal-700">+ Add row</button>}
              </>
            )}

            {/* ------------------------------------------------ SPAN STABILITY */}
            {active === "spanStability" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", S.applicable, (v) => upd("spanStability", { ...S, applicable: v }))}
                  <label className="text-sm">Load ({u}):&nbsp;<input type="number" step="any" disabled={dis} className="w-28 rounded border border-slate-300 px-2 py-1" value={S.load} onChange={(e) => upd("spanStability", { ...S, load: Number(e.target.value) })} /></label>
                  <span className="text-xs text-slate-500">Limit {rules.spanStability.mpeFraction} × |MPE| = {rnd(rules.spanStability.mpeFraction * mpe(S.load))} {u}</span>
                  {!dis && <button className={btnSecondary} onClick={() => upd("spanStability", { applicable: true, load: S.load || spec.max, rows: Array.from({ length: rules.spanStability.minMeasurements }, (_, i) => ({ date: new Date(Date.now() + i * 4 * 86400000).toISOString().slice(0, 10), indication: null })) })}>Prepare {rules.spanStability.minMeasurements} measurements</button>}
                </div>
                <table className="w-full"><thead><tr><th className={th}>Date</th><th className={th}>Indication</th><th className={th}></th></tr></thead>
                  <tbody>{S.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-1"><input type="date" disabled={dis} className={cell} value={r.date} onChange={(e) => upd("spanStability", { ...S, rows: S.rows.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.indication} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("spanStability", { ...S, rows: S.rows.map((x, j) => (j === i ? { ...x, indication: nv } : x)) }))} onChange={(v) => upd("spanStability", { ...S, rows: S.rows.map((x, j) => (j === i ? { ...x, indication: v } : x)) })} /></td>
                      <td className="p-1">{!dis && <button onClick={() => upd("spanStability", { ...S, rows: S.rows.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                    </tr>
                  ))}</tbody></table>
                {!dis && <button onClick={() => upd("spanStability", { ...S, applicable: true, rows: [...S.rows, { date: new Date().toISOString().slice(0, 10), indication: null }] })} className="mt-2 text-sm text-teal-700">+ Add measurement</button>}
              </>
            )}

            {/* ------------------------------------------------ DAMP HEAT */}
            {active === "dampHeat" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {applicableToggle("Test applicable", DH.applicable, (v) => upd("dampHeat", { ...DH, applicable: v }))}
                  {!dis && <button className={btnSecondary} onClick={() => upd("dampHeat", { applicable: true, rows: ["Before (20 °C / 50 %RH)", "During (40 °C / 85 %RH)", "After recovery"].map((condition) => ({ condition, load: spec.max, indication: null })) })}>Prepare 3 conditions</button>}
                </div>
                <table className="w-full"><thead><tr><th className={th}>Condition</th><th className={th}>Load ({u})</th><th className={th}>Indication</th><th className={th}></th></tr></thead>
                  <tbody>{DH.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-1"><input disabled={dis} className={cell} value={r.condition} onChange={(e) => upd("dampHeat", { ...DH, rows: DH.rows.map((x, j) => (j === i ? { ...x, condition: e.target.value } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.load} onChange={(v) => upd("dampHeat", { ...DH, rows: DH.rows.map((x, j) => (j === i ? { ...x, load: v ?? 0 } : x)) })} /></td>
                      <td className="p-1"><N disabled={dis} value={r.indication} onFocus={() => setLastFocusedSetter(() => (nv: number) => upd("dampHeat", { ...DH, rows: DH.rows.map((x, j) => (j === i ? { ...x, indication: nv } : x)) }))} onChange={(v) => upd("dampHeat", { ...DH, rows: DH.rows.map((x, j) => (j === i ? { ...x, indication: v } : x)) })} /></td>
                      <td className="p-1">{!dis && <button onClick={() => upd("dampHeat", { ...DH, rows: DH.rows.filter((_, j) => j !== i) })} className="text-xs text-rose-600">✕</button>}</td>
                    </tr>
                  ))}</tbody></table>
                {!dis && <button onClick={() => upd("dampHeat", { ...DH, applicable: true, rows: [...DH.rows, { condition: "", load: spec.max, indication: null }] })} className="mt-2 text-sm text-teal-700">+ Add row</button>}
              </>
            )}
          </div>

          {/* ------------------------------------------------ LIVE EVALUATION */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Automatic evaluation</h4>
              <VerdictBadge verdict={res.verdict} />
            </div>
            {res.warnings.length > 0 && (
              <ul className="mb-3 space-y-1 rounded-md bg-amber-50 p-3 text-xs text-amber-800">{res.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>
            )}
            {res.integrityFlags.length > 0 && (
              <ul className="mb-3 space-y-1 rounded-md bg-violet-50 p-3 text-xs text-violet-800">{res.integrityFlags.map((w) => <li key={w}>👻 Integrity guard: {w}</li>)}</ul>
            )}
            <ResultTable r={res} />
            <p className="mt-3 text-xs text-slate-500">{res.summary}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
