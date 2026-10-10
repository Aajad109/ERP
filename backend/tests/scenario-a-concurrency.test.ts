import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma';
import { seedDatabase } from '../src/prisma/seed';

describe('Scenario A: Concurrent Faculty Edits (Optimistic Concurrency Control)', () => {
  let facultyToken: string;
  let markId: string;
  let initialVersion: number;

  beforeAll(async () => {
    await seedDatabase();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alan.turing@college.edu', password: 'Faculty@123' });

    expect(loginRes.status).toBe(200);
    facultyToken = loginRes.body.token;

    const mark = await prisma.assessmentMark.findFirst({
      where: { recordedByFacultyId: loginRes.body.user.id },
      include: { component: true },
    });

    expect(mark).not.toBeNull();
    markId = mark!.id;
    initialVersion = mark!.version;
  });

  it('demonstrates that Faculty A advances version while stale Faculty B edit is rejected with HTTP 409', async () => {
    // Faculty A submits update first with expectedVersion = initialVersion
    const facultyARes = await request(app)
      .put(`/api/marks/${markId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        expectedVersion: initialVersion,
        marksObtained: 14.5,
      });

    expect(facultyARes.status).toBe(200);
    expect(facultyARes.body.mark.version).toBe(initialVersion + 1);
    expect(facultyARes.body.mark.marksObtained).toBe(14.5);

    // Faculty B submits stale update with expectedVersion = initialVersion
    const facultyBRes = await request(app)
      .put(`/api/marks/${markId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        expectedVersion: initialVersion,
        marksObtained: 10.0,
      });

    expect(facultyBRes.status).toBe(409);
    expect(facultyBRes.body.error).toBe('CONCURRENT_MODIFICATION_CONFLICT');
    expect(facultyBRes.body.currentVersion).toBe(initialVersion + 1);
    expect(facultyBRes.body.staleVersion).toBe(initialVersion);

    // DB verification
    const persistentRecord = await prisma.assessmentMark.findUnique({
      where: { id: markId },
    });

    expect(persistentRecord?.version).toBe(initialVersion + 1);
    expect(persistentRecord?.marksObtained).toBe(14.5);

    // Reload and retry
    const retryRes = await request(app)
      .put(`/api/marks/${markId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        expectedVersion: initialVersion + 1,
        marksObtained: 15.0,
      });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.mark.version).toBe(initialVersion + 2);
    expect(retryRes.body.mark.marksObtained).toBe(15.0);
  });
});
