"use client";

import { useActionState } from "react";
import { publishRuleSetAction } from "../actions";
import { Field, btnPrimary, inputCls } from "@/components/ui";

export function RuleSetForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState(publishRuleSetAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Version label"><input name="version" placeholder="e.g. 2026 (E) – draft CD" required className={inputCls} /></Field>
      <Field label="Title"><input name="title" placeholder="OIML R 76-1:2026 …" className={inputCls} /></Field>
      <Field label="Configuration (JSON)" hint="Edit thresholds, MPE bands, class tables or clause references. Pre-filled with the active version."><textarea name="config" rows={18} defaultValue={initial} className={`${inputCls} font-mono text-[11px]`} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activate" className="h-4 w-4 accent-teal-700" /> Activate immediately for new reports</label>
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">Rule set published.</p>}
      <button className={btnPrimary} disabled={pending}>{pending ? "Publishing…" : "Publish version"}</button>
    </form>
  );
}
