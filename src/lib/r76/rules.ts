/**
 * Configurable OIML R 76-1 rule layer.
 * Everything the calculation engine needs is expressed as data so that a
 * revised Recommendation can be absorbed by publishing a new rule set version
 * (Admin → Rule Sets) without touching the engine code.
 */

export type AccuracyClass = "I" | "II" | "III" | "IIII";

export interface ClassBand {
  /** verification scale interval limits, in grams (null = unbounded) */
  eMinG: number;
  eMaxG: number | null;
  nMin: number;
  nMax: number | null;
  /** Min capacity lower limit expressed as multiples of e */
  minCapMultiple: number;
}

export interface MpeBand {
  /** multiple of e (0.5, 1.0, 1.5) */
  mult: number;
  /** upper load limit (inclusive) expressed in e per class; null = unbounded */
  upTo: Record<AccuracyClass, number | null>;
}

export interface R76RuleConfig {
  code: string;
  version: string;
  title: string;
  classes: Record<AccuracyClass, ClassBand[]>;
  mpeBands: MpeBand[];
  inServiceFactor: number;
  weighing: { minLoads: number; requireMax: boolean; requireMin: boolean; clause: string };
  repeatability: {
    seriesRequired: number;
    weighingsIfMaxLe100kg: number;
    weighingsIfMaxGt100kg: number;
    clause: string;
  };
  eccentricity: { loadFraction: number; minPositions: number; clause: string };
  tare: { clause: string };
  discrimination: { extraLoadInD: number; requiredChangeInD: number; clause: string };
  zeroSetting: { initialRangePct: number; semiAutoRangePct: number; accuracyE: number; clause: string };
  warmup: { checkpointsMin: number[]; clause: string };
  temperature: { zeroDriftEPer5Deg: Record<AccuracyClass, number>; clause: string };
  voltage: { lowPct: number; highPct: number; clause: string };
  spanStability: { mpeFraction: number; minMeasurements: number; clause: string };
  dampHeat: { clause: string };
}

export const DEFAULT_R76_RULES: R76RuleConfig = {
  code: "OIML-R76-1",
  version: "2006 (E)",
  title: "OIML R 76-1:2006 Non-automatic weighing instruments – Metrological and technical requirements – Tests",
  classes: {
    I: [{ eMinG: 0.001, eMaxG: null, nMin: 50000, nMax: null, minCapMultiple: 100 }],
    II: [
      { eMinG: 0.001, eMaxG: 0.05, nMin: 100, nMax: 100000, minCapMultiple: 20 },
      { eMinG: 0.1, eMaxG: null, nMin: 5000, nMax: 100000, minCapMultiple: 50 },
    ],
    III: [
      { eMinG: 0.1, eMaxG: 2, nMin: 100, nMax: 10000, minCapMultiple: 20 },
      { eMinG: 5, eMaxG: null, nMin: 500, nMax: 10000, minCapMultiple: 20 },
    ],
    IIII: [{ eMinG: 5, eMaxG: null, nMin: 100, nMax: 1000, minCapMultiple: 10 }],
  },
  mpeBands: [
    { mult: 0.5, upTo: { I: 50000, II: 5000, III: 500, IIII: 50 } },
    { mult: 1.0, upTo: { I: 200000, II: 20000, III: 2000, IIII: 200 } },
    { mult: 1.5, upTo: { I: null, II: 100000, III: 10000, IIII: 1000 } },
  ],
  inServiceFactor: 2,
  weighing: { minLoads: 5, requireMax: true, requireMin: true, clause: "R76-1 3.5.1 / R76-2 A.4.4" },
  repeatability: {
    seriesRequired: 2,
    weighingsIfMaxLe100kg: 10,
    weighingsIfMaxGt100kg: 3,
    clause: "R76-1 3.6.1 / R76-2 A.4.10",
  },
  eccentricity: { loadFraction: 1 / 3, minPositions: 4, clause: "R76-1 3.6.2 / R76-2 A.4.7" },
  tare: { clause: "R76-1 3.5.3 & 4.6 / R76-2 A.4.6" },
  discrimination: { extraLoadInD: 1.4, requiredChangeInD: 1, clause: "R76-1 3.8.2 / R76-2 A.4.8" },
  zeroSetting: { initialRangePct: 20, semiAutoRangePct: 4, accuracyE: 0.25, clause: "R76-1 4.5 / R76-2 A.4.2" },
  warmup: { checkpointsMin: [0, 5, 15, 30], clause: "R76-1 5.3.5 / R76-2 A.5.2" },
  temperature: { zeroDriftEPer5Deg: { I: 1, II: 1, III: 1, IIII: 1 }, clause: "R76-1 3.9.2 / R76-2 A.5.3" },
  voltage: { lowPct: -15, highPct: 10, clause: "R76-1 3.9.3 / R76-2 A.5.4" },
  spanStability: { mpeFraction: 0.5, minMeasurements: 8, clause: "R76-1 3.9.4 / R76-2 A.6" },
  dampHeat: { clause: "R76-1 3.9.2 / R76-2 A.5.3.2" },
};

export const ACCURACY_CLASSES: { value: AccuracyClass; label: string }[] = [
  { value: "I", label: "Class I – Special" },
  { value: "II", label: "Class II – High" },
  { value: "III", label: "Class III – Medium" },
  { value: "IIII", label: "Class IIII – Ordinary" },
];

export const INSTRUMENT_TYPES = [
  "Electronic Platform Scale",
  "Table Top / Counter Scale",
  "Weighbridge",
  "Precision Balance",
  "Hanging / Crane Scale",
  "Bench Scale",
  "Price Computing Scale",
  "Other",
];
