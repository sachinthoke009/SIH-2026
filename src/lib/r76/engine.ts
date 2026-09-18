import { AccuracyClass, R76RuleConfig } from "./rules";

/* ---------------------------------------------------------------- types */

export interface InstrumentSpec {
  accuracyClass: AccuracyClass;
  unit: "kg" | "g";
  max: number;
  min: number;
  e: number;
  d: number;
  indicationType: string;
}

export type Verdict = "PASS" | "FAIL" | "INCOMPLETE" | "NOT_TESTED";

export interface ResultRow {
  cells: (string | number)[];
  pass: boolean | null;
}

export interface TestResult {
  testId: string;
  title: string;
  clause: string;
  verdict: Verdict;
  headers: string[];
  rows: ResultRow[];
  summary: string;
  warnings: string[];
  integrityFlags: string[];
}

export interface WeighingRow {
  load: number;
  indUp: number | null;
  dLUp?: number | null;
  indDown: number | null;
  dLDown?: number | null;
}

export interface TestData {
  weighing?: { applicable: boolean; method: "simple" | "changeover"; zeroError: number; rows: WeighingRow[]; remarks?: string };
  repeatability?: { applicable: boolean; series: { load: number; readings: (number | null)[] }[]; remarks?: string };
  eccentricity?: { applicable: boolean; load: number; positions: { position: number; indication: number | null; dL?: number | null }[]; remarks?: string };
  tare?: { applicable: boolean; tareLoad: number; rows: { load: number; indication: number | null; dL?: number | null }[]; remarks?: string };
  discrimination?: { applicable: boolean; rows: { load: number; indication: number | null; indicationAfter: number | null }[]; remarks?: string };
  zeroSetting?: { applicable: boolean; initialRange: number | null; semiAutoRange: number | null; zeroAccuracy: number | null; remarks?: string };
  warmup?: { applicable: boolean; load: number; rows: { minute: number; zeroInd: number | null; indication: number | null }[]; remarks?: string };
  temperature?: { applicable: boolean; rows: { temp: number; load: number; indication: number | null; zeroInd: number | null }[]; remarks?: string };
  voltage?: { applicable: boolean; nominal: number; rows: { voltage: number; load: number; indication: number | null }[]; remarks?: string };
  spanStability?: { applicable: boolean; load: number; rows: { date: string; indication: number | null }[]; remarks?: string };
  dampHeat?: { applicable: boolean; rows: { condition: string; load: number; indication: number | null }[]; remarks?: string };
}

export interface EvaluationOutput {
  tests: TestResult[];
  overall: Verdict;
  integrityFlags: string[];
  summary: { passed: number; failed: number; incomplete: number; notTested: number };
}

/* ------------------------------------------------------------- helpers */

const toGrams = (v: number, unit: "kg" | "g") => (unit === "kg" ? v * 1000 : v);

export function decimalsFor(step: number) {
  if (!isFinite(step) || step <= 0) return 3;
  const s = step.toString();
  if (s.includes("e-")) return parseInt(s.split("e-")[1], 10);
  const idx = s.indexOf(".");
  return idx === -1 ? 0 : s.length - idx - 1;
}

export function fmt(v: number | null | undefined, spec: InstrumentSpec, extra = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const dec = Math.min(decimalsFor(spec.d) + extra, 6);
  return Number(v.toFixed(dec)).toString();
}

const round = (v: number, dec = 6) => Number(v.toFixed(dec));

/** MPE (absolute, in instrument unit) for a load m at initial verification / type approval */
export function mpeFor(load: number, spec: InstrumentSpec, rules: R76RuleConfig): { mult: number; value: number } {
  const m = load / spec.e;
  for (const band of rules.mpeBands) {
    const limit = band.upTo[spec.accuracyClass];
    if (limit === null || m <= limit + 1e-9) {
      return { mult: band.mult, value: round(band.mult * spec.e) };
    }
  }
  const last = rules.mpeBands[rules.mpeBands.length - 1];
  return { mult: last.mult, value: round(last.mult * spec.e) };
}

/**
 * Error of indication.
 * Changeover point method (R76-2 A.4.4.3): E = I + ½d − ΔL − L
 * Simple method: E = I − L
 */
export function errorOf(load: number, indication: number, dL: number | null | undefined, spec: InstrumentSpec, method: "simple" | "changeover") {
  if (method === "changeover") {
    return round(indication + spec.d / 2 - (dL ?? 0) - load);
  }
  return round(indication - load);
}

/* ------------------------------------------- instrument classification */

export interface ClassCheck {
  ok: boolean;
  n: number;
  issues: string[];
  notes: string[];
  minCapRequired: number;
}

export function checkClassification(spec: InstrumentSpec, rules: R76RuleConfig): ClassCheck {
  const issues: string[] = [];
  const notes: string[] = [];
  const n = spec.e > 0 ? Math.round(spec.max / spec.e) : 0;
  const eG = toGrams(spec.e, spec.unit);
  const bands = rules.classes[spec.accuracyClass] ?? [];
  const band = bands.find((b) => eG >= b.eMinG - 1e-12 && (b.eMaxG === null || eG <= b.eMaxG + 1e-12));
  let minCapRequired = 0;
  if (!band) {
    issues.push(`Verification scale interval e = ${spec.e} ${spec.unit} is outside the permitted range for class ${spec.accuracyClass} (Table 3).`);
  } else {
    if (n < band.nMin) issues.push(`n = Max/e = ${n} is below the minimum ${band.nMin} for class ${spec.accuracyClass}.`);
    if (band.nMax !== null && n > band.nMax) issues.push(`n = Max/e = ${n} exceeds the maximum ${band.nMax} for class ${spec.accuracyClass}.`);
    minCapRequired = round(band.minCapMultiple * spec.e);
    if (spec.min < minCapRequired - 1e-9) issues.push(`Min = ${spec.min} ${spec.unit} is below the lower limit ${minCapRequired} ${spec.unit} (${band.minCapMultiple} e) for class ${spec.accuracyClass}.`);
    notes.push(`Class ${spec.accuracyClass}: ${band.nMin} ≤ n ≤ ${band.nMax ?? "∞"}, Min ≥ ${band.minCapMultiple} e.`);
  }
  if (spec.d > spec.e + 1e-12) issues.push("Actual scale interval d must not exceed the verification scale interval e.");
  if (spec.e > 0 && spec.d > 0) {
    const ratio = spec.e / spec.d;
    const allowed = [1, 2, 5, 10];
    if (!allowed.some((a) => Math.abs(ratio - a) < 1e-6)) notes.push(`e/d = ${round(ratio, 3)} – for digital instruments e = d unless an auxiliary indicating device is used (e = 1, 2, 5 or 10 × d).`);
  }
  if (!Number.isInteger(round(n, 6))) issues.push("Max must be an integer multiple of e.");
  notes.push(`n = Max / e = ${n} verification scale intervals.`);
  return { ok: issues.length === 0, n, issues, notes, minCapRequired };
}

/* ------------------------------------------------------------ evaluate */

const nil = (v: unknown): v is null | undefined => v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));

function verdictFrom(rows: ResultRow[], warnings: string[], haveData: boolean): Verdict {
  if (!haveData) return "INCOMPLETE";
  if (rows.some((r) => r.pass === false)) return "FAIL";
  if (rows.some((r) => r.pass === null)) return "INCOMPLETE";
  return "PASS";
}

function pf(p: boolean | null) {
  return p === null ? "—" : p ? "PASS" : "FAIL";
}

export function evaluate(data: TestData, spec: InstrumentSpec, rules: R76RuleConfig): EvaluationOutput {
  const tests: TestResult[] = [];
  const u = spec.unit;
  const f = (v: number | null | undefined) => fmt(v, spec);

  /* 1. Weighing performance */
  {
    const t = data.weighing;
    const headers = [`Load (${u})`, "Indication ↑", "ΔL ↑", "Error ↑", "Indication ↓", "ΔL ↓", "Error ↓", `MPE (±${u})`, "Result"];
    const rows: ResultRow[] = [];
    const warnings: string[] = [];
    const integrity: string[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const method = t.method ?? "simple";
      const E0 = t.zeroError ?? 0;
      const errs: number[] = [];
      for (const r of t.rows ?? []) {
        if (nil(r.load)) continue;
        const mpe = mpeFor(r.load, spec, rules);
        const eUp = nil(r.indUp) ? null : errorOf(r.load, r.indUp as number, r.dLUp, spec, method) - E0;
        const eDn = nil(r.indDown) ? null : errorOf(r.load, r.indDown as number, r.dLDown, spec, method) - E0;
        if (eUp !== null) errs.push(eUp);
        if (eDn !== null) errs.push(eDn);
        const passUp = eUp === null ? null : Math.abs(eUp) <= mpe.value + 1e-9;
        const passDn = eDn === null ? null : Math.abs(eDn) <= mpe.value + 1e-9;
        const pass = passUp === null || passDn === null ? (passUp === false || passDn === false ? false : null) : passUp && passDn;
        rows.push({
          cells: [f(r.load), f(r.indUp), method === "changeover" ? f(r.dLUp) : "n/a", f(eUp), f(r.indDown), method === "changeover" ? f(r.dLDown) : "n/a", f(eDn), `${mpe.mult} e = ${f(mpe.value)}`, pf(pass)],
          pass,
        });
      }
      const loads = (t.rows ?? []).map((r) => r.load).filter((l) => !nil(l));
      if (loads.length < rules.weighing.minLoads) warnings.push(`At least ${rules.weighing.minLoads} test loads are required (${loads.length} entered).`);
      if (rules.weighing.requireMax && !loads.some((l) => Math.abs(l - spec.max) < spec.e)) warnings.push("Test loads should include Max.");
      if (rules.weighing.requireMin && !loads.some((l) => Math.abs(l - spec.min) < spec.e)) warnings.push("Test loads should include Min.");
      if (loads.some((l) => l > spec.max + 1e-9)) warnings.push("A test load exceeds Max – check entry.");
      if (errs.length >= 6 && errs.every((e) => e === 0)) integrity.push("All weighing errors are exactly zero – unusually perfect data, flagged for reviewer attention.");
      verdict = verdictFrom(rows, warnings, rows.length > 0);
      const worst = errs.length ? Math.max(...errs.map(Math.abs)) : 0;
      summary = rows.length ? `Errors evaluated at ${rows.length} loads (${method === "changeover" ? "changeover-point method, E = I + ½d − ΔL − L" : "E = I − L"}); largest |error| = ${f(worst)} ${u}. ${verdict === "PASS" ? "All errors within MPE (Table 6)." : verdict === "FAIL" ? "One or more errors exceed MPE." : "Observations incomplete."}` : "No observations entered.";
    }
    tests.push({ testId: "weighing", title: "Weighing performance (accuracy)", clause: rules.weighing.clause, verdict, headers, rows, summary, warnings, integrityFlags: integrity });
  }

  /* 2. Repeatability */
  {
    const t = data.repeatability;
    const headers = [`Load (${u})`, "n", "Readings", "Max − Min", `|MPE| (${u})`, "Result"];
    const rows: ResultRow[] = [];
    const warnings: string[] = [];
    const integrity: string[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const required = spec.max <= toGramsInv(100, spec.unit) ? rules.repeatability.weighingsIfMaxLe100kg : rules.repeatability.weighingsIfMaxGt100kg;
      for (const s of t.series ?? []) {
        const vals = (s.readings ?? []).filter((v): v is number => !nil(v));
        const mpe = mpeFor(s.load, spec, rules);
        if (vals.length === 0) {
          rows.push({ cells: [f(s.load), 0, "—", "—", f(mpe.value), "—"], pass: null });
          continue;
        }
        const spread = round(Math.max(...vals) - Math.min(...vals));
        const pass = spread <= mpe.value + 1e-9;
        if (vals.length < required) warnings.push(`Load ${f(s.load)} ${u}: ${required} weighings required (Max ${spec.max <= toGramsInv(100, spec.unit) ? "≤" : ">"} 100 kg), ${vals.length} entered.`);
        if (vals.length >= 5 && new Set(vals).size === 1) integrity.push(`Repeatability at ${f(s.load)} ${u}: all ${vals.length} readings identical – flagged for review.`);
        rows.push({ cells: [f(s.load), vals.length, vals.map((v) => f(v)).join(", "), f(spread), f(mpe.value), pf(pass)], pass });
      }
      if ((t.series ?? []).length < rules.repeatability.seriesRequired) warnings.push(`${rules.repeatability.seriesRequired} series (≈50 % Max and ≈Max) are required.`);
      verdict = verdictFrom(rows, warnings, rows.length > 0);
      summary = rows.length ? `Difference between results of repeated weighings compared with |MPE| for each load. ${verdict === "PASS" ? "Within limits." : verdict === "FAIL" ? "Spread exceeds MPE." : "Incomplete."}` : "No observations entered.";
    }
    tests.push({ testId: "repeatability", title: "Repeatability", clause: rules.repeatability.clause, verdict, headers, rows, summary, warnings, integrityFlags: integrity });
  }

  /* 3. Eccentricity */
  {
    const t = data.eccentricity;
    const headers = ["Position", `Load (${u})`, "Indication", "ΔL", `Error (${u})`, `MPE (±${u})`, "Result"];
    const rows: ResultRow[] = [];
    const warnings: string[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const mpe = mpeFor(t.load, spec, rules);
      const target = spec.max * rules.eccentricity.loadFraction;
      if (Math.abs(t.load - target) > target * 0.15) warnings.push(`Test load should be ≈ ${f(target)} ${u} (Max × ${round(rules.eccentricity.loadFraction, 3)}).`);
      const method = data.weighing?.method ?? "simple";
      for (const p of t.positions ?? []) {
        const err = nil(p.indication) ? null : errorOf(t.load, p.indication as number, p.dL, spec, method);
        const pass = err === null ? null : Math.abs(err) <= mpe.value + 1e-9;
        rows.push({ cells: [p.position === 1 ? "1 (centre)" : String(p.position), f(t.load), f(p.indication), method === "changeover" ? f(p.dL) : "n/a", f(err), f(mpe.value), pf(pass)], pass });
      }
      if (rows.length < rules.eccentricity.minPositions) warnings.push(`At least ${rules.eccentricity.minPositions} load positions required.`);
      verdict = verdictFrom(rows, warnings, rows.length > 0);
      summary = rows.length ? `Load of ${f(t.load)} ${u} applied at ${rows.length} positions; each error compared with MPE ${f(mpe.value)} ${u}. ${verdict}.` : "No observations entered.";
    }
    tests.push({ testId: "eccentricity", title: "Eccentric loading", clause: rules.eccentricity.clause, verdict, headers, rows, summary, warnings, integrityFlags: [] });
  }

  /* 4. Tare */
  {
    const t = data.tare;
    const headers = [`Tare (${u})`, `Net load (${u})`, "Indication", "ΔL", `Error (${u})`, `MPE (±${u})`, "Result"];
    const rows: ResultRow[] = [];
    const warnings: string[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const method = data.weighing?.method ?? "simple";
      for (const r of t.rows ?? []) {
        if (nil(r.load)) continue;
        const mpe = mpeFor(r.load, spec, rules);
        const err = nil(r.indication) ? null : errorOf(r.load, r.indication as number, r.dL, spec, method);
        const pass = err === null ? null : Math.abs(err) <= mpe.value + 1e-9;
        if (r.load + t.tareLoad > spec.max + 1e-9) warnings.push(`Tare + net (${f(r.load + t.tareLoad)}) exceeds Max.`);
        rows.push({ cells: [f(t.tareLoad), f(r.load), f(r.indication), method === "changeover" ? f(r.dL) : "n/a", f(err), f(mpe.value), pf(pass)], pass });
      }
      verdict = verdictFrom(rows, warnings, rows.length > 0);
      summary = rows.length ? `Weighing test with tare of ${f(t.tareLoad)} ${u}; MPE applied to net load. ${verdict}.` : "No observations entered.";
    }
    tests.push({ testId: "tare", title: "Tare weighing test", clause: rules.tare.clause, verdict, headers, rows, summary, warnings, integrityFlags: [] });
  }

  /* 5. Discrimination */
  {
    const t = data.discrimination;
    const extra = round(rules.discrimination.extraLoadInD * spec.d);
    const headers = [`Load (${u})`, "Indication I₁", `Extra load (${rules.discrimination.extraLoadInD} d = ${f(extra)})`, "Indication I₂", "Change (d)", "Required (d)", "Result"];
    const rows: ResultRow[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      for (const r of t.rows ?? []) {
        if (nil(r.load)) continue;
        const change = nil(r.indication) || nil(r.indicationAfter) ? null : round(((r.indicationAfter as number) - (r.indication as number)) / spec.d, 3);
        const pass = change === null ? null : change >= rules.discrimination.requiredChangeInD - 1e-9;
        rows.push({ cells: [f(r.load), f(r.indication), f(extra), f(r.indicationAfter), change ?? "—", rules.discrimination.requiredChangeInD, pf(pass)], pass });
      }
      verdict = verdictFrom(rows, [], rows.length > 0);
      summary = rows.length ? `Adding ${rules.discrimination.extraLoadInD} d to the load must change the indication by ≥ ${rules.discrimination.requiredChangeInD} d. ${verdict}.` : "No observations entered.";
    }
    tests.push({ testId: "discrimination", title: "Discrimination (digital)", clause: rules.discrimination.clause, verdict, headers, rows, summary, warnings: [], integrityFlags: [] });
  }

  /* 6. Zero-setting */
  {
    const t = data.zeroSetting;
    const headers = ["Parameter", "Observed", "Limit", "Result"];
    const rows: ResultRow[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const initLimit = round((rules.zeroSetting.initialRangePct / 100) * spec.max);
      const semiLimit = round((rules.zeroSetting.semiAutoRangePct / 100) * spec.max);
      const accLimit = round(rules.zeroSetting.accuracyE * spec.e);
      const p1 = nil(t.initialRange) ? null : (t.initialRange as number) <= initLimit + 1e-9;
      const p2 = nil(t.semiAutoRange) ? null : (t.semiAutoRange as number) <= semiLimit + 1e-9;
      const p3 = nil(t.zeroAccuracy) ? null : Math.abs(t.zeroAccuracy as number) <= accLimit + 1e-9;
      rows.push({ cells: ["Initial zero-setting range", `${f(t.initialRange)} ${u}`, `≤ ${rules.zeroSetting.initialRangePct} % Max = ${f(initLimit)} ${u}`, pf(p1)], pass: p1 });
      rows.push({ cells: ["Semi-automatic / non-automatic zero-setting range", `${f(t.semiAutoRange)} ${u}`, `≤ ${rules.zeroSetting.semiAutoRangePct} % Max = ${f(semiLimit)} ${u}`, pf(p2)], pass: p2 });
      rows.push({ cells: ["Accuracy of zero-setting", `${f(t.zeroAccuracy)} ${u}`, `≤ ±${rules.zeroSetting.accuracyE} e = ±${f(accLimit)} ${u}`, pf(p3)], pass: p3 });
      verdict = verdictFrom(rows, [], true);
      summary = `Zero-setting range and accuracy checked against R 76-1 limits. ${verdict}.`;
    }
    tests.push({ testId: "zeroSetting", title: "Zero-setting devices", clause: rules.zeroSetting.clause, verdict, headers, rows, summary, warnings: [], integrityFlags: [] });
  }

  /* 7. Warm-up */
  {
    const t = data.warmup;
    const headers = ["Time (min)", "Zero indication", `Indication at ${u}`, `Error (${u})`, `MPE (±${u})`, "Result"];
    const rows: ResultRow[] = [];
    const warnings: string[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const mpe = mpeFor(t.load, spec, rules);
      for (const r of t.rows ?? []) {
        const err = nil(r.indication) ? null : round((r.indication as number) - (r.zeroInd ?? 0) - t.load);
        const pass = err === null ? null : Math.abs(err) <= mpe.value + 1e-9;
        rows.push({ cells: [r.minute, f(r.zeroInd), `${f(r.indication)} @ ${f(t.load)}`, f(err), f(mpe.value), pf(pass)], pass });
      }
      const minutes = (t.rows ?? []).map((r) => r.minute);
      for (const c of rules.warmup.checkpointsMin) if (!minutes.includes(c)) warnings.push(`Checkpoint at ${c} min missing.`);
      verdict = verdictFrom(rows, warnings, rows.length > 0);
      summary = rows.length ? `Errors at load ${f(t.load)} ${u} after switch-on must remain within MPE at every checkpoint. ${verdict}.` : "No observations entered.";
    }
    tests.push({ testId: "warmup", title: "Warm-up time", clause: rules.warmup.clause, verdict, headers, rows, summary, warnings, integrityFlags: [] });
  }

  /* 8. Temperature */
  {
    const t = data.temperature;
    const headers = ["Temp (°C)", `Load (${u})`, "Zero ind.", "Indication", `Error (${u})`, `MPE (±${u})`, "Result"];
    const rows: ResultRow[] = [];
    const warnings: string[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const zeroByTemp: { temp: number; zero: number }[] = [];
      for (const r of t.rows ?? []) {
        if (nil(r.load)) continue;
        const mpe = mpeFor(r.load, spec, rules);
        const err = nil(r.indication) ? null : round((r.indication as number) - (r.zeroInd ?? 0) - r.load);
        const pass = err === null ? null : Math.abs(err) <= mpe.value + 1e-9;
        if (!nil(r.zeroInd)) zeroByTemp.push({ temp: r.temp, zero: r.zeroInd as number });
        rows.push({ cells: [r.temp, f(r.load), f(r.zeroInd), f(r.indication), f(err), f(mpe.value), pf(pass)], pass });
      }
      // zero drift: 1 e per 5 °C
      const limitPer5 = rules.temperature.zeroDriftEPer5Deg[spec.accuracyClass] * spec.e;
      for (let i = 1; i < zeroByTemp.length; i++) {
        const a = zeroByTemp[i - 1], b = zeroByTemp[i];
        const dT = Math.abs(b.temp - a.temp);
        if (dT >= 5) {
          const drift = Math.abs(b.zero - a.zero);
          const allowed = round((dT / 5) * limitPer5);
          const pass = drift <= allowed + 1e-9;
          rows.push({ cells: [`${a.temp}→${b.temp}`, "zero drift", f(a.zero), f(b.zero), f(drift), `${f(allowed)} (1 e / 5 °C)`, pf(pass)], pass });
        }
      }
      verdict = verdictFrom(rows, warnings, rows.length > 0);
      summary = rows.length ? `Static temperature test: errors within MPE at each temperature; zero drift ≤ 1 e per 5 °C. ${verdict}.` : "No observations entered.";
    }
    tests.push({ testId: "temperature", title: "Static temperatures", clause: rules.temperature.clause, verdict, headers, rows, summary, warnings, integrityFlags: [] });
  }

  /* 9. Voltage variation */
  {
    const t = data.voltage;
    const headers = ["Voltage (V)", "% of nominal", `Load (${u})`, "Indication", `Error (${u})`, `MPE (±${u})`, "Result"];
    const rows: ResultRow[] = [];
    const warnings: string[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const nominal = t.nominal || 230;
      const pcts = new Set<number>();
      for (const r of t.rows ?? []) {
        if (nil(r.load)) continue;
        const mpe = mpeFor(r.load, spec, rules);
        const pct = round(((r.voltage - nominal) / nominal) * 100, 1);
        pcts.add(pct);
        const err = nil(r.indication) ? null : round((r.indication as number) - r.load);
        const pass = err === null ? null : Math.abs(err) <= mpe.value + 1e-9;
        rows.push({ cells: [r.voltage, `${pct > 0 ? "+" : ""}${pct} %`, f(r.load), f(r.indication), f(err), f(mpe.value), pf(pass)], pass });
      }
      if (![...pcts].some((p) => p <= rules.voltage.lowPct + 0.5)) warnings.push(`Lower limit ${rules.voltage.lowPct} % of nominal (${round(nominal * (1 + rules.voltage.lowPct / 100), 1)} V) not tested.`);
      if (![...pcts].some((p) => p >= rules.voltage.highPct - 0.5)) warnings.push(`Upper limit +${rules.voltage.highPct} % of nominal (${round(nominal * (1 + rules.voltage.highPct / 100), 1)} V) not tested.`);
      verdict = verdictFrom(rows, warnings, rows.length > 0);
      summary = rows.length ? `Mains voltage varied between ${rules.voltage.lowPct} % and +${rules.voltage.highPct} % of ${nominal} V; errors within MPE. ${verdict}.` : "No observations entered.";
    }
    tests.push({ testId: "voltage", title: "Voltage variations", clause: rules.voltage.clause, verdict, headers, rows, summary, warnings, integrityFlags: [] });
  }

  /* 10. Span stability */
  {
    const t = data.spanStability;
    const headers = ["Date", `Load (${u})`, "Indication", `Error (${u})`, "Deviation from mean", `Limit (${rules.spanStability.mpeFraction} |MPE|)`, "Result"];
    const rows: ResultRow[] = [];
    const warnings: string[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      const mpe = mpeFor(t.load, spec, rules);
      const limit = round(rules.spanStability.mpeFraction * mpe.value);
      const errs = (t.rows ?? []).filter((r) => !nil(r.indication)).map((r) => round((r.indication as number) - t.load));
      const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
      for (const r of t.rows ?? []) {
        const err = nil(r.indication) ? null : round((r.indication as number) - t.load);
        const dev = err === null ? null : round(Math.abs(err - mean));
        const pass = dev === null ? null : dev <= limit + 1e-9;
        rows.push({ cells: [r.date || "—", f(t.load), f(r.indication), f(err), f(dev), f(limit), pf(pass)], pass });
      }
      if (errs.length < rules.spanStability.minMeasurements) warnings.push(`At least ${rules.spanStability.minMeasurements} measurements are required over the test period.`);
      verdict = verdictFrom(rows, warnings, rows.length > 0);
      summary = rows.length ? `Variation of the error at load ${f(t.load)} ${u} over ${rows.length} measurements must not exceed ${rules.spanStability.mpeFraction} × |MPE|. ${verdict}.` : "No observations entered.";
    }
    tests.push({ testId: "spanStability", title: "Span stability", clause: rules.spanStability.clause, verdict, headers, rows, summary, warnings, integrityFlags: [] });
  }

  /* 11. Damp heat */
  {
    const t = data.dampHeat;
    const headers = ["Condition", `Load (${u})`, "Indication", `Error (${u})`, `MPE (±${u})`, "Result"];
    const rows: ResultRow[] = [];
    let verdict: Verdict = "NOT_TESTED";
    let summary = "Test not carried out.";
    if (t && t.applicable) {
      for (const r of t.rows ?? []) {
        if (nil(r.load)) continue;
        const mpe = mpeFor(r.load, spec, rules);
        const err = nil(r.indication) ? null : round((r.indication as number) - r.load);
        const pass = err === null ? null : Math.abs(err) <= mpe.value + 1e-9;
        rows.push({ cells: [r.condition, f(r.load), f(r.indication), f(err), f(mpe.value), pf(pass)], pass });
      }
      verdict = verdictFrom(rows, [], rows.length > 0);
      summary = rows.length ? `Damp heat, steady state (e.g. 40 °C / 85 % RH): errors within MPE before, during and after conditioning. ${verdict}.` : "No observations entered.";
    }
    tests.push({ testId: "dampHeat", title: "Damp heat, steady state", clause: rules.dampHeat.clause, verdict, headers, rows, summary, warnings: [], integrityFlags: [] });
  }

  const applicable = tests.filter((t) => t.verdict !== "NOT_TESTED");
  const summaryObj = {
    passed: tests.filter((t) => t.verdict === "PASS").length,
    failed: tests.filter((t) => t.verdict === "FAIL").length,
    incomplete: tests.filter((t) => t.verdict === "INCOMPLETE").length,
    notTested: tests.filter((t) => t.verdict === "NOT_TESTED").length,
  };
  let overall: Verdict = "INCOMPLETE";
  if (applicable.length === 0) overall = "INCOMPLETE";
  else if (summaryObj.failed > 0) overall = "FAIL";
  else if (summaryObj.incomplete > 0) overall = "INCOMPLETE";
  else overall = "PASS";

  const ghostFlags = detectGhostModeFlags(data);
  const allFlags = [...tests.flatMap((t) => t.integrityFlags), ...ghostFlags];

  return { tests, overall, integrityFlags: allFlags, summary: summaryObj };
}

export function detectGhostModeFlags(data: TestData): string[] {
  const flags: string[] = [];

  // 1. Zero Variance in Repeatability Series
  if (data.repeatability?.applicable && data.repeatability.series) {
    for (let i = 0; i < data.repeatability.series.length; i++) {
      const s = data.repeatability.series[i];
      const valid = (s.readings || []).filter((v): v is number => v !== null && v !== undefined);
      if (valid.length >= 5) {
        const unique = new Set(valid.map((v) => v.toFixed(6)));
        if (unique.size === 1) {
          flags.push(`Ghost Mode Alert: Zero variance detected across ${valid.length} repeat weighings in Series ${i + 1} (${valid[0]} kg). Synthetic/hand-typed data pattern suspect.`);
        }
      }
    }
  }

  // 2. Uniform Corner Loading in Eccentricity
  if (data.eccentricity?.applicable && data.eccentricity.positions) {
    const valid = data.eccentricity.positions.map((p) => p.indication).filter((v): v is number => v !== null && v !== undefined);
    if (valid.length >= 4) {
      const unique = new Set(valid.map((v) => v.toFixed(6)));
      if (unique.size === 1) {
        flags.push(`Ghost Mode Alert: Identical corner load indications (${valid[0]} kg) across all platform positions. Unrealistic transducer behavior.`);
      }
    }
  }

  // 3. Perfect Zero-Error Synthetic Pattern
  if (data.weighing?.applicable && data.weighing.rows) {
    const rows = data.weighing.rows.filter((r) => r.indUp !== null);
    if (rows.length >= 5) {
      const allZeroError = rows.every((r) => r.indUp === r.load);
      if (allZeroError) {
        flags.push(`Ghost Mode Alert: Zero error across all ${rows.length} test loads. Synthetic perfect dataset flagged for reviewer audit.`);
      }
    }
  }

  return flags;
}

/** helper: convert a kg threshold into the instrument's unit */
function toGramsInv(kg: number, unit: "kg" | "g") {
  return unit === "kg" ? kg : kg * 1000;
}

export const TEST_CATALOG: { id: keyof TestData; title: string; short: string }[] = [
  { id: "weighing", title: "Weighing performance", short: "Accuracy" },
  { id: "repeatability", title: "Repeatability", short: "Repeat." },
  { id: "eccentricity", title: "Eccentric loading", short: "Eccentricity" },
  { id: "tare", title: "Tare weighing", short: "Tare" },
  { id: "discrimination", title: "Discrimination", short: "Discrim." },
  { id: "zeroSetting", title: "Zero-setting", short: "Zero" },
  { id: "warmup", title: "Warm-up time", short: "Warm-up" },
  { id: "temperature", title: "Static temperatures", short: "Temp." },
  { id: "voltage", title: "Voltage variation", short: "Voltage" },
  { id: "spanStability", title: "Span stability", short: "Span" },
  { id: "dampHeat", title: "Damp heat", short: "Humidity" },
];
