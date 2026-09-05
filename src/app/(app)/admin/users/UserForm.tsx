"use client";

import { useActionState } from "react";
import { createUserAction } from "../actions";
import { Field, btnPrimary, inputCls } from "@/components/ui";

export function UserForm() {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Full name"><input name="name" required className={inputCls} /></Field>
      <Field label="Email"><input name="email" type="email" required className={inputCls} /></Field>
      <Field label="Designation"><input name="designation" className={inputCls} /></Field>
      <Field label="Role"><select name="role" className={inputCls}><option value="tester">Tester</option><option value="reviewer">Reviewer</option><option value="admin">Admin</option></select></Field>
      <Field label="Password"><input name="password" type="password" required minLength={6} className={inputCls} /></Field>
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">User created.</p>}
      <button className={btnPrimary} disabled={pending}>{pending ? "Creating…" : "Create user"}</button>
    </form>
  );
}
