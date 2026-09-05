"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { btnPrimary, inputCls } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
        <input name="email" type="email" required defaultValue="tester@smartnawi.gov.in" className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Password</span>
        <input name="password" type="password" required defaultValue="tester123" className={inputCls} />
      </label>
      {state?.error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full justify-center`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
