import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { RoleBadge } from "@/components/ui";
import { NavLinks } from "@/components/NavLinks";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-64 flex-col bg-slate-900 text-slate-200 md:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-600 text-xl">⚖️</div>
          <div>
            <div className="font-bold leading-tight text-white">SmartNAWI</div>
            <div className="text-[11px] text-slate-400">OIML R 76 Test Platform</div>
          </div>
        </div>
        <NavLinks role={user.role} />
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="text-sm font-medium text-white">{user.name}</div>
          <div className="mb-2 text-xs text-slate-400">{user.designation}</div>
          <div className="flex items-center justify-between">
            <RoleBadge role={user.role} />
            <form action={logoutAction}>
              <button className="text-xs text-slate-300 hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 md:hidden">
          <Link href="/dashboard" className="font-bold">⚖️ SmartNAWI</Link>
          <form action={logoutAction}><button className="text-xs text-slate-500">Sign out</button></form>
        </header>
        <main className="flex-1 px-6 py-6 lg:px-10">{children}</main>
        <footer className="no-print border-t border-slate-200 px-6 py-3 text-xs text-slate-400">
          SmartNAWI · Team Limitless · Legal Metrology (DoCA) · Rule engine: configurable OIML R 76-1 layer
        </footer>
      </div>
    </div>
  );
}
