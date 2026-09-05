# SmartNAWI – Digital Testing & Compliance Platform for NAWI (OIML R 76)

**SIH 2026 · Ministry of Consumer Affairs, Food & Public Distribution (DoCA)**
**PS SIH26035: Development of Software Program/Application for Generation of Test Reports for Non-Automatic Weighing Instruments (NAWI) as per OIML Recommendation R-76**

SmartNAWI converts manual NAWI type-evaluation testing into a single unified digital workflow:
**Enter instrument specs → Auto-validate classification (Table 3) → Record test observations → Auto-calculate MPE (Table 6) → Instant Pass/Fail verdict → Standardized report (Printable PDF / MS Word)**.

---

## 🚀 Quick Launch Modes

### Mode 1: Instant Standalone Web Prototype (`index.html`)
To present or evaluate the application instantly in any web browser without running a server or database:
1. Open the project root folder.
2. Double-click **[`index.html`](file:///c:/SIH%202026/index.html)** in any web browser (Chrome, Edge, Firefox).
3. Experience the full interactive dashboard, OIML R-76 calculation workspace, digital signature simulation, and live printable report preview!

### Mode 2: Full-Stack Next.js Application
For production server deployment:
```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## 👥 Demo Accounts (Next.js Application)

| Role     | Email                        | Password    | Permissions                                             |
| -------- | ---------------------------- | ----------- | ------------------------------------------------------- |
| Admin    | admin@smartnawi.gov.in       | admin123    | Everything + user management + publish R-76 rule sets   |
| Tester   | tester@smartnawi.gov.in      | tester123   | Register instruments, create reports, record test data  |
| Reviewer | reviewer@smartnawi.gov.in    | reviewer123 | Review, approve & digitally sign (SHA-256) reports       |

---

## 🏛️ Architecture & Highlights

```
Browser (index.html OR Next.js App Router, React 19, Tailwind)
   │  
   ▼
Calculation Engine ── src/lib/r76/engine.ts  (pure, deterministic OIML R-76 engine)
   │                  src/lib/r76/rules.ts   (versioned data-driven rule config)
   │                  src/lib/export/pdf.ts  (pdf-lib PDF generator)
   │                  src/lib/export/docx.ts (MS Word DOCX exporter)
   ▼
PostgreSQL via Drizzle ORM (users, sessions, instruments, rule_sets, test_reports, attachments, audit_logs)
```

* **Role-Based Access Control (RBAC)** – Cookie sessions with scrypt password hashing for `admin | tester | reviewer`.
* **Legal Metrology Rule-Traceable** – Evaluates observations against OIML R 76-1:2006 clauses; each verdict row carries clause references.
* **Audit Trail & Digital Signatures** – Audit logs track every action; approval attaches SHA-256 cryptographic hashes over payloads.
* **Ghost Mode (Integrity Guard)** – Flags suspicious data patterns (zero variance, duplicated readings) for reviewer attention without blocking data entry.
* **Configurable Rule Sets** – Future OIML recommendation revisions are supported via JSON rule configs without modifying engine code.

---

## 📊 Calculation Methodology (OIML R 76-1:2006)

| Test Module | Clause | Implementation & Logic |
| ----------- | ------ | ---------------------- |
| Classification | Table 3 | `checkClassification()` – verification scale interval $e$, scale intervals $n = \text{Max}/e$, Min capacity limit, $d \le e$ |
| MPE | Table 6 | `mpeFor(load)` – load in $e$ mapped to $\pm 0.5e / \pm 1.0e / \pm 1.5e$ bands per class; in-service factor = 2 |
| Error of indication | A.4.4.3 | Reading method $E = I - L$ or Changeover-point method $E = I + \frac{1}{2}d - \Delta L - L$; corrected $E_c = E - E_0$ |
| Weighing performance | 3.5.1 / A.4.4 | Increasing & decreasing loads, $\ge 5$ loads including Min, Max and MPE changeover transition loads; $|E_c| \le \text{MPE}$ |
| Repeatability | 3.6.1 / A.4.10 | 2 load series ($\approx 50\%$ Max, $\approx 100\%$ Max), 10 weighings each; $\text{Max} - \text{Min} \le |\text{MPE}|$ |
| Eccentricity | 3.6.2 / A.4.7 | Load $\approx \text{Max}/3$ at 5 platform positions; each $|E| \le \text{MPE}(\text{load})$ |
| Tare weighing | 3.5.3 / A.4.6 | MPE applied to net load; $\text{Tare} + \text{Net} \le \text{Max}$ |
| Discrimination | 3.8.2 / A.4.8 | Extra load of $1.4d$ must change indication by $\ge 1d$ |
| Zero-setting devices | 4.5 / A.4.2 | Initial range $\le 20\%\text{Max}$, semi-automatic $\le 4\%\text{Max}$, zero accuracy $\le \pm 0.25e$ |
| Warm-up time | 5.3.5 / A.5.2 | Errors within MPE at 0, 5, 15, 30 minutes after switch-on |
| Static temperature | 3.9.2 / A.5.3 | Errors within MPE at 20, $T_{\text{max}}$, $T_{\text{min}}$, 5, 20 °C; zero drift $\le 1e / 5^\circ\text{C}$ |
| Voltage variation | 3.9.3 / A.5.4 | $-15\%$ and $+10\%$ nominal mains voltage variation; errors within MPE |
| Span stability | 3.9.4 / A.6 | Deviation from mean error $\le 0.5 \times |\text{MPE}|$ across $\ge 8$ measurements |
| Damp heat | 3.9.2 / A.5.3.2 | Errors within MPE before, during ($40^\circ\text{C} / 85\%\text{RH}$), and after conditioning |
