# Institutional ERP & Campus Hub — Apex Engineering College

A production-grade, full-stack institutional ERP and collaborative Campus Hub built for engineering colleges. Designed with a strict layered monolith architecture, PostgreSQL database persistence, optimistic concurrency control (OCC), server-side role-based access control (RBAC), immutable academic result audit ledgers, and zero mock buttons or local storage fallbacks.

---

## 1. Quick Access & Live Services

| Component | URL / Endpoint | Port | Status |
|---|---|---|---|
| **Frontend Portal** | [http://localhost:5173](http://localhost:5173) | 5173 | Active (Vite + React) |
| **Backend REST API** | [http://localhost:4000](http://localhost:4000) (Proxy at `/api`) | 4000 | Active (Node.js + Express) |
| **Health Check** | [http://localhost:4000/health](http://localhost:4000/health) | 4000 | Active |
| **PostgreSQL Database** | `localhost:5432/college_erp` | 5432 | Active (PostgreSQL 18.6) |

### Pre-Seeded Institutional Credentials

The login screen at `/` features **one-click credential quick-fill** cards for rapid evaluation:

| Role | Name | Identifier (Roll / Email) | Password | Department / Context |
|---|---|---|---|---|
| **Student** | Rahul Sharma | `24CS001` or `rahul.cse@college.edu` | `Student@123` | CSE • Batch 2024–2028 • Section A |
| **Student** | Priya Patel | `24CS002` or `priya.cse@college.edu` | `Student@123` | CSE • Batch 2024–2028 • Section A (IDOR Target) |
| **Faculty** | Dr. Alan Turing | `alan.turing@college.edu` | `Faculty@123` | CSE • Initial Instructor CS301 (Sec A) |
| **Faculty** | Dr. Grace Hopper | `grace.hopper@college.edu` | `Faculty@123` | CSE • Reassignment Successor CS301 (Sec A) |
| **Academic Admin** | Prof. John von Neumann | `academic.admin@college.edu` | `Admin@123` | College-wide Academic Administration |
| **Exam Admin (CSE)** | Dr. Ada Lovelace | `exam.admin.cse@college.edu` | `Exam@123` | Statutory Designated Admin (CSE Branch) |
| **Exam Admin (EEE)** | Dr. Nikola Tesla | `exam.admin.eee@college.edu` | `Exam@123` | Statutory Designated Admin (EEE Branch) |

---

## 2. Technology Stack & Architecture

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, Lucide Icons.
- **Backend:** Node.js 20, TypeScript, Express.js, Zod request validation, Helmet, CORS, bcryptjs, JSON Web Tokens.
- **Database & ORM:** PostgreSQL 18, Prisma ORM with versioned schema migrations, strict foreign key constraints, composite unique indexes, and ACID transactions.
- **File Storage:** Persistent multi-image disk storage with mime validation at `backend/public/uploads/`.
- **Testing:** Vitest, Supertest, database-backed integration test suite.

```
                           +---------------------------+
                           |    React 18 Single-Page   |
                           |   Application (Port 5173) |
                           +-------------+-------------+
                                         | Vite Proxy (/api)
                                         v
                           +---------------------------+
                           |   Express.js API Server   |
                           |   TypeScript (Port 4000)  |
                           +-------------+-------------+
                                         |
     +-----------------+-----------------+-----------------+-----------------+
     |                 |                 |                 |                 |
     v                 v                 v                 v                 v
[Auth & RBAC]   [Academic Core]   [Marks & OCC]    [Results & Calc]    [Campus Hub]
     |                 |                 |                 |                 |
     +-----------------+-----------------+-----------------+-----------------+
                                         | Prisma Client
                                         v
                           +---------------------------+
                           |    PostgreSQL 18 Database |
                           |   ACID Transactions & OCC |
                           +---------------------------+
```

---

## 3. Four Role-Based Portals

### 3.1 Student Portal
- **Dashboard Overview:** Displays student identity, roll number, department, current semester, overall attendance percentage, registered credits, and GPA.
- **Full Navigation Sidebar:** Dashboard, My Profile, My Courses, My Timetable, Attendance, Internal Marks, Examination Results, Academic Performance, Correction Requests, Revaluation, Announcements, Trending Events, Lost & Found, Settings, Logout.
- **Attendance Analytics:** Subject-wise breakdown with attended/total counts, visual shortage warning if attendance falls below 75% (statutory requirement).
- **Marks Breakdown:** Internal marks breakdown out of 40 (Mid-1, Mid-2, Quizzes/Assignments) + External marks out of 60 + Grand Total out of 100.
- **Examination Results & Badges:** Displays published results with SGPA/CGPA, letter grades, credits earned, and color-coded status badges (`v1 Initial`, `v2+ Corrected`).
- **Grievance & Revaluation:** Submit result correction grievance to faculty or apply for revaluation.
- **Live Security Demo Suite:** Embedded interactive panel to test server-side 403 Forbidden responses for unauthorized student attacks (Scenario B).

### 3.2 Faculty Portal
- **Full Navigation Sidebar:** Dashboard, Assigned Courses, My Sections, Student Roster, My Timetable, Attendance Management, Internal Marks Entry, Assessment Submission, Correction Requests, Class Performance, Assignment History, Announcements, Campus Hub, Logout.
- **Attendance Management:** Record daily session attendance. Enforces unique session constraint `@@unique([sessionId, studentId])`; duplicate attempts return HTTP 409 Conflict.
- **Internal Marks Entry & OCC:** Interactive marks matrix with atomic Optimistic Concurrency Control. Supports lock submission when assessments are finalized.
- **Interactive Concurrency Simulator:** Built-in tool allowing faculty to simulate a concurrent stale edit, receive an HTTP 409 Conflict, and inspect the side-by-side diff between their stale edit and current server state.
- **Grievance Resolution:** Review student mark correction requests and submit proposed corrections to the Exam Admin.
- **Assignment History:** Complete audit trail of active and archived course offerings assigned to the instructor.

### 3.3 Academic Admin Portal
- **Full Navigation Sidebar:** Dashboard, User Accounts, Courses & Offerings, Faculty Assignments, Student Enrollment, Timetable Management, Semester Progression, Attendance Overview, Academic Reports, System Audit Logs, Logout.
- **User Provisioning:** Create Student and Faculty accounts with real bcrypt password hashing and show/hide password toggles.
- **Curriculum & Offerings:** Manage departments (CSE, Civil, Chemical, EEE), batches (2024–2028, 2025–2029, 2026–2030), sections (A, B, C, D), and course offerings.
- **Mid-Semester Faculty Reassignment:** Effective-dated instructor handover tool (Scenario D). Terminates outgoing faculty assignment and activates incoming faculty assignment in an atomic transaction.
- **Timetable Management:** Room and time slot allocator with room collision detection.
- **Semester Progression Engine:** Idempotent batch progression of student cohorts to the next semester.

### 3.4 Examination Admin Portal
- **Branch Scoping:** Statutory isolation strictly enforced at the database level (`ExamAdminDesignation`). An admin designated for CSE cannot inspect or modify records in EEE.
- **Marks Verification & External Entry:** Review faculty internal submissions and input external exam scores out of 60.
- **Calculation & Publishing Engine:**
  - 10-point scale: $\ge 90 \to \text{O (10 GP)}$, $\ge 80 \to \text{A (9 GP)}$, $\ge 70 \to \text{B (8 GP)}$, $\ge 60 \to \text{C (7 GP)}$, $\ge 50 \to \text{D (6 GP)}$, $\ge 40 \to \text{P (5 GP)}$, $< 40 \to \text{F (0 GP)}$.
  - SGPA: $\frac{\sum (\text{Credits} \times \text{GradePoints})}{\sum \text{Credits}}$.
  - CGPA Withholding: If any course has an `F` (Fail) or `AB` (Absent), CGPA is withheld with `WITHHELD_FAILED_SUBJECTS` status.
- **Direct Privileged Result Correction (Scenario C):**
  - Requires mandatory category (`TRANSCRIPTION_ERROR`, `OMR_SCANNING_DEFECT`, `TOTALING_ARITHMETIC_ERROR`, `WRONG_ENROLLMENT_MAPPING`). Subjective disputes return HTTP 400 Bad Request.
  - Requires mandatory institutional evidence reference string.
  - Automatically preserves previous version in `ResultVersionHistory` and increments result version.
- **Revaluation Governance:** Review student revaluation applications and register revised marks.

### 3.5 Campus Hub
- **Trending Events:**
  - Dynamic ranking algorithm: $\text{Score} = (\text{Upvotes} \times 2) + \text{AttendingCount} + \text{InterestedCount}$.
  - Real-time upvote toggling and RSVP status management (`ATTENDING`, `INTERESTED`, `REMOVE`).
  - Event host modal with image banner, venue, date, and category.
- **Lost & Found:**
  - Multi-image disk uploads (`/uploads/`) with file size and mime validation.
  - Lifecycle state machine: `OPEN` $\to$ `CLAIMED` $\to$ `RESOLVED`.
  - Claim verification flow: Verified claimants must submit proof of ownership; original reporter or admin approves or rejects the claim.

---

## 4. The Four Mandatory Hackathon Scenarios

### Scenario A: Concurrent Faculty Edits (Optimistic Concurrency Control)
- **Problem:** Two faculty members or browser tabs submit internal marks for the same student simultaneously. Uncontrolled writes cause silent data overwriting.
- **Solution:**
  - `AssessmentMark` model includes an integer `version` field.
  - Updates require `expectedVersion` in request body.
  - Update query uses atomic conditional matching: `WHERE id = markId AND version = expectedVersion`.
  - If database version has advanced, update fails and API returns **HTTP 409 Conflict** with `CONCURRENT_MODIFICATION_CONFLICT`, stale version, server version, and current server payload.
  - Frontend prompts faculty with a side-by-side diff to resolve discrepancies.
- **Automated Verification:** `tests/scenario-a-concurrency.test.ts` (1 test).

### Scenario B: Unauthorized Student API Access (Server-Side RBAC & IDOR)
- **Problem:** Malicious student alters client-side code or uses Postman to edit marks, access administrative routes, or inspect peer academic records.
- **Solution:**
  - Strict server-side RBAC middleware (`requireRole('FACULTY')`, `requireRole('EXAM_ADMIN')`, `requireRole('ACADEMIC_ADMIN')`).
  - IDOR defense middleware (`verifyStudentOwnership`) verifies token `userId` matches requested student record.
  - All unauthorized attempts immediately return **HTTP 403 Forbidden** and log an entry into the security `AuditLog`.
- **Automated Verification:** `tests/scenario-b-student-attack.test.ts` (4 tests).

### Scenario C: Correction of a Published Result
- **Problem:** Correcting a published result without an auditable ledger corrupts academic trust.
- **Solution:**
  - **Normal Pathway:** Student grievance $\to$ Faculty review and proposed mark $\to$ Branch Exam Admin approval $\to$ Version incremented and published.
  - **Direct Privileged Pathway:** Designated Exam Admin may execute direct correction under strict constraints:
    - Admin must have statutory designation for the result's branch (otherwise HTTP 403).
    - Correction reason must match allowed statutory categories (otherwise HTTP 400).
    - Institutional evidence identifier (e.g. OMR sheet serial number) is strictly required.
    - Previous result snapshot is immutably archived into `ResultVersionHistory`.
- **Automated Verification:** `tests/scenario-c-result-correction.test.ts` (9 tests).

### Scenario D: Mid-Semester Faculty Reassignment
- **Problem:** Instructor reassignment mid-term often creates race conditions, access leaks, or erases historical attribution.
- **Solution:**
  - `TeachingAssignment` model tracks `effectiveFrom` and `effectiveTo` timestamps alongside an `isActive` boolean.
  - When Academic Admin executes reassignment, the outgoing assignment is deactivated at `effectiveDate` and a new assignment is created for the incoming faculty.
  - Outgoing faculty is immediately denied write permissions (HTTP 403 Forbidden).
  - Historical marks and attendance sessions created prior to the effective date retain `recordedByFacultyId` pointing to the original instructor.
- **Automated Verification:** `tests/scenario-d-reassignment.test.ts` (5 tests).

---

## 5. Verification Commands & Test Results

Run all test suites and scenario verifications directly from the `backend/` directory:

### Run Full Vitest Test Suite (37 Tests Passed)
```bash
cd /home/abhi/ERP/backend
npm test
```
**Output:**
```text
Test Files  6 passed (6)
     Tests  37 passed (37)
  Duration  6.38s
```

### Run End-to-End Hackathon Scenario Verification
```bash
cd /home/abhi/ERP/backend
npm run verify:round2
```
**Output:**
```text
========================================================================
        COLLEGE ERP — ROUND 2 MVP SCENARIO VERIFICATION SUITE           
========================================================================
✔ Authenticated Faculty A (Dr. Alan Turing)
✔ Authenticated Faculty B (Dr. Grace Hopper)
✔ Authenticated Student (Rahul Sharma, Roll: 24CS001)
✔ Authenticated Academic Admin (Prof. John von Neumann)
✔ Authenticated Designated CSE Exam Admin (Dr. Ada Lovelace)
✔ Authenticated Other Branch Exam Admin (Dr. Nikola Tesla, EEE Branch)

SCENARIO A: Concurrent Faculty Edits (Optimistic Concurrency Control)
-> Response Status: 409 Conflict (CONCURRENT_MODIFICATION_CONFLICT)
✔ Database State Verified: Version = 2, Stored Marks = 14.5

SCENARIO B: Student Attacks Faculty & Admin APIs (Server-Side RBAC & IDOR)
Attack 1 (Marks Edit): Status: 403 Forbidden
Attack 2 (Admin Reassignment): Status: 403 Forbidden
Attack 3 (IDOR Peer Result): Status: 403 Forbidden
✔ Audit Log Verified: Captured 'IDOR_STUDENT_CROSS_ACCESS_ATTEMPT'

SCENARIO C: Published Result Correction (Normal & Direct Privileged Routes)
C.1 Normal Path: Student Request -> Faculty Proposal -> Admin Approval (v2)
C.2 Direct Path: Ineligible Category -> 400 Bad Request
C.2 Direct Path: Cross-Branch Admin -> 403 Forbidden
C.2 Direct Path: Valid Correction -> 200 OK (v3, Grade O, 10 GP)
✔ Version History Persisted (3 immutable versions in ResultVersionHistory)

SCENARIO D: Mid-Semester Faculty Reassignment
1. Outgoing Faculty marks edit attempt -> 403 Forbidden
2. Incoming Faculty marks edit attempt -> 200 OK
3. Historical attendance author -> Dr. Alan Turing (PRESERVED)
✔ Teaching Assignment History Persisted

✔ ALL FOUR ROUND 2 SCENARIOS VERIFIED SUCCESSFULLY ON REAL BACKEND & DB
```

---

## 6. Project Directory Structure

```
/home/abhi/ERP
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Prisma schema with OCC, unique constraints & audit tables
│   ├── src/
│   │   ├── app.ts                  # Express application configuration & routing
│   │   ├── config.ts               # Environment configuration
│   │   ├── index.ts                # Entry point on port 4000
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts  # JWT verification, RBAC, IDOR & Branch Scoping
│   │   ├── routes/
│   │   │   ├── auth.routes.ts      # Dual login (Roll/Email), password hashing
│   │   │   ├── academic.routes.ts  # Structure, offerings, reassignments, progression
│   │   │   ├── marks.routes.ts     # Assessment marks entry with OCC (v1 -> v2)
│   │   │   ├── attendance.routes.ts# Session attendance with duplicate prevention
│   │   │   ├── results.routes.ts   # GPA calculation, publishing, correction ledger
│   │   │   └── campushub.routes.ts # Events upvoting/RSVP & Lost and Found with image upload
│   │   ├── prisma/
│   │   │   ├── seed.ts             # Canonical database seeder
│   │   └── scripts/
│   │       └── verify-round2.ts    # End-to-end scenario verification runner
│   ├── tests/
│   │   ├── scenario-a-concurrency.test.ts
│   │   ├── scenario-b-student-attack.test.ts
│   │   ├── scenario-c-result-correction.test.ts
│   │   ├── scenario-d-reassignment.test.ts
│   │   ├── calculation-engine.test.ts
│   │   └── campus-hub.test.ts
│   ├── .env                        # Local database & JWT credentials
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── PortalLayout.tsx    # Responsive layout with persistent sidebar & breadcrumbs
│   │   ├── pages/
│   │   │   ├── Login.tsx           # Institutional login with demo account quick-fill
│   │   │   ├── StudentDashboard.tsx# 15-item sidebar, attendance analytics, Scenario B suite
│   │   │   ├── FacultyDashboard.tsx# 13-item sidebar, attendance, OCC marks & conflict diff
│   │   │   ├── AcademicAdminDashboard.tsx # Provisioning, offerings, Scenario D reassignment
│   │   │   ├── ExamAdminDashboard.tsx     # Marks verify, calculation, Scenario C direct correction
│   │   │   └── CampusHub.tsx       # Trending events, upvotes, RSVPs, Lost & Found images
│   │   ├── App.tsx                 # Client routing & authentication state management
│   │   └── index.css               # Tailwind CSS styles
│   ├── vite.config.ts              # Proxying /api to port 4000
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── INTERACTION_INVENTORY.md   # Complete interaction matrix & scenario specs
│   └── ROUND1_DESIGN_NOTE.md       # Architecture design document & schema definitions
└── README.md                       # This comprehensive documentation
```

---

## 7. Starting the Application from Scratch

1. **Start PostgreSQL:** Ensure PostgreSQL is running on port 5432 with database `college_erp`.
2. **Setup Backend:**
   ```bash
   cd /home/abhi/ERP/backend
   npm install
   npx prisma db push
   npm run db:seed
   npm run build
   npm start
   ```
3. **Setup Frontend:**
   ```bash
   cd /home/abhi/ERP/frontend
   npm install
   npm run build
   npm run dev
   ```
4. Access the web application at [http://localhost:5173](http://localhost:5173).
