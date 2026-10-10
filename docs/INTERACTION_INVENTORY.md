# Apex Engineering College ERP — Interaction Inventory & Round 2 Verification

## 1. System Access & Environment

- **Live Application URL:** [http://localhost:5173](http://localhost:5173)
- **Backend API URL:** [http://localhost:4000](http://localhost:4000) (Proxy accessible via `/api` on frontend)
- **Database:** PostgreSQL 18 (`college_erp` on port 5432)
- **Architecture:** Layered Monolith (Presentation • Business Logic/Validation • Data/PostgreSQL)

---

## 2. Seeded Demo Accounts (One-Click Role Switcher Available in UI)

| Role | Name | Email | Password | Academic Scope / Context |
|---|---|---|---|---|
| **Student** | Rahul Sharma | `rahul.cse@college.edu` | `Student@123` | Roll: 24CS001 • Batch 2024–2028 • CSE Section A |
| **Student** | Priya Patel | `priya.cse@college.edu` | `Student@123` | Roll: 24CS002 • Batch 2024–2028 • CSE Section A (IDOR Target) |
| **Faculty** | Dr. Alan Turing | `alan.turing@college.edu` | `Faculty@123` | CSE Chair • Initial Instructor CS301 (Data Structures) |
| **Faculty** | Dr. Grace Hopper | `grace.hopper@college.edu` | `Faculty@123` | CSE Associate Prof • Reassignment Successor |
| **Academic Admin** | Prof. John von Neumann | `academic.admin@college.edu` | `Admin@123` | College-wide Structure & Faculty Assignment Scope |
| **Exam Admin (CSE)**| Dr. Ada Lovelace | `exam.admin.cse@college.edu` | `Exam@123` | Statutory Designated Admin for Computer Science |
| **Exam Admin (EEE)**| Dr. Nikola Tesla | `exam.admin.eee@college.edu` | `Exam@123` | Designated Admin for EEE (Cross-Branch Test) |

---

## 3. Round 2 Acceptance Scenarios & Verification Evidence

### Scenario A: Concurrent Faculty Edits (Optimistic Concurrency Control)
- **Mechanism:** Every `AssessmentMark` record maintains an integer `version` field. When updating via `PUT /api/marks/:markId`, the request must supply `expectedVersion`.
- **Test Procedure:**
  1. Faculty Session A updates student Rahul's internal mark from `12.0` to `14.5` with `expectedVersion: 1`.
  2. Transaction succeeds (HTTP `200 OK`), database version increments to `v2`.
  3. Faculty Session B (holding stale cache at `v1`) submits `marksObtained: 10.0` with `expectedVersion: 1`.
  4. Backend rejects Session B update with **HTTP 409 Conflict** (`CONCURRENT_MODIFICATION_CONFLICT`).
  5. UI displays the Concurrency Conflict Alert with side-by-side diff: Stale Edit vs Server State, and a one-click "Reload & Review Latest Data" button.
- **Verification Evidence:** Tested and verified via `tests/scenario-a-concurrency.test.ts` and interactive button on Faculty Dashboard.

### Scenario B: Student Attacks Faculty & Admin APIs (Server-Side RBAC & IDOR)
- **Mechanism:** Deny-by-default server-side authorization middleware (`requireRole` and `verifyStudentOwnership`).
- **Test Procedure:**
  1. Attack 1: Student calls `PUT /api/marks/:id` -> Denied with **HTTP 403 Forbidden** (`FORBIDDEN_ROLE`).
  2. Attack 2: Student calls `POST /api/academic/assignments` -> Denied with **HTTP 403 Forbidden** (`FORBIDDEN_ROLE`).
  3. Attack 3: Student Rahul calls `GET /api/results/student/:priyaId` -> Denied with **HTTP 403 Forbidden** (`FORBIDDEN_STUDENT_OWNERSHIP`).
  4. Attack 4: Student calls `POST /api/results/:id/direct-correction` -> Denied with **HTTP 403 Forbidden** (`FORBIDDEN_ROLE`).
- **Audit Verification:** Audit log records security events (e.g. `IDOR_STUDENT_CROSS_ACCESS_ATTEMPT`).
- **Interactive UI:** Student Dashboard includes an embedded live attack suite executing these calls in real-time.

### Scenario C: Correction of a Published Result
- **C.1 Normal Path (Student Grievance):**
  1. Student requests correction: `POST /api/results/:resultId/request-correction`.
  2. Faculty reviews and proposes marks: `PUT /api/results/requests/:requestId/faculty-review`.
  3. Designated Exam Admin approves: `PUT /api/results/requests/:requestId/admin-approve`.
- **C.2 Direct Privileged Route (`POST /api/results/:resultId/direct-correction`):**
  1. Ineligible Category Test: Attempting direct correction with category `SUBJECTIVE_JUDGEMENT_DISPUTE` returns **HTTP 400 Bad Request** (`INELIGIBLE_CORRECTION_CATEGORY`).
  2. Cross-Branch Test: EEE Exam Admin attempting to correct CSE result returns **HTTP 403 Forbidden** (`FORBIDDEN_BRANCH_SCOPE`).
  3. Authorized Correction: CSE Exam Admin supplies category `TRANSCRIPTION_ERROR`, evidence `OMR-CSE-BATCH24-DEC2024-LEAF-44`, and new marks.
  4. Result is updated, version increments (`v1` -> `v2`), and immutable entry is written to `ResultVersionHistory` / Correction Ledger.

### Scenario D: Mid-Semester Faculty Reassignment
- **Mechanism:** `POST /api/academic/assignments` terminates previous instructor assignment at `effectiveDate` and creates new active assignment.
- **Test Procedure:**
  1. Academic Admin reassigns CS301 Section A from Dr. Alan Turing to Dr. Grace Hopper as of effective date.
  2. Dr. Alan Turing attempts mark edit -> Rejected with **HTTP 403 Forbidden** (`FORBIDDEN_TEACHING_SCOPE`).
  3. Dr. Grace Hopper attempts mark edit -> Accepted with **HTTP 200 OK**.
  4. Historical attribution check: Attendance sessions and marks submitted by Dr. Turing prior to effective date retain `recordedByFacultyId = Alan Turing`.

---

## 4. Phase 2: Campus Hub (Lost & Found + Trending Events)

### Lost & Found Portal
- **Endpoints:**
  - `GET /api/hub/lost-found`: Filter by type (`LOST` / `FOUND`), status (`OPEN` / `CLAIMED` / `RESOLVED`), category, keyword search.
  - `POST /api/hub/lost-found`: File report with sanitized photo upload (stored in `public/uploads/`), location, and description.
  - `POST /api/hub/lost-found/:id/claim`: Submit ownership verification claim with proof description and contact info (prevents self-claim).
  - `PUT /api/hub/lost-found/:id/claims/:claimId`: Reporter or admin reviews claim (`APPROVED` / `REJECTED`). Approval transitions status to `RESOLVED`.
  - `PUT /api/hub/lost-found/:id/status`: Update item lifecycle state (`OPEN` / `CLAIMED` / `RESOLVED`).
- **Verification Evidence:** Tested and verified via `tests/campus-hub.test.ts` (4 test cases).

### Trending Events Portal
- **Endpoints:**
  - `GET /api/hub/events`: Lists upcoming events ranked dynamically by trending score: `(upvotes * 2) + attendingCount + interestedCount`.
  - `POST /api/hub/events`: Host new campus event with category (Hackathon, Workshop, Technical, Cultural, Sports), venue, date, and banner image.
  - `POST /api/hub/events/:id/upvote`: Real-time toggle upvote per user.
  - `POST /api/hub/events/:id/rsvp`: User RSVP status (`ATTENDING` / `INTERESTED` / `REMOVE`) with real-time attendee counters.
- **Verification Evidence:** Tested and verified via `tests/campus-hub.test.ts` (4 test cases).

---

## 5. Test Execution Summary

- `npm test`: **37 passed** across all 6 test suites (Round 1 + Round 2 + Phase 2 Campus Hub).
- `npm run verify:round2`: **All 4 Round 2 scenarios verified against PostgreSQL 18.**
- **Frontend & Backend Daemons:** Active and healthy on `http://localhost:5173` and `http://localhost:4000`.
