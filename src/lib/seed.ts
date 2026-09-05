import { db } from "@/db";
import { auditLogs, instruments, ruleSets, testReports, users } from "@/db/schema";
import { hashPassword } from "./auth";
import { DEFAULT_R76_RULES } from "./r76/rules";
import { evaluate, type TestData, type InstrumentSpec } from "./r76/engine";
import { sql } from "drizzle-orm";

let seeded = false;

export async function ensureSeed() {
  if (seeded) return;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if (Number(count) > 0) {
    seeded = true;
    return;
  }

  const [admin, tester, reviewer] = await db
    .insert(users)
    .values([
      { name: "Dr. A. K. Sharma", email: "admin@smartnawi.gov.in", passwordHash: hashPassword("admin123"), role: "admin", designation: "Director, Legal Metrology Lab" },
      { name: "Priya Nair", email: "tester@smartnawi.gov.in", passwordHash: hashPassword("tester123"), role: "tester", designation: "Scientific Officer (Testing)" },
      { name: "R. Venkatesh", email: "reviewer@smartnawi.gov.in", passwordHash: hashPassword("reviewer123"), role: "reviewer", designation: "Technical Reviewer / Approving Authority" },
    ])
    .returning();

  const [rs] = await db
    .insert(ruleSets)
    .values({
      code: DEFAULT_R76_RULES.code,
      version: DEFAULT_R76_RULES.version,
      title: DEFAULT_R76_RULES.title,
      active: true,
      config: DEFAULT_R76_RULES,
    })
    .returning();

  const inst = await db
    .insert(instruments)
    .values([
      {
        manufacturer: "Essae-Teraoka Pvt. Ltd.",
        manufacturerAddress: "Plot 44, Electronic City, Bengaluru 560100",
        applicant: "Essae-Teraoka Pvt. Ltd.",
        applicantAddress: "Plot 44, Electronic City, Bengaluru 560100",
        model: "DS-252",
        serialNumber: "ET-2025-014532",
        instrumentType: "Table Top / Counter Scale",
        accuracyClass: "III",
        unit: "kg",
        maxCapacity: 30,
        minCapacity: 0.2,
        verificationInterval: 0.01,
        actualInterval: 0.01,
        indicationType: "digital",
        powerSupply: "AC 230 V, 50 Hz / 6 V battery",
        loadCell: "Single point, aluminium, C3, 40 kg",
        indicator: "Integrated LED, 6 digits",
        softwareVersion: "v3.2.1 (checksum 7A3F)",
        tempRangeMin: -10,
        tempRangeMax: 40,
        description: "Electronic counter scale with semi-automatic zero-setting and semi-automatic tare device.",
        createdBy: tester.id,
      },
      {
        manufacturer: "Avery India Ltd.",
        manufacturerAddress: "Ballabhgarh, Faridabad, Haryana 121004",
        applicant: "Avery India Ltd.",
        applicantAddress: "Ballabhgarh, Faridabad, Haryana 121004",
        model: "PB-600",
        serialNumber: "AV-PB-88213",
        instrumentType: "Electronic Platform Scale",
        accuracyClass: "III",
        unit: "kg",
        maxCapacity: 600,
        minCapacity: 4,
        verificationInterval: 0.2,
        actualInterval: 0.2,
        indicationType: "digital",
        powerSupply: "AC 230 V, 50 Hz",
        loadCell: "4 × shear beam, alloy steel, C3, 250 kg",
        indicator: "Model IND-210, LCD",
        softwareVersion: "2.07",
        tempRangeMin: -10,
        tempRangeMax: 40,
        description: "Platform scale 800 × 800 mm with remote indicator.",
        createdBy: tester.id,
      },
      {
        manufacturer: "Sansui Electronics Pvt. Ltd.",
        manufacturerAddress: "MIDC Bhosari, Pune 411026",
        applicant: "Sansui Electronics Pvt. Ltd.",
        applicantAddress: "MIDC Bhosari, Pune 411026",
        model: "WB-60T",
        serialNumber: "SN-WB-2025-0071",
        instrumentType: "Weighbridge",
        accuracyClass: "III",
        unit: "kg",
        maxCapacity: 60000,
        minCapacity: 400,
        verificationInterval: 20,
        actualInterval: 20,
        indicationType: "digital",
        powerSupply: "AC 230 V, 50 Hz with UPS",
        loadCell: "8 × double-ended shear beam, 30 t, C3",
        indicator: "WI-500, LED",
        softwareVersion: "1.9.4",
        tempRangeMin: -10,
        tempRangeMax: 40,
        description: "Pit-less electronic weighbridge, 18 m × 3 m.",
        createdBy: tester.id,
      },
      {
        manufacturer: "Contech Instruments Ltd.",
        manufacturerAddress: "Navi Mumbai 400705",
        applicant: "Contech Instruments Ltd.",
        applicantAddress: "Navi Mumbai 400705",
        model: "CA-224",
        serialNumber: "CT-224-01987",
        instrumentType: "Precision Balance",
        accuracyClass: "II",
        unit: "g",
        maxCapacity: 220,
        minCapacity: 0.02,
        verificationInterval: 0.001,
        actualInterval: 0.0001,
        indicationType: "digital",
        powerSupply: "AC adaptor 12 V DC",
        loadCell: "Electromagnetic force compensation",
        indicator: "Integrated LCD",
        softwareVersion: "4.1",
        tempRangeMin: 10,
        tempRangeMax: 30,
        description: "Analytical balance with internal calibration.",
        createdBy: tester.id,
      },
    ])
    .returning();

  const specOf = (i: (typeof inst)[number]): InstrumentSpec => ({
    accuracyClass: i.accuracyClass as InstrumentSpec["accuracyClass"],
    unit: i.unit as "kg" | "g",
    max: i.maxCapacity,
    min: i.minCapacity,
    e: i.verificationInterval,
    d: i.actualInterval,
    indicationType: i.indicationType,
  });

  // Report 1: complete PASS on DS-252
  const data1: TestData = {
    weighing: {
      applicable: true,
      method: "simple",
      zeroError: 0,
      rows: [
        { load: 0.2, indUp: 0.2, indDown: 0.2 },
        { load: 2, indUp: 2, indDown: 2 },
        { load: 5, indUp: 5, indDown: 5 },
        { load: 10, indUp: 10, indDown: 10 },
        { load: 15, indUp: 15.01, indDown: 15.01 },
        { load: 20, indUp: 20.01, indDown: 20.01 },
        { load: 25, indUp: 25.01, indDown: 25.01 },
        { load: 30, indUp: 30.01, indDown: 30.01 },
      ],
    },
    repeatability: {
      applicable: true,
      series: [
        { load: 15, readings: [15, 15.01, 15, 15, 15.01, 15, 15, 15.01, 15, 15] },
        { load: 30, readings: [30.01, 30.01, 30.02, 30.01, 30.01, 30.01, 30.02, 30.01, 30.01, 30.01] },
      ],
    },
    eccentricity: {
      applicable: true,
      load: 10,
      positions: [
        { position: 1, indication: 10 },
        { position: 2, indication: 10.01 },
        { position: 3, indication: 10 },
        { position: 4, indication: 9.99 },
        { position: 5, indication: 10 },
      ],
    },
    tare: { applicable: true, tareLoad: 5, rows: [{ load: 2, indication: 2 }, { load: 10, indication: 10.01 }, { load: 20, indication: 20.01 }] },
    discrimination: { applicable: true, rows: [{ load: 0.2, indication: 0.2, indicationAfter: 0.21 }, { load: 15, indication: 15, indicationAfter: 15.01 }, { load: 30, indication: 30, indicationAfter: 30.01 }] },
    zeroSetting: { applicable: true, initialRange: 3.2, semiAutoRange: 0.9, zeroAccuracy: 0.002 },
    warmup: { applicable: true, load: 30, rows: [{ minute: 0, zeroInd: 0, indication: 30.01 }, { minute: 5, zeroInd: 0, indication: 30.01 }, { minute: 15, zeroInd: 0, indication: 30 }, { minute: 30, zeroInd: 0, indication: 30 }] },
    temperature: {
      applicable: true,
      rows: [
        { temp: 20, load: 30, zeroInd: 0, indication: 30 },
        { temp: 40, load: 30, zeroInd: 0.01, indication: 30.02 },
        { temp: -10, load: 30, zeroInd: -0.01, indication: 29.98 },
        { temp: 5, load: 30, zeroInd: 0, indication: 29.99 },
        { temp: 20, load: 30, zeroInd: 0, indication: 30 },
      ],
    },
    voltage: { applicable: true, nominal: 230, rows: [{ voltage: 195.5, load: 30, indication: 30.01 }, { voltage: 230, load: 30, indication: 30 }, { voltage: 253, load: 30, indication: 30.01 }] },
    spanStability: {
      applicable: true,
      load: 30,
      rows: ["2025-11-03", "2025-11-06", "2025-11-10", "2025-11-13", "2025-11-17", "2025-11-20", "2025-11-24", "2025-11-28"].map((d) => ({ date: d, indication: 30.01 })),
    },
    dampHeat: { applicable: true, rows: [{ condition: "Before (20 °C / 50 %RH)", load: 30, indication: 30 }, { condition: "During (40 °C / 85 %RH)", load: 30, indication: 30.01 }, { condition: "After recovery", load: 30, indication: 30 }] },
  };

  // Report 2: FAIL on PB-600 (eccentricity fail)
  const data2: TestData = {
    weighing: {
      applicable: true,
      method: "changeover",
      zeroError: 0,
      rows: [
        { load: 4, indUp: 4, dLUp: 0.1, indDown: 4, dLDown: 0.1 },
        { load: 50, indUp: 50, dLUp: 0.08, indDown: 50, dLDown: 0.1 },
        { load: 100, indUp: 100, dLUp: 0.06, indDown: 100.2, dLDown: 0.16 },
        { load: 200, indUp: 200.2, dLUp: 0.14, indDown: 200.2, dLDown: 0.12 },
        { load: 400, indUp: 400.2, dLUp: 0.1, indDown: 400.2, dLDown: 0.1 },
        { load: 600, indUp: 600.2, dLUp: 0.08, indDown: 600.2, dLDown: 0.08 },
      ],
    },
    repeatability: {
      applicable: true,
      series: [
        { load: 300, readings: [300, 300.2, 300, 300, 300.2, 300, 300.2, 300, 300, 300] },
        { load: 600, readings: [600.2, 600.2, 600.4, 600.2, 600.2, 600.2, 600.2, 600.4, 600.2, 600.2] },
      ],
    },
    eccentricity: {
      applicable: true,
      load: 200,
      positions: [
        { position: 1, indication: 200, dL: 0.1 },
        { position: 2, indication: 200.2, dL: 0.1 },
        { position: 3, indication: 200.6, dL: 0.1 },
        { position: 4, indication: 199.8, dL: 0.1 },
        { position: 5, indication: 200.2, dL: 0.1 },
      ],
    },
    tare: { applicable: true, tareLoad: 100, rows: [{ load: 50, indication: 50, dL: 0.1 }, { load: 200, indication: 200.2, dL: 0.1 }] },
    discrimination: { applicable: true, rows: [{ load: 4, indication: 4, indicationAfter: 4.2 }, { load: 300, indication: 300, indicationAfter: 300.2 }, { load: 600, indication: 600.2, indicationAfter: 600.4 }] },
    zeroSetting: { applicable: true, initialRange: 80, semiAutoRange: 20, zeroAccuracy: 0.04 },
  };

  // Report 3: in progress on WB-60T
  const data3: TestData = {
    weighing: {
      applicable: true,
      method: "simple",
      zeroError: 0,
      rows: [
        { load: 400, indUp: 400, indDown: 400 },
        { load: 10000, indUp: 10000, indDown: 10000 },
        { load: 20000, indUp: 20020, indDown: 20020 },
        { load: 40000, indUp: 40020, indDown: null },
      ],
    },
    repeatability: { applicable: true, series: [{ load: 30000, readings: [30020, 30000, 30020] }] },
  };

  const mk = async (opts: {
    inst: (typeof inst)[number];
    number: string;
    status: string;
    data: TestData;
    start: string;
    end?: string;
    reviewed?: boolean;
    remarks?: string;
  }) => {
    const spec = specOf(opts.inst);
    const results = evaluate(opts.data, spec, DEFAULT_R76_RULES);
    const [r] = await db
      .insert(testReports)
      .values({
        reportNumber: opts.number,
        instrumentId: opts.inst.id,
        ruleSetId: rs.id,
        status: opts.status,
        applicationRef: `DoCA/LM/MA/2025/${opts.inst.id.toString().padStart(3, "0")}`,
        labName: "Regional Reference Standards Laboratory (RRSL)",
        labAddress: "Ministry of Consumer Affairs, Food & Public Distribution, Bengaluru 560058",
        labAccreditation: "NABL Accredited – ISO/IEC 17025:2017",
        testLocation: "Mass Metrology Lab, Bay 2",
        temperature: 22.4,
        humidity: 52,
        pressure: 912,
        referenceStandards: "F1 & M1 class standard weights, 1 mg – 1000 kg, traceable to NPL India; Climatic chamber CC-1200",
        startDate: new Date(opts.start),
        endDate: opts.end ? new Date(opts.end) : null,
        testedById: tester.id,
        reviewedById: opts.reviewed ? reviewer.id : null,
        testData: opts.data,
        results,
        overallVerdict: results.overall,
        remarks: opts.remarks,
        createdBy: tester.id,
        signature: opts.status === "approved" ? { signedBy: reviewer.name, signedAt: new Date().toISOString(), hash: "seeded-demo-signature" } : null,
      })
      .returning();
    await db.insert(auditLogs).values([
      { reportId: r.id, userId: tester.id, action: "created", details: `Report ${opts.number} created` },
      { reportId: r.id, userId: tester.id, action: "observations_saved", details: "Test observations recorded and evaluated" },
      ...(opts.status === "under_review" || opts.status === "approved" ? [{ reportId: r.id, userId: tester.id, action: "submitted", details: "Submitted for review" }] : []),
      ...(opts.status === "approved" ? [{ reportId: r.id, userId: reviewer.id, action: "approved", details: "Report approved and digitally signed" }] : []),
    ]);
    return r;
  };

  await mk({ inst: inst[0], number: "RRSL/NAWI/2025/0041", status: "approved", data: data1, start: "2025-11-03", end: "2025-11-28", reviewed: true, remarks: "Instrument complies with all applicable requirements of OIML R 76-1 for class III." });
  await mk({ inst: inst[1], number: "RRSL/NAWI/2025/0047", status: "under_review", data: data2, start: "2025-12-01", end: "2025-12-09", remarks: "Eccentricity at position 3 (0.6 kg vs MPE 0.2 kg) and decreasing-load error at 100 kg exceed MPE; manufacturer informed. Corrective action required before re-submission." });
  await mk({ inst: inst[2], number: "RRSL/NAWI/2026/0003", status: "in_progress", data: data3, start: "2026-01-12" });
  await mk({ inst: inst[3], number: "RRSL/NAWI/2026/0005", status: "draft", data: {}, start: "2026-01-20" });

  void admin;
  seeded = true;
}
