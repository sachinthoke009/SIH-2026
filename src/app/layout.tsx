import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartNAWI – Digital Testing & Compliance Platform for NAWI (OIML R 76)",
  description: "Automated test data capture, R 76 compliance evaluation and standardized test report generation for Non-Automatic Weighing Instruments.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
