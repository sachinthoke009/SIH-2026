import Link from "next/link";
import { db } from "@/db";
import { instruments } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getRuleConfig, nextReportNumber } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { NewReportForm } from "./NewReportForm";

export const dynamic = "force-dynamic";

export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ instrumentId?: string }> }) {
  await requireRole("admin", "tester");
  const { instrumentId } = await searchParams;
  const list = await db.select().from(instruments).orderBy(desc(instruments.createdAt));
  const rule = await getRuleConfig();
  const suggested = await nextReportNumber();
  return (
    <>
      <PageHeader title="New test report" subtitle={<>Step 1 of 2 – laboratory, environmental conditions and instrument. Rule set: <b>{rule.label}</b>. Need a new instrument? <Link href="/instruments/new" className="text-teal-700 underline">Register it first</Link>.</>} />
      <NewReportForm instruments={list} defaultInstrumentId={instrumentId ? Number(instrumentId) : undefined} suggestedNumber={suggested} />
    </>
  );
}
