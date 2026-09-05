"use client";

import { btnPrimary, btnSecondary } from "@/components/ui";
import { useRouter } from "next/navigation";

export function PrintButton() {
  const router = useRouter();
  return (
    <>
      <button onClick={() => router.back()} className={btnSecondary}>← Back</button>
      <button onClick={() => window.print()} className={btnPrimary}>🖨 Print / Save as PDF</button>
    </>
  );
}
