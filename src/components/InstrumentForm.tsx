"use client";

import { useActionState, useMemo, useState } from "react";
import { saveInstrumentAction } from "@/app/(app)/instruments/actions";
import { Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { ACCURACY_CLASSES, INSTRUMENT_TYPES, type R76RuleConfig } from "@/lib/r76/rules";
import { checkClassification, mpeFor, type InstrumentSpec } from "@/lib/r76/engine";
import type { Instrument } from "@/db/schema";

export function InstrumentForm({ rules, instrument }: { rules: R76RuleConfig; instrument?: Instrument | null }) {
  const [state, action, pending] = useActionState(saveInstrumentAction, undefined);
  const [cls, setCls] = useState(instrument?.accuracyClass ?? "III");
  const [unit, setUnit] = useState(instrument?.unit ?? "kg");
  const [max, setMax] = useState(instrument?.maxCapacity?.toString() ?? "");
  const [min, setMin] = useState(instrument?.minCapacity?.toString() ?? "");
  const [e, setE] = useState(instrument?.verificationInterval?.toString() ?? "");
  const [d, setD] = useState(instrument?.actualInterval?.toString() ?? "");

  const check = useMemo(() => {
    const spec: InstrumentSpec = { accuracyClass: cls as InstrumentSpec["accuracyClass"], unit: unit as "kg" | "g", max: Number(max), min: Number(min), e: Number(e), d: Number(d), indicationType: "digital" };
    if (!(spec.max > 0 && spec.e > 0)) return null;
    const c = checkClassification(spec, rules);
    const bands = rules.mpeBands.map((b) => {
      const lim = b.upTo[spec.accuracyClass];
      return { mult: b.mult, upTo: lim === null ? null : lim * spec.e, mpe: mpeFor((lim ?? 1e12) * spec.e, spec, rules).value };
    });
    return { ...c, bands, spec };
  }, [cls, unit, max, min, e, d, rules]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      {instrument && <input type="hidden" name="id" value={instrument.id} />}
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Manufacturer & applicant</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Manufacturer *"><input name="manufacturer" required defaultValue={instrument?.manufacturer} className={inputCls} /></Field>
            <Field label="Manufacturer address"><input name="manufacturerAddress" defaultValue={instrument?.manufacturerAddress ?? ""} className={inputCls} /></Field>
            <Field label="Applicant"><input name="applicant" defaultValue={instrument?.applicant ?? ""} className={inputCls} /></Field>
            <Field label="Applicant address"><input name="applicantAddress" defaultValue={instrument?.applicantAddress ?? ""} className={inputCls} /></Field>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Instrument identification</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Model / type designation *"><input name="model" required defaultValue={instrument?.model} className={inputCls} /></Field>
            <Field label="Serial number *"><input name="serialNumber" required defaultValue={instrument?.serialNumber} className={inputCls} /></Field>
            <Field label="Instrument type">
              <select name="instrumentType" defaultValue={instrument?.instrumentType ?? INSTRUMENT_TYPES[0]} className={inputCls}>
                {INSTRUMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Indication"><select name="indicationType" defaultValue={instrument?.indicationType ?? "digital"} className={inputCls}><option value="digital">Digital</option><option value="analog">Analogue</option></select></Field>
            <Field label="Load cell(s)"><input name="loadCell" defaultValue={instrument?.loadCell ?? ""} className={inputCls} /></Field>
            <Field label="Indicator"><input name="indicator" defaultValue={instrument?.indicator ?? ""} className={inputCls} /></Field>
            <Field label="Software version / checksum"><input name="softwareVersion" defaultValue={instrument?.softwareVersion ?? ""} className={inputCls} /></Field>
            <Field label="Power supply"><input name="powerSupply" defaultValue={instrument?.powerSupply ?? "AC 230 V, 50 Hz"} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Temp. min (°C)"><input name="tempRangeMin" type="number" step="any" defaultValue={instrument?.tempRangeMin ?? -10} className={inputCls} /></Field>
              <Field label="Temp. max (°C)"><input name="tempRangeMax" type="number" step="any" defaultValue={instrument?.tempRangeMax ?? 40} className={inputCls} /></Field>
            </div>
          </div>
          <Field label="Description" className="mt-4"><textarea name="description" rows={2} defaultValue={instrument?.description ?? ""} className={inputCls} /></Field>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Metrological characteristics</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Accuracy class *">
              <select name="accuracyClass" value={cls} onChange={(ev) => setCls(ev.target.value)} className={inputCls}>
                {ACCURACY_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Unit"><select name="unit" value={unit} onChange={(ev) => setUnit(ev.target.value)} className={inputCls}><option value="kg">kg</option><option value="g">g</option></select></Field>
            <div />
            <Field label={`Max capacity (${unit}) *`}><input name="maxCapacity" type="number" step="any" required value={max} onChange={(ev) => setMax(ev.target.value)} className={inputCls} /></Field>
            <Field label={`Min capacity (${unit}) *`}><input name="minCapacity" type="number" step="any" required value={min} onChange={(ev) => setMin(ev.target.value)} className={inputCls} /></Field>
            <div />
            <Field label={`Verification scale interval e (${unit}) *`}><input name="verificationInterval" type="number" step="any" required value={e} onChange={(ev) => { setE(ev.target.value); if (!d) setD(ev.target.value); }} className={inputCls} /></Field>
            <Field label={`Actual scale interval d (${unit}) *`}><input name="actualInterval" type="number" step="any" required value={d} onChange={(ev) => setD(ev.target.value)} className={inputCls} /></Field>
          </div>
        </div>
        {state?.error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={pending} name="next" value="detail">{pending ? "Saving…" : instrument ? "Save changes" : "Save instrument"}</button>
          {!instrument && <button className={btnSecondary} disabled={pending} name="next" value="report">Save & start test report →</button>}
        </div>
      </div>

      <aside className="space-y-4">
        <div className={`rounded-xl border p-5 ${!check ? "border-slate-200 bg-white" : check.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Live R 76 classification check</h3>
          {!check ? (
            <p className="mt-2 text-sm text-slate-500">Enter Max and e to validate the instrument against R 76-1 Table 3.</p>
          ) : (
            <>
              <div className="mt-3 text-3xl font-bold">{check.ok ? "✔ Valid" : "✖ Check"}</div>
              <div className="mt-1 text-sm">n = Max / e = <b>{check.n.toLocaleString()}</b></div>
              <ul className="mt-3 space-y-1 text-xs">
                {check.issues.map((i) => <li key={i} className="text-rose-700">• {i}</li>)}
                {check.notes.map((i) => <li key={i} className="text-slate-600">• {i}</li>)}
              </ul>
            </>
          )}
        </div>
        {check && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">MPE bands (Table 6, initial verification)</h3>
            <table className="mt-3 w-full text-xs">
              <thead><tr className="text-left text-slate-500"><th>Load range</th><th>MPE</th></tr></thead>
              <tbody>
                {check.bands.map((b, i) => {
                  const prev = i === 0 ? 0 : check.bands[i - 1].upTo ?? 0;
                  return (
                    <tr key={b.mult} className="border-t border-slate-100">
                      <td className="py-1">{prev} &lt; m ≤ {b.upTo === null ? "∞" : `${b.upTo} ${unit}`}</td>
                      <td className="py-1 font-mono">±{b.mult} e = ±{b.mpe} {unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-400">In-service MPE = {rules.inServiceFactor} × initial verification MPE.</p>
          </div>
        )}
      </aside>
    </form>
  );
}
