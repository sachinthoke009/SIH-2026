import { getCurrentUser } from "@/lib/auth";
import { getReportBundle } from "@/lib/data";
import { buildReportPdf } from "@/lib/export/pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const b = await getReportBundle(Number(id));
  if (!b) return new Response("Not found", { status: 404 });
  const bytes = await buildReportPdf(b);
  const name = b.report.reportNumber.replace(/[^a-z0-9]+/gi, "_");
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
}
