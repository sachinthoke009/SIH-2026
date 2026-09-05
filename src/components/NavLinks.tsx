"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "▦", roles: ["admin", "tester", "reviewer"] },
  { href: "/reports", label: "Test Reports", icon: "▤", roles: ["admin", "tester", "reviewer"] },
  { href: "/reports/new", label: "New Test Report", icon: "＋", roles: ["admin", "tester"] },
  { href: "/instruments", label: "Instruments", icon: "⚖", roles: ["admin", "tester", "reviewer"] },
  { href: "/admin/rules", label: "R 76 Rule Sets", icon: "§", roles: ["admin", "tester", "reviewer"] },
  { href: "/admin/users", label: "Users & Roles", icon: "👥", roles: ["admin"] },
];

export function NavLinks({ role }: { role: string }) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {links
        .filter((l) => l.roles.includes(role))
        .map((l) => {
          const active = l.href === "/reports" ? path === "/reports" || (path.startsWith("/reports/") && path !== "/reports/new") : path === l.href || path.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-teal-600/20 text-white ring-1 ring-teal-500/40" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
            >
              <span className="w-5 text-center text-base">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
    </nav>
  );
}
