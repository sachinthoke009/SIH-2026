import { AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { ReportBundle } from "@/lib/data";
import { specFromInstrument } from "@/lib/data";
import { checkClassification, type EvaluationOutput } from "@/lib/r76/engine";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { inArray } from "drizzle-orm";

const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const border = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
const borders = { top: border, bottom: border, left: border, right: border };

function cellP(text: string, opts: { bold?: boolean; color?: string; shade?: string; size?: number } = {}) {
  return new TableCell({
    borders,
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: "auto" } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size ?? 16 })] })],
  });
}

function kvTable(rows: [string, unknown][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([k, v]) => new TableRow({ children: [cellP(k, { bold: true, shade: "F1F5F9" }), cellP(String(v ?? "—"))] })),
  });
}

function resultTable(headers: string[], rows: { cells: (string | number)[]; pass: boolean | null }[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h) => cellP(h, { bold: true, shade: "E2E8F0", size: 14 })) }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.cells.map((c, i) => {
              const last = i === r.cells.length - 1;
              return cellP(String(c), { size: 14, bold: last, color: last ? (r.pass === false ? "B91C1C" : r.pass ? "047857" : "64748B") : undefined, shade: r.pass === false ? "FEF2F2" : undefined });
            }),
          }),
      ),
    ],
  });
}

const h = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) => new Paragraph({ heading: level, spacing: { before: 240, after: 80 }, children: [new TextRun({ text })] });
const p = (text: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, ...opts, size: opts.size ?? 18 })] });

export async function buildReportDocx(b: ReportBundle): Promise<Buffer> {
  const { report: r, instrument: i } = b;
  const res = r.results as EvaluationOutput;
  const cls = checkClassification(specFromInstrument(i), b.rule.config);
  const sig = r.signature as { signedBy: string; signedAt: string; hash: string } | null;
  const verdictColor = r.overallVerdict === "PASS" ? "047857" : r.overallVerdict === "FAIL" ? "B91C1C" : "B45309";

  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Government of India · Ministry of Consumer Affairs, Food & Public Distribution", size: 14, color: "64748B" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.labName, bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: [r.labAddress, r.labAccreditation].filter(Boolean).join(" · "), size: 16, color: "475569" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "TEST REPORT – NON-AUTOMATIC WEIGHING INSTRUMENT", bold: true, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `as per ${b.rule.label}`, size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `Report No. ${r.reportNumber}`, bold: true, size: 22 })] }),

    h("1. Application"),
    kvTable([["Purpose", r.purpose], ["Application reference", r.applicationRef], ["Applicant", i.applicant], ["Applicant address", i.applicantAddress], ["Test period", `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`], ["Test location", r.testLocation], ["Tested by", b.tester?.name], ["Reviewed by", b.reviewer?.name]]),

    h("2. Environmental conditions & reference standards"),
    kvTable([["Temperature", r.temperature != null ? `${r.temperature} °C` : null], ["Relative humidity", r.humidity != null ? `${r.humidity} %` : null], ["Atmospheric pressure", r.pressure != null ? `${r.pressure} hPa` : null], ["Reference standards", r.referenceStandards], ["Rule set applied", b.rule.label]]),

    h("3. Instrument under test"),
    kvTable([
      ["Manufacturer", i.manufacturer], ["Manufacturer address", i.manufacturerAddress], ["Model / type designation", i.model], ["Serial number", i.serialNumber], ["Instrument type", i.instrumentType], ["Indication", i.indicationType], ["Software version", i.softwareVersion], ["Power supply", i.powerSupply],
      ["Accuracy class", i.accuracyClass], ["Max", `${i.maxCapacity} ${i.unit}`], ["Min", `${i.minCapacity} ${i.unit}`], ["Verification scale interval e", `${i.verificationInterval} ${i.unit}`], ["Actual scale interval d", `${i.actualInterval} ${i.unit}`], ["n = Max / e", cls.n.toLocaleString()], ["Load cell(s)", i.loadCell], ["Indicator", i.indicator], ["Temperature range", `${i.tempRangeMin} °C to ${i.tempRangeMax} °C`],
    ]),
    p(cls.ok ? "Instrument classification conforms to R 76-1 Table 3." : cls.issues.join(" "), { color: cls.ok ? "047857" : "B91C1C", size: 16 }),

    h("4. Summary of results"),
    resultTable(["#", "Test", "Clause", "Result"], (res.tests ?? []).map((t, idx) => ({ cells: [idx + 1, t.title, t.clause, t.verdict.replace("_", " ")], pass: t.verdict === "PASS" ? true : t.verdict === "FAIL" ? false : null }))),
    new Paragraph({ spacing: { before: 200, after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `OVERALL: ${r.overallVerdict === "PASS" ? "COMPLIES with OIML R 76-1" : r.overallVerdict === "FAIL" ? "DOES NOT COMPLY with OIML R 76-1" : "EVALUATION INCOMPLETE"}`, bold: true, size: 24, color: verdictColor })] }),

    h("5. Detailed test results"),
  ];

  let n = 0;
  for (const t of (res.tests ?? []).filter((t) => t.verdict !== "NOT_TESTED")) {
    n++;
    children.push(h(`5.${n} ${t.title} (${t.clause}) — ${t.verdict}`, HeadingLevel.HEADING_3));
    children.push(resultTable(t.headers, t.rows));
    children.push(p(t.summary, { size: 16, italics: true }));
    if (t.warnings.length) children.push(p(`Notes: ${t.warnings.join(" ")}`, { size: 16, color: "B45309" }));
  }
  if (res.integrityFlags?.length) {
    children.push(h("6. Integrity guard flags"));
    res.integrityFlags.forEach((f) => children.push(p(`• ${f}`, { size: 16 })));
  }
  if (r.remarks) {
    children.push(h("Remarks"));
    children.push(p(r.remarks));
  }

  const imgs = b.attachments.filter((a) => a.mimeType === "image/png" || a.mimeType === "image/jpeg");
  if (imgs.length) {
    children.push(h("Photographs"));
    const full = await db.select().from(attachments).where(inArray(attachments.id, imgs.map((x) => x.id)));
    for (const a of full) {
      try {
        children.push(
          new Paragraph({
            children: [new ImageRun({ type: a.mimeType === "image/png" ? "png" : "jpg", data: Buffer.from(a.dataBase64, "base64"), transformation: { width: 260, height: 195 }, altText: { title: a.fileName, description: a.caption ?? a.fileName, name: a.fileName } })],
          }),
        );
        children.push(p(a.caption || a.fileName, { size: 14, color: "64748B" }));
      } catch {
        /* skip */
      }
    }
  }

  children.push(
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ borders: { top: border, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, children: [p(`Tested by: ${b.tester?.name ?? "—"}`, { bold: true, size: 16 }), p(b.tester?.designation ?? "", { size: 14, color: "64748B" })] }),
            new TableCell({ borders: { top: border, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, children: [p(`Approved by: ${b.reviewer?.name ?? "—"}`, { bold: true, size: 16 }), p(b.reviewer?.designation ?? "", { size: 14, color: "64748B" }), ...(sig ? [p(`Digitally signed ${new Date(sig.signedAt).toLocaleString("en-IN")} · SHA-256 ${sig.hash}`, { size: 12, color: "047857" })] : [])] }),
          ],
        }),
      ],
    }),
    p(`Generated by SmartNAWI on ${new Date().toLocaleString("en-IN")}. This report relates only to the instrument tested.`, { size: 12, color: "94A3B8" }),
  );

  const doc = new Document({
    creator: "SmartNAWI",
    title: `Test Report ${r.reportNumber}`,
    styles: { default: { document: { run: { font: "Calibri", size: 18 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
