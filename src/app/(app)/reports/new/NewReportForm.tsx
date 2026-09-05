"use client";

import { useActionState } from "react";
import { createReportAction } from "../actions";
import { Field, inputCls, btnPrimary } from "@/components/ui";
import type { Instrument } from "@/db/schema";

export function NewReportForm({ instruments, defaultInstrumentId, suggestedNumber }: { instruments: Instrument[]; defaultInstrumentId?: number; suggestedNumber: string }) {
  const [state, action, pending] = useActionState(createReportAction, undefined);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Instrument under test</h3>
          <Field label="Instrument *">
            <select name="instrumentId" required defaultValue={defaultInstrumentId ?? ""} className={inputCls}>
              <option value="" disabled>Select registered instrument…</option>
              {instruments.map((i) => <option key={i.id} value={i.id}>{i.manufacturer} – {i.model} · S/N {i.serialNumber} · Class {i.accuracyClass} · Max {i.maxCapacity} {i.unit}, e = {i.verificationInterval} {i.unit}</option>)}
            </select>
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Report number" hint="Auto-generated; editable"><input name="reportNumber" defaultValue={suggestedNumber} className={inputCls} /></Field>
            <Field label="Application / file reference"><input name="applicationRef" placeholder="DoCA/LM/MA/2026/…" className={inputCls} /></Field>
            <Field label="Purpose"><select name="purpose" className={inputCls}><option>Model Approval (Type Evaluation)</option><option>Initial Verification</option><option>Subsequent Verification</option><option>Re-evaluation after modification</option></select></Field>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Laboratory</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Laboratory name *"><input name="labName" required defaultValue="Regional Reference Standards Laboratory (RRSL)" className={inputCls} /></Field>
            <Field label="Accreditation"><input name="labAccreditation" defaultValue="NABL Accredited – ISO/IEC 17025:2017" className={inputCls} /></Field>
            <Field label="Address"><input name="labAddress" defaultValue="Ministry of Consumer Affairs, Food & Public Distribution" className={inputCls} /></Field>
            <Field label="Test location"><input name="testLocation" defaultValue="Mass Metrology Lab" className={inputCls} /></Field>
            <Field label="Reference standards used" className="sm:col-span-2"><input name="referenceStandards" defaultValue="F1 / M1 class standard weights traceable to NPL India" className={inputCls} /></Field>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Environmental conditions & schedule</h3>
          <div className="grid gap-4 sm:grid-cols-5">
            <Field label="Temperature (°C)"><input name="temperature" type="number" step="any" defaultValue="22" className={inputCls} /></Field>
            <Field label="Rel. humidity (%)"><input name="humidity" type="number" step="any" defaultValue="50" className={inputCls} /></Field>
            <Field label="Pressure (hPa)"><input name="pressure" type="number" step="any" defaultValue="1010" className={inputCls} /></Field>
            <Field label="Start date"><input name="startDate" type="date" defaultValue={today} className={inputCls} /></Field>
            <Field label="End date"><input name="endDate" type="date" className={inputCls} /></Field>
          </div>
        </div>
        {state?.error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        <button className={btnPrimary} disabled={pending}>{pending ? "Creating…" : "Create report & enter observations →"}</button>
      </div>
      <aside className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-sm text-teal-900">
        <h3 className="font-semibold">What happens next</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-teal-800">
          <li>Laboratory and instrument details auto-populate the report header.</li>
          <li>Enter observations for each applicable R 76 test in digital forms.</li>
          <li>SmartNAWI validates entries, computes errors and MPE, and assigns PASS / FAIL per test.</li>
          <li>Attach photographs, submit for review, approve & sign, export PDF / Word.</li>
        </ol>
      </aside>
    </form>
  );
}
