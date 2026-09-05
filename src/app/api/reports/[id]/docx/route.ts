import { getCurrentUser } from "@/lib/auth";
import { getReportBundle } from "@/lib/data";
import { buildReportDocx } from "@/lib/export/docx";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const b = await getReportBundle(Number(id));
  if (!b) return new Response("Not found", { status: 404 });
  const buf = await buildReportDocx(b);
  const name = b.report.reportNumber.replace(/[^a-z0-9]+/gi, "_");
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${name}.docx"` } });
}
