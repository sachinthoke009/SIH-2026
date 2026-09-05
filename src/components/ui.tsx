import type { ReactNode } from "react";
import Link from "next/link";

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const verdictStyles: Record<string, string> = {
  PASS: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  FAIL: "bg-rose-100 text-rose-800 ring-rose-200",
  INCOMPLETE: "bg-amber-100 text-amber-800 ring-amber-200",
  NOT_TESTED: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function VerdictBadge({ verdict, size = "sm" }: { verdict: string; size?: "sm" | "lg" }) {
  const cls = verdictStyles[verdict] ?? verdictStyles.NOT_TESTED;
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ring-1 ${cls} ${size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"}`}>
      {verdict.replace("_", " ")}
    </span>
  );
}

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-100 text-sky-800",
  under_review: "bg-violet-100 text-violet-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};
const statusLabel: Record<string, string> = { draft: "Draft", in_progress: "In Progress", under_review: "Under Review", approved: "Approved", rejected: "Rejected" };

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? statusStyles.draft}`}>{statusLabel[status] ?? status}</span>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = { admin: "bg-rose-50 text-rose-700", tester: "bg-sky-50 text-sky-700", reviewer: "bg-violet-50 text-violet-700" };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${map[role] ?? ""}`}>{role}</span>;
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50";
export const btnPrimary = "inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50";
export const btnSecondary = "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50";
export const btnDanger = "inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "slate", href }: { label: string; value: ReactNode; tone?: string; href?: string }) {
  const tones: Record<string, string> = {
    slate: "from-slate-700 to-slate-900",
    teal: "from-teal-600 to-teal-800",
    emerald: "from-emerald-600 to-emerald-800",
    rose: "from-rose-600 to-rose-800",
    amber: "from-amber-500 to-amber-700",
    violet: "from-violet-600 to-violet-800",
    sky: "from-sky-600 to-sky-800",
  };
  const body = (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} p-4 text-white shadow-sm`}>
      <div className="text-xs font-medium uppercase tracking-wide text-white/80">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{text}</div>;
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
