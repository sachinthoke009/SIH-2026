import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("tester"), // admin | tester | reviewer
  designation: text("designation"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 128 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const instruments = pgTable("instruments", {
  id: serial("id").primaryKey(),
  manufacturer: text("manufacturer").notNull(),
  manufacturerAddress: text("manufacturer_address"),
  applicant: text("applicant"),
  applicantAddress: text("applicant_address"),
  model: text("model").notNull(),
  serialNumber: text("serial_number").notNull(),
  instrumentType: text("instrument_type").notNull(), // platform scale, weighbridge, counter scale ...
  accuracyClass: varchar("accuracy_class", { length: 4 }).notNull(), // I, II, III, IIII
  unit: varchar("unit", { length: 4 }).notNull().default("kg"), // kg | g
  maxCapacity: doublePrecision("max_capacity").notNull(),
  minCapacity: doublePrecision("min_capacity").notNull(),
  verificationInterval: doublePrecision("verification_interval").notNull(), // e
  actualInterval: doublePrecision("actual_interval").notNull(), // d
  multiInterval: boolean("multi_interval").notNull().default(false),
  ranges: jsonb("ranges").$type<{ max: number; e: number }[]>().default([]),
  indicationType: text("indication_type").notNull().default("digital"), // digital | analog
  powerSupply: text("power_supply").default("AC 230 V, 50 Hz"),
  loadCell: text("load_cell"),
  indicator: text("indicator"),
  softwareVersion: text("software_version"),
  tempRangeMin: doublePrecision("temp_range_min").default(-10),
  tempRangeMax: doublePrecision("temp_range_max").default(40),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ruleSets = pgTable("rule_sets", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(), // OIML-R76-1
  version: text("version").notNull(), // 2006 (E)
  title: text("title").notNull(),
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  active: boolean("active").notNull().default(false),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const testReports = pgTable("test_reports", {
  id: serial("id").primaryKey(),
  reportNumber: varchar("report_number", { length: 64 }).notNull().unique(),
  instrumentId: integer("instrument_id")
    .notNull()
    .references(() => instruments.id, { onDelete: "cascade" }),
  ruleSetId: integer("rule_set_id").references(() => ruleSets.id),
  status: varchar("status", { length: 24 }).notNull().default("draft"), // draft | in_progress | under_review | approved | rejected
  purpose: text("purpose").notNull().default("Model Approval (Type Evaluation)"),
  applicationRef: text("application_ref"),
  labName: text("lab_name").notNull(),
  labAddress: text("lab_address"),
  labAccreditation: text("lab_accreditation"),
  testLocation: text("test_location"),
  temperature: doublePrecision("temperature"),
  humidity: doublePrecision("humidity"),
  pressure: doublePrecision("pressure"),
  referenceStandards: text("reference_standards"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  testedById: integer("tested_by_id").references(() => users.id),
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  testData: jsonb("test_data").notNull().default({}),
  results: jsonb("results").notNull().default({}),
  overallVerdict: varchar("overall_verdict", { length: 16 }).notNull().default("INCOMPLETE"),
  remarks: text("remarks"),
  signature: jsonb("signature"), // { signedBy, signedAt, hash }
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => testReports.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  caption: text("caption"),
  size: integer("size").notNull(),
  dataBase64: text("data_base64").notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => testReports.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Instrument = typeof instruments.$inferSelect;
export type TestReport = typeof testReports.$inferSelect;
export type RuleSet = typeof ruleSets.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
