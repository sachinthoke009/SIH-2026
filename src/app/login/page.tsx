import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 text-2xl">⚖️</div>
            <div>
              <div className="text-xl font-bold tracking-tight">SmartNAWI</div>
              <div className="text-xs text-teal-200">Digital Testing & Compliance Platform</div>
            </div>
          </div>
          <h1 className="mt-16 text-4xl font-bold leading-tight">
            From manual testing to a single digital workflow for <span className="text-teal-300">OIML R 76</span> type evaluation.
          </h1>
          <p className="mt-6 max-w-lg text-teal-100/80">
            Enter observations once. SmartNAWI validates the data, computes errors and maximum permissible errors, applies R 76 pass/fail rules and produces standardized, traceable test reports.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-4 text-sm">
            {[
              ["Enter Once", "Instrument, lab & test data forms"],
              ["Auto-Validate", "Class / e / n checks & entry guards"],
              ["Auto-Calculate", "Errors, MPE bands, verdicts"],
              ["R 76 Reports", "PDF & Word, signed & audited"],
            ].map(([t, d]) => (
              <li key={t} className="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
                <div className="font-semibold text-teal-200">{t}</div>
                <div className="text-teal-100/70">{d}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-teal-200/60">Legal Metrology Act, 2009 · Legal Metrology (General) Rules, 2011 · OIML R 76-1:2006 · Smart India Hackathon 2026 · PS SIH26035</div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="text-2xl font-bold">⚖️ SmartNAWI</div>
            <div className="text-sm text-slate-500">Digital Testing & Compliance Platform for NAWI</div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Role-based access for laboratory staff.</p>
          <LoginForm />
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <div className="mb-2 font-semibold text-slate-700">Demo accounts</div>
            <table className="w-full">
              <tbody>
                {[
                  ["Admin", "admin@smartnawi.gov.in", "admin123"],
                  ["Tester", "tester@smartnawi.gov.in", "tester123"],
                  ["Reviewer", "reviewer@smartnawi.gov.in", "reviewer123"],
                ].map(([r, e, p]) => (
                  <tr key={r} className="border-t border-slate-100">
                    <td className="py-1 font-medium">{r}</td>
                    <td className="py-1 font-mono">{e}</td>
                    <td className="py-1 font-mono">{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
