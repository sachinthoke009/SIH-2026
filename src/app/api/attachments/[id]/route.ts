import { db } from "@/db";
import { attachments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const [a] = await db.select().from(attachments).where(eq(attachments.id, Number(id))).limit(1);
  if (!a) return new Response("Not found", { status: 404 });
  const buf = Buffer.from(a.dataBase64, "base64");
  return new Response(buf, { headers: { "Content-Type": a.mimeType, "Content-Disposition": `inline; filename="${a.fileName}"`, "Cache-Control": "private, max-age=3600" } });
}
