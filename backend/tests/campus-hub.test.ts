import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma';
import { seedDatabase } from '../src/prisma/seed';

describe('Phase 2: Campus Hub (Lost & Found + Trending Events)', () => {
  let studentRahulToken: string;
  let studentPriyaToken: string;
  let facultyToken: string;

  beforeAll(async () => {
    await seedDatabase();

    const rahulLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rahul.cse@college.edu', password: 'Student@123' });
    expect(rahulLogin.status).toBe(200);
    studentRahulToken = rahulLogin.body.token;

    const priyaLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'priya.cse@college.edu', password: 'Student@123' });
    expect(priyaLogin.status).toBe(200);
    studentPriyaToken = priyaLogin.body.token;

    const turingLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alan.turing@college.edu', password: 'Faculty@123' });
    expect(turingLogin.status).toBe(200);
    facultyToken = turingLogin.body.token;
  });

  // -------------------------------------------------------------------------
  // 1. Lost & Found Tests
  // -------------------------------------------------------------------------
  describe('Lost & Found Portal', () => {
    let createdItemId: string;

    it('fetches existing seeded lost and found items', async () => {
      const res = await request(app)
        .get('/api/hub/lost-found')
        .set('Authorization', `Bearer ${studentRahulToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    });

    it('allows a student to report a found item', async () => {
      const res = await request(app)
        .post('/api/hub/lost-found')
        .set('Authorization', `Bearer ${studentRahulToken}`)
        .send({
          title: 'Blue Water Bottle (Milton 1L)',
          description: 'Found left behind on bench near the basketball court.',
          type: 'FOUND',
          category: 'Other',
          location: 'Sports Complex Bench 3',
        });

      expect(res.status).toBe(201);
      expect(res.body.item.title).toBe('Blue Water Bottle (Milton 1L)');
      expect(res.body.item.status).toBe('OPEN');
      createdItemId = res.body.item.id;
    });

    it('prevents reporter from claiming their own item', async () => {
      const res = await request(app)
        .post(`/api/hub/lost-found/${createdItemId}/claim`)
        .set('Authorization', `Bearer ${studentRahulToken}`)
        .send({
          proofDescription: 'This is mine',
          contactInfo: 'rahul@college.edu',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('SELF_CLAIM');
    });

    it('allows another user to submit a claim with verification proof', async () => {
      const res = await request(app)
        .post(`/api/hub/lost-found/${createdItemId}/claim`)
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .send({
          proofDescription: 'Has a small scratch near the cap and my initials PK at the base',
          contactInfo: 'priya.cse@college.edu, +91 9876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.claim.status).toBe('PENDING');
      expect(res.body.claim.proofDescription).toContain('initials PK');

      const claimId = res.body.claim.id;

      // Item reporter approves the claim
      const approveRes = await request(app)
        .put(`/api/hub/lost-found/${createdItemId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${studentRahulToken}`)
        .send({
          status: 'APPROVED',
          reviewNotes: 'Scratch and initials matched, handed over at canteen.',
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.claim.status).toBe('APPROVED');

      // Verify item status transitioned to RESOLVED
      const itemCheck = await prisma.lostAndFoundItem.findUnique({ where: { id: createdItemId } });
      expect(itemCheck?.status).toBe('RESOLVED');
      expect(itemCheck?.claimedById).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Trending Events Tests
  // -------------------------------------------------------------------------
  describe('Trending Events Portal', () => {
    let hackathonEventId: string;

    it('fetches campus events ranked by trending score', async () => {
      const res = await request(app)
        .get('/api/hub/events')
        .set('Authorization', `Bearer ${studentRahulToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBeGreaterThanOrEqual(3);

      hackathonEventId = res.body.events[0].id;
      // Trending scores should be in descending order
      const scores = res.body.events.map((e: any) => e.trendingScore);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    });

    it('toggles event upvote dynamically', async () => {
      // Priya toggles upvote
      const upvoteRes1 = await request(app)
        .post(`/api/hub/events/${hackathonEventId}/upvote`)
        .set('Authorization', `Bearer ${studentPriyaToken}`);

      expect(upvoteRes1.status).toBe(200);
      const wasUpvoted = upvoteRes1.body.hasUpvoted;

      // Toggle again to invert
      const upvoteRes2 = await request(app)
        .post(`/api/hub/events/${hackathonEventId}/upvote`)
        .set('Authorization', `Bearer ${studentPriyaToken}`);

      expect(upvoteRes2.status).toBe(200);
      expect(upvoteRes2.body.hasUpvoted).toBe(!wasUpvoted);
    });

    it('updates event RSVP status and counts', async () => {
      const rsvpRes = await request(app)
        .post(`/api/hub/events/${hackathonEventId}/rsvp`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ status: 'ATTENDING' });

      expect(rsvpRes.status).toBe(200);
      expect(rsvpRes.body.userRsvp).toBe('ATTENDING');
      expect(rsvpRes.body.attendingCount).toBeGreaterThanOrEqual(1);
    });

    it('allows faculty or admin to create a new campus event', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const createRes = await request(app)
        .post('/api/hub/events')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          title: 'Guest Lecture: Scalable System Architecture at Google Scale',
          description: 'A deep dive into distributed consensus, Spanner, and site reliability engineering.',
          category: 'Technical',
          venue: 'Auditorium Hall 1',
          eventDate: nextWeek.toISOString(),
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.event.title).toContain('Google Scale');
    });
  });
});
