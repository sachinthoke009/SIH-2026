import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader, RoleBadge, fmtDate } from "@/components/ui";
import { UserForm } from "./UserForm";
import { setRoleAction, toggleUserAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireRole("admin");
  const list = await db.select().from(users).orderBy(users.id);
  return (
    <>
      <PageHeader title="Users & roles" subtitle="Role-based access: Admin (full control, rule sets), Tester (instruments, observations), Reviewer (approve & sign)." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Laboratory users" className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Role</th><th className="pb-2">Status</th><th className="pb-2">Since</th><th className="pb-2"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((u) => (
                <tr key={u.id}>
                  <td className="py-2"><div className="font-medium">{u.name}</div><div className="text-xs text-slate-400">{u.designation}</div></td>
                  <td className="py-2 font-mono text-xs">{u.email}</td>
                  <td className="py-2">
                    {u.id === me.id ? <RoleBadge role={u.role} /> : (
                      <form action={setRoleAction} className="inline"><input type="hidden" name="id" value={u.id} />
                        <select name="role" defaultValue={u.role} className="rounded border border-slate-300 px-2 py-1 text-xs"><option value="admin">admin</option><option value="tester">tester</option><option value="reviewer">reviewer</option></select>
                        <button className="ml-1 text-xs text-teal-700">apply</button>
                      </form>
                    )}
                  </td>
                  <td className="py-2">{u.active ? <span className="text-xs text-emerald-700">active</span> : <span className="text-xs text-rose-700">disabled</span>}</td>
                  <td className="py-2 text-xs text-slate-500">{fmtDate(u.createdAt)}</td>
                  <td className="py-2 text-right">{u.id !== me.id && <form action={toggleUserAction}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={String(!u.active)} /><button className="text-xs text-slate-600 hover:underline">{u.active ? "Disable" : "Enable"}</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Add user"><UserForm /></Card>
      </div>
    </>
  );
}
