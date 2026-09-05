import { requireRole } from "@/lib/auth";
import { getRuleConfig } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { InstrumentForm } from "@/components/InstrumentForm";

export const dynamic = "force-dynamic";

export default async function NewInstrumentPage() {
  await requireRole("admin", "tester");
  const rule = await getRuleConfig();
  return (
    <>
      <PageHeader title="Register instrument" subtitle={`Instrument details are validated live against ${rule.label} (Table 3 – accuracy classes).`} />
      <InstrumentForm rules={rule.config} />
    </>
  );
}
