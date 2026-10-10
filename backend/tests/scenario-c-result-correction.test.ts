import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma';
import { seedDatabase } from '../src/prisma/seed';

describe('Scenario C: Published Result Correction (Normal & Direct Privileged Routes)', () => {
  let studentToken: string;
  let facultyToken: string;
  let cseExamAdminToken: string;
  let eeeExamAdminToken: string;
  let acadAdminToken: string;

  let publishedResultId: string;
  let initialVersion: number;

  beforeAll(async () => {
    await seedDatabase();

    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rahul.cse@college.edu', password: 'Student@123' });
    studentToken = studentRes.body.token;

    const facultyRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alan.turing@college.edu', password: 'Faculty@123' });
    facultyToken = facultyRes.body.token;

    const cseExamRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'exam.admin.cse@college.edu', password: 'Exam@123' });
    cseExamAdminToken = cseExamRes.body.token;

    const eeeExamRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'exam.admin.eee@college.edu', password: 'Exam@123' });
    eeeExamAdminToken = eeeExamRes.body.token;

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'academic.admin@college.edu', password: 'Admin@123' });
    acadAdminToken = adminRes.body.token;

    const result = await prisma.publishedResult.findFirst({
      where: { publicationState: 'PUBLISHED' },
    });
    expect(result).not.toBeNull();
    publishedResultId = result!.id;
    initialVersion = result!.currentVersion;
  });

  describe('Part 1: Normal Academic Pathway (Student -> Faculty Review -> Exam Admin Authorization)', () => {
    let requestId: string;

    it('allows student to submit a correction request with reason', async () => {
      const res = await request(app)
        .post(`/api/results/${publishedResultId}/request-correction`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          reason: 'Mid-2 assessment evaluation total was not properly summed',
          requestedMarks: 36,
        });

      expect(res.status).toBe(201);
      expect(res.body.request.status).toBe('PENDING_FACULTY');
      requestId = res.body.request.id;
    });

    it('allows assigned faculty to review and propose a correction', async () => {
      const res = await request(app)
        .put(`/api/results/requests/${requestId}/faculty-review`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          action: 'PROPOSE',
          reason: 'Verified physical paper: 3 marks were missed on question 4b',
          proposedInternalMarks: 36,
        });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('PROPOSED_BY_FACULTY');
      expect(res.body.request.proposedMarks).toBe(36);
    });

    it('allows designated branch Exam Admin to authorize and publish the revised result version', async () => {
      const res = await request(app)
        .put(`/api/results/requests/${requestId}/admin-approve`)
        .set('Authorization', `Bearer ${cseExamAdminToken}`)
        .send({
          reason: 'Approved based on verified faculty re-evaluation note',
        });

      expect(res.status).toBe(200);
      expect(res.body.result.currentVersion).toBe(initialVersion + 1);
      expect(res.body.result.internalMarks).toBe(36);
      expect(res.body.result.totalMarks).toBe(78);

      const history = await prisma.resultVersionHistory.findMany({
        where: { resultId: publishedResultId },
        orderBy: { versionNumber: 'desc' },
      });

      expect(history.length).toBe(2);
      expect(history[0].versionNumber).toBe(2);
      expect(history[0].changeType).toBe('NORMAL_FACULTY_CORRECTION');
    });
  });

  describe('Part 2: Privileged Direct Examination Admin Correction Pathway (Section 8.1 & 8.2)', () => {
    it('rejects direct correction with ineligible category (e.g. academic re-evaluation)', async () => {
      const res = await request(app)
        .post(`/api/results/${publishedResultId}/direct-correction`)
        .set('Authorization', `Bearer ${cseExamAdminToken}`)
        .send({
          expectedVersion: initialVersion + 1,
          category: 'ACADEMIC_RE_EVALUATION',
          reason: 'Judge requested grade change without workflow',
          evidenceReference: 'OMR-1234',
          internalMarks: 38,
          externalMarks: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INELIGIBLE_CORRECTION_CATEGORY');
      expect(res.body.message).toContain('Disputed evaluations must use normal faculty workflow');
    });

    it('rejects direct correction when mandatory authoritative evidence reference is missing', async () => {
      const res = await request(app)
        .post(`/api/results/${publishedResultId}/direct-correction`)
        .set('Authorization', `Bearer ${cseExamAdminToken}`)
        .send({
          expectedVersion: initialVersion + 1,
          category: 'TRANSCRIPTION_ERROR',
          reason: 'Data entry typo fix',
          evidenceReference: '',
          internalMarks: 38,
          externalMarks: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects direct correction from Examination Admin of a DIFFERENT branch (EEE Admin targeting CSE)', async () => {
      const res = await request(app)
        .post(`/api/results/${publishedResultId}/direct-correction`)
        .set('Authorization', `Bearer ${eeeExamAdminToken}`)
        .send({
          expectedVersion: initialVersion + 1,
          category: 'TRANSCRIPTION_ERROR',
          reason: 'Cross branch unauthorized tampering attempt',
          evidenceReference: 'DOC-CROSS-BRANCH-FAIL',
          internalMarks: 38,
          externalMarks: 50,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN_BRANCH_SCOPE');
      expect(res.body.message).toContain('You are not the designated Examination Admin for this branch');
    });

    it('rejects direct correction attempt by Academic Admin', async () => {
      const res = await request(app)
        .post(`/api/results/${publishedResultId}/direct-correction`)
        .set('Authorization', `Bearer ${acadAdminToken}`)
        .send({
          expectedVersion: initialVersion + 1,
          category: 'TRANSCRIPTION_ERROR',
          reason: 'Academic admin trying exam correction',
          evidenceReference: 'ADMIN-OVERRIDE-FAIL',
          internalMarks: 38,
          externalMarks: 50,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('rejects direct correction if expectedVersion is stale (OCC check)', async () => {
      const res = await request(app)
        .post(`/api/results/${publishedResultId}/direct-correction`)
        .set('Authorization', `Bearer ${cseExamAdminToken}`)
        .send({
          expectedVersion: 1, // Stale! Current version is 2
          category: 'TRANSCRIPTION_ERROR',
          reason: 'Stale version correction submission',
          evidenceReference: 'OMR-CSE-2024-998',
          internalMarks: 38,
          externalMarks: 50,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONCURRENT_MODIFICATION_CONFLICT');
    });

    it('successfully executes direct correction with eligible category, evidence reference, and current version', async () => {
      const res = await request(app)
        .post(`/api/results/${publishedResultId}/direct-correction`)
        .set('Authorization', `Bearer ${cseExamAdminToken}`)
        .send({
          expectedVersion: initialVersion + 1,
          category: 'TRANSCRIPTION_ERROR',
          reason: 'End-sem external marks transcription correction from physical signed OMR ledger',
          evidenceReference: 'OMR-LEDGER-CSE-2024-SHEET-42',
          internalMarks: 36,
          externalMarks: 56,
        });

      expect(res.status).toBe(200);
      expect(res.body.result.currentVersion).toBe(initialVersion + 2);
      expect(res.body.result.totalMarks).toBe(92);
      expect(res.body.result.grade).toBe('O');
      expect(res.body.result.gradePoint).toBe(10);
      expect(res.body.result.isPassed).toBe(true);
      expect(res.body.result.cgpaStatus).toBe('OFFICIAL');

      const historyRecord = await prisma.resultVersionHistory.findFirst({
        where: {
          resultId: publishedResultId,
          versionNumber: initialVersion + 2,
        },
      });

      expect(historyRecord).not.toBeNull();
      expect(historyRecord?.changeType).toBe('DIRECT_ADMIN_CORRECTION');
      expect(historyRecord?.correctionCategory).toBe('TRANSCRIPTION_ERROR');
      expect(historyRecord?.evidenceReference).toBe('OMR-LEDGER-CSE-2024-SHEET-42');
      expect(historyRecord?.totalMarks).toBe(92);
      expect(historyRecord?.grade).toBe('O');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'DIRECT_RESULT_CORRECTION',
          entityId: publishedResultId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('TRANSCRIPTION_ERROR');
      expect(auditLog?.evidenceRef).toBe('OMR-LEDGER-CSE-2024-SHEET-42');
    });
  });
});
