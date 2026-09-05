import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ReportBundle } from "@/lib/data";
import { checkClassification, type EvaluationOutput } from "@/lib/r76/engine";
import { specFromInstrument } from "@/lib/data";

const A4 = { w: 595.28, h: 841.89 };
const M = 40;

// pdf-lib standard fonts are WinAnsi – replace unsupported glyphs
function safe(s: unknown) {
  return String(s ?? "")
    .replace(/[↑]/g, "(up)")
    .replace(/[↓]/g, "(down)")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[—–]/g, "-")
    .replace(/[Δ]/g, "d")
    .replace(/[½]/g, "1/2")
    .replace(/[₀₁₂]/g, (c) => ({ "₀": "0", "₁": "1", "₂": "2" }[c] ?? ""))
    .replace(/[≈]/g, "~")
    .replace(/[×]/g, "x")
    .replace(/[∞]/g, "inf")
    .replace(/[✔✖⚠👻🔏]/g, "")
    .replace(/[^\x00-\xFF]/g, "?");
}

const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

class Writer {
  doc!: PDFDocument;
  page!: PDFPage;
  y = 0;
  font!: PDFFont;
  bold!: PDFFont;
  pageNo = 0;
  constructor(private title: string) {}
  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.pageNo++;
    this.y = A4.h - M;
    this.page.drawText(safe(this.title), { x: M, y: 18, size: 7, font: this.font, color: rgb(0.5, 0.5, 0.5) });
    this.page.drawText(`Page ${this.pageNo}`, { x: A4.w - M - 40, y: 18, size: 7, font: this.font, color: rgb(0.5, 0.5, 0.5) });
  }
  ensure(h: number) {
    if (this.y - h < M) this.newPage();
  }
  text(s: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number; gap?: number } = {}) {
    const size = opts.size ?? 9;
    const font = opts.bold ? this.bold : this.font;
    const maxW = A4.w - 2 * M - ((opts.x ?? M) - M);
    const lines = wrap(safe(s), font, size, maxW);
    for (const line of lines) {
      this.ensure(size + 4);
      this.page.drawText(line, { x: opts.x ?? M, y: this.y - size, size, font, color: opts.color ? rgb(...opts.color) : rgb(0.1, 0.1, 0.1) });
      this.y -= size + 3;
    }
    this.y -= opts.gap ?? 2;
  }
  heading(s: string) {
    this.y -= 6;
    this.ensure(20);
    this.page.drawRectangle({ x: M, y: this.y - 14, width: A4.w - 2 * M, height: 14, color: rgb(0.12, 0.2, 0.3) });
    this.page.drawText(safe(s), { x: M + 4, y: this.y - 10.5, size: 9, font: this.bold, color: rgb(1, 1, 1) });
    this.y -= 18;
  }
  kv(rows: [string, unknown][], cols = 2) {
    const colW = (A4.w - 2 * M) / cols;
    const perCol = Math.ceil(rows.length / cols);
    const startY = this.y;
    let maxDrop = 0;
    for (let c = 0; c < cols; c++) {
      this.y = startY;
      const x = M + c * colW;
      for (const [k, v] of rows.slice(c * perCol, (c + 1) * perCol)) {
        this.ensure(12);
        this.page.drawText(safe(k), { x, y: this.y - 8, size: 7.5, font: this.bold, color: rgb(0.35, 0.35, 0.35) });
        const lines = wrap(safe(v ?? "-"), this.font, 8, colW - 95);
        lines.forEach((l, i) => this.page.drawText(l, { x: x + 90, y: this.y - 8 - i * 9, size: 8, font: this.font }));
        this.y -= 9 * Math.max(1, lines.length) + 2;
      }
      maxDrop = Math.max(maxDrop, startY - this.y);
    }
    this.y = startY - maxDrop - 4;
  }
  table(headers: string[], rows: { cells: (string | number)[]; pass: boolean | null }[]) {
    const totalW = A4.w - 2 * M;
    const colW = totalW / headers.length;
    const size = 7;
    const rowH = 12;
    const drawHeader = () => {
      this.ensure(rowH);
      this.page.drawRectangle({ x: M, y: this.y - rowH, width: totalW, height: rowH, color: rgb(0.9, 0.92, 0.95) });
      headers.forEach((h, i) => this.page.drawText(trunc(safe(h), this.bold, size, colW - 4), { x: M + i * colW + 2, y: this.y - 8.5, size, font: this.bold }));
      this.y -= rowH;
    };
    drawHeader();
    for (const r of rows) {
      if (this.y - rowH < M) {
        this.newPage();
        drawHeader();
      }
      if (r.pass === false) this.page.drawRectangle({ x: M, y: this.y - rowH, width: totalW, height: rowH, color: rgb(1, 0.93, 0.93) });
      r.cells.forEach((c, i) => {
        const last = i === r.cells.length - 1;
        const color = last ? (r.pass === false ? rgb(0.75, 0.1, 0.1) : r.pass ? rgb(0.05, 0.5, 0.3) : rgb(0.4, 0.4, 0.4)) : rgb(0.1, 0.1, 0.1);
        this.page.drawText(trunc(safe(c), this.font, size, colW - 4), { x: M + i * colW + 2, y: this.y - 8.5, size, font: last ? this.bold : this.font, color });
      });
      this.page.drawLine({ start: { x: M, y: this.y - rowH }, end: { x: M + totalW, y: this.y - rowH }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
      this.y -= rowH;
    }
    this.y -= 4;
  }
}

function wrap(s: string, font: PDFFont, size: number, maxW: number) {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function trunc(s: string, font: PDFFont, size: number, maxW: number) {
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let t = s;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
  return t + "...";
}

export async function buildReportPdf(b: ReportBundle): Promise<Uint8Array> {
  const { report: r, instrument: i } = b;
  const res = r.results as EvaluationOutput;
  const cls = checkClassification(specFromInstrument(i), b.rule.config);
  const w = new Writer(`SmartNAWI - Test Report ${r.reportNumber} - ${b.rule.label}`);
  await w.init();

  // Header
  w.text("Government of India - Ministry of Consumer Affairs, Food & Public Distribution", { size: 7, color: [0.4, 0.4, 0.4] });
  w.text(r.labName, { size: 14, bold: true });
  w.text([r.labAddress, r.labAccreditation].filter(Boolean).join(" | "), { size: 8, color: [0.3, 0.3, 0.3] });
  w.y -= 4;
  w.page.drawLine({ start: { x: M, y: w.y }, end: { x: A4.w - M, y: w.y }, thickness: 1.2, color: rgb(0.12, 0.2, 0.3) });
  w.y -= 8;
  w.text(`TEST REPORT - NON-AUTOMATIC WEIGHING INSTRUMENT (${b.rule.label})`, { size: 11, bold: true });
  w.text(`Report No.: ${r.reportNumber}     Status: ${r.status.toUpperCase()}     Overall: ${r.overallVerdict}`, { size: 9, bold: true, color: r.overallVerdict === "PASS" ? [0.05, 0.5, 0.3] : r.overallVerdict === "FAIL" ? [0.75, 0.1, 0.1] : [0.7, 0.5, 0] });

  w.heading("1. Application & environmental conditions");
  w.kv([
    ["Purpose", r.purpose], ["Application ref.", r.applicationRef], ["Applicant", i.applicant], ["Applicant address", i.applicantAddress], ["Test period", `${fmtDate(r.startDate)} - ${fmtDate(r.endDate)}`], ["Test location", r.testLocation],
    ["Temperature", r.temperature != null ? `${r.temperature} °C` : null], ["Rel. humidity", r.humidity != null ? `${r.humidity} %` : null], ["Pressure", r.pressure != null ? `${r.pressure} hPa` : null], ["Reference standards", r.referenceStandards], ["Rule set", b.rule.label], ["Tested by", b.tester?.name],
  ]);

  w.heading("2. Instrument under test");
  w.kv([
    ["Manufacturer", i.manufacturer], ["Address", i.manufacturerAddress], ["Model / type", i.model], ["Serial number", i.serialNumber], ["Instrument type", i.instrumentType], ["Indication", i.indicationType], ["Software", i.softwareVersion], ["Power supply", i.powerSupply],
    ["Accuracy class", i.accuracyClass], ["Max", `${i.maxCapacity} ${i.unit}`], ["Min", `${i.minCapacity} ${i.unit}`], ["e", `${i.verificationInterval} ${i.unit}`], ["d", `${i.actualInterval} ${i.unit}`], ["n = Max/e", cls.n.toLocaleString()], ["Load cell / indicator", [i.loadCell, i.indicator].filter(Boolean).join(" / ")], ["Temperature range", `${i.tempRangeMin} °C to ${i.tempRangeMax} °C`],
  ]);
  w.text(cls.ok ? "Instrument classification conforms to R 76-1 Table 3." : cls.issues.join(" "), { size: 8, color: cls.ok ? [0.05, 0.5, 0.3] : [0.75, 0.1, 0.1] });

  w.heading("3. Summary of results");
  w.table(["#", "Test", "Clause", "Result"], (res.tests ?? []).map((t, idx) => ({ cells: [idx + 1, t.title, t.clause, t.verdict.replace("_", " ")], pass: t.verdict === "PASS" ? true : t.verdict === "FAIL" ? false : null })));
  w.text(`OVERALL: ${r.overallVerdict === "PASS" ? "COMPLIES with OIML R 76-1" : r.overallVerdict === "FAIL" ? "DOES NOT COMPLY with OIML R 76-1" : "EVALUATION INCOMPLETE"}`, { size: 11, bold: true, color: r.overallVerdict === "PASS" ? [0.05, 0.5, 0.3] : r.overallVerdict === "FAIL" ? [0.75, 0.1, 0.1] : [0.7, 0.5, 0] });

  w.heading("4. Detailed test results");
  let n = 0;
  for (const t of (res.tests ?? []).filter((t) => t.verdict !== "NOT_TESTED")) {
    n++;
    w.ensure(40);
    w.text(`4.${n} ${t.title} (${t.clause}) - ${t.verdict}`, { size: 9, bold: true });
    w.table(t.headers, t.rows);
    w.text(t.summary, { size: 7.5, color: [0.3, 0.3, 0.3] });
    if (t.warnings.length) w.text(`Notes: ${t.warnings.join(" ")}`, { size: 7.5, color: [0.7, 0.5, 0] });
  }
  if (res.integrityFlags?.length) {
    w.heading("5. Integrity guard flags");
    res.integrityFlags.forEach((f) => w.text(`- ${f}`, { size: 8 }));
  }
  if (r.remarks) {
    w.heading("Remarks");
    w.text(r.remarks, { size: 8.5 });
  }

  // Images
  const images = b.attachments.filter((a) => a.mimeType === "image/png" || a.mimeType === "image/jpeg");
  if (images.length) {
    w.heading("Photographs");
    const { attachments } = await import("@/db/schema");
    const { db } = await import("@/db");
    const { inArray } = await import("drizzle-orm");
    const full = await db.select().from(attachments).where(inArray(attachments.id, images.map((x) => x.id)));
    let x = M;
    const imgW = (A4.w - 2 * M - 20) / 3;
    w.ensure(imgW + 20);
    let rowTop = w.y;
    let col = 0;
    for (const a of full) {
      try {
        const bytes = Buffer.from(a.dataBase64, "base64");
        const img = a.mimeType === "image/png" ? await w.doc.embedPng(bytes) : await w.doc.embedJpg(bytes);
        const scale = Math.min(imgW / img.width, imgW / img.height);
        if (col === 3) {
          col = 0;
          x = M;
          w.y = rowTop - imgW - 18;
          w.ensure(imgW + 20);
          rowTop = w.y;
        }
        w.page.drawImage(img, { x, y: rowTop - img.height * scale, width: img.width * scale, height: img.height * scale });
        w.page.drawText(trunc(safe(a.caption || a.fileName), w.font, 7, imgW), { x, y: rowTop - imgW - 9, size: 7, font: w.font });
        x += imgW + 10;
        col++;
      } catch {
        /* skip bad image */
      }
    }
    w.y = rowTop - imgW - 20;
  }

  // Signatures
  w.y -= 10;
  w.ensure(70);
  const sig = r.signature as { signedBy: string; signedAt: string; hash: string } | null;
  const half = (A4.w - 2 * M) / 2;
  w.page.drawLine({ start: { x: M, y: w.y - 30 }, end: { x: M + half - 20, y: w.y - 30 }, thickness: 0.5 });
  w.page.drawLine({ start: { x: M + half, y: w.y - 30 }, end: { x: A4.w - M, y: w.y - 30 }, thickness: 0.5 });
  w.page.drawText(safe(`Tested by: ${b.tester?.name ?? "-"}`), { x: M, y: w.y - 42, size: 8, font: w.bold });
  w.page.drawText(safe(b.tester?.designation ?? ""), { x: M, y: w.y - 52, size: 7, font: w.font, color: rgb(0.4, 0.4, 0.4) });
  w.page.drawText(safe(`Approved by: ${b.reviewer?.name ?? "-"}`), { x: M + half, y: w.y - 42, size: 8, font: w.bold });
  w.page.drawText(safe(b.reviewer?.designation ?? ""), { x: M + half, y: w.y - 52, size: 7, font: w.font, color: rgb(0.4, 0.4, 0.4) });
  if (sig) w.page.drawText(safe(`Digitally signed ${new Date(sig.signedAt).toLocaleString("en-IN")} SHA-256 ${sig.hash.slice(0, 32)}...`), { x: M + half, y: w.y - 62, size: 6, font: w.font, color: rgb(0.05, 0.5, 0.3) });
  w.y -= 80;
  w.text(`Generated by SmartNAWI on ${new Date().toLocaleString("en-IN")}. This report relates only to the instrument tested.`, { size: 6.5, color: [0.5, 0.5, 0.5] });

  return w.doc.save();
}
