"use client";

import { useActionState } from "react";
import { updateReportMetaAction } from "../actions";
import { Field, inputCls, btnPrimary } from "@/components/ui";
import type { TestReport } from "@/db/schema";

const d = (v: Date | string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export function ReportDetailsForm({ report: r, canEdit }: { report: TestReport; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateReportMetaAction, undefined);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={r.id} />
      <fieldset disabled={!canEdit} className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Application</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Purpose"><select name="purpose" defaultValue={r.purpose} className={inputCls}><option>Model Approval (Type Evaluation)</option><option>Initial Verification</option><option>Subsequent Verification</option><option>Re-evaluation after modification</option></select></Field>
            <Field label="Application / file reference"><input name="applicationRef" defaultValue={r.applicationRef ?? ""} className={inputCls} /></Field>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Laboratory</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Laboratory name"><input name="labName" defaultValue={r.labName} className={inputCls} /></Field>
            <Field label="Accreditation"><input name="labAccreditation" defaultValue={r.labAccreditation ?? ""} className={inputCls} /></Field>
            <Field label="Address"><input name="labAddress" defaultValue={r.labAddress ?? ""} className={inputCls} /></Field>
            <Field label="Test location"><input name="testLocation" defaultValue={r.testLocation ?? ""} className={inputCls} /></Field>
            <Field label="Reference standards / equipment used" className="sm:col-span-2"><textarea name="referenceStandards" rows={2} defaultValue={r.referenceStandards ?? ""} className={inputCls} /></Field>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Environmental conditions & schedule</h3>
          <div className="grid gap-4 sm:grid-cols-5">
            <Field label="Temperature (°C)"><input name="temperature" type="number" step="any" defaultValue={r.temperature ?? ""} className={inputCls} /></Field>
            <Field label="Rel. humidity (%)"><input name="humidity" type="number" step="any" defaultValue={r.humidity ?? ""} className={inputCls} /></Field>
            <Field label="Pressure (hPa)"><input name="pressure" type="number" step="any" defaultValue={r.pressure ?? ""} className={inputCls} /></Field>
            <Field label="Start date"><input name="startDate" type="date" defaultValue={d(r.startDate)} className={inputCls} /></Field>
            <Field label="End date"><input name="endDate" type="date" defaultValue={d(r.endDate)} className={inputCls} /></Field>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Remarks / conclusion notes</h3>
          <textarea name="remarks" rows={3} defaultValue={r.remarks ?? ""} className={inputCls} placeholder="Observations, deviations, manufacturer statements…" />
        </div>
      </fieldset>
      {state?.ok && <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">Details saved.</p>}
      {canEdit && <button className={btnPrimary} disabled={pending}>{pending ? "Saving…" : "Save details"}</button>}
    </form>
  );
}
