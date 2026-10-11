import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { logAuditEvent } from '../../middleware/audit';
import { saveBase64Image } from '../../utils/storage';

export const campusHubRouter = Router();


// ============================================================================
// 1. LOST & FOUND ENDPOINTS
// ============================================================================

const createItemSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(1000),
  type: z.enum(['LOST', 'FOUND']),
  category: z.string().min(2),
  location: z.string().min(2),
  imageData: z.string().optional(),
});

campusHubRouter.get('/lost-found', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, status, category, search } = req.query;

    const whereClause: any = {};
    if (type && type !== 'ALL' && type !== 'undefined' && (type === 'LOST' || type === 'FOUND')) {
      whereClause.type = type;
    }
    if (status && status !== 'ALL' && status !== 'undefined' && (status === 'OPEN' || status === 'CLAIMED' || status === 'RESOLVED')) {
      whereClause.status = status;
    }
    if (category && category !== 'ALL' && category !== 'undefined' && String(category).trim() !== '') {
      whereClause.category = String(category);
    }
    if (search && search !== 'undefined' && String(search).trim() !== '') {
      const s = String(search).trim();
      whereClause.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { location: { contains: s, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.lostAndFoundItem.findMany({
      where: whereClause,
      include: {
        reportedBy: { select: { id: true, name: true, role: true, email: true } },
        claimedBy: { select: { id: true, name: true, role: true } },
        claims: {
          include: {
            claimant: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ items });
  } catch (err: any) {
    console.error('Get lost & found error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

campusHubRouter.post('/lost-found', authenticateToken, async (req: Request, res: Response) => {
  try {
    const parseResult = createItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    }

    const { title, description, type, category, location, imageData } = parseResult.data;

    let imageUrl: string | null = null;
    if (imageData) {
      imageUrl = saveBase64Image(imageData);
    }

    const item = await prisma.lostAndFoundItem.create({
      data: {
        title,
        description,
        type,
        category,
        location,
        imageUrl,
        reportedById: req.user!.id,
      },
      include: {
        reportedBy: { select: { id: true, name: true, role: true } },
        claims: true,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'LOST_AND_FOUND_ITEM_REPORTED',
      entityType: 'LostAndFoundItem',
      entityId: item.id,
      newData: item,
      req,
    });

    return res.status(201).json({ message: 'Item reported successfully', item });
  } catch (err: any) {
    console.error('Create item error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

const claimSchema = z.object({
  proofDescription: z.string().min(5, 'Proof description must be at least 5 characters'),
  contactInfo: z.string().min(5, 'Contact details must be at least 5 characters'),
});

campusHubRouter.post('/lost-found/:id/claim', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = claimSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    }

    const item = await prisma.lostAndFoundItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Item not found' });
    }

    if (item.status === 'RESOLVED') {
      return res.status(400).json({ error: 'ALREADY_RESOLVED', message: 'Item case is already resolved' });
    }

    if (item.reportedById === req.user!.id) {
      return res.status(400).json({ error: 'SELF_CLAIM', message: 'You cannot claim an item you reported' });
    }

    const claim = await prisma.itemClaim.create({
      data: {
        itemId: id,
        claimantId: req.user!.id,
        proofDescription: parseResult.data.proofDescription,
        contactInfo: parseResult.data.contactInfo,
      },
      include: {
        claimant: { select: { id: true, name: true, email: true } },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ITEM_CLAIM_SUBMITTED',
      entityType: 'ItemClaim',
      entityId: claim.id,
      newData: claim,
      req,
    });

    return res.status(201).json({ message: 'Claim submitted successfully', claim });
  } catch (err: any) {
    console.error('Submit claim error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

campusHubRouter.put('/lost-found/:id/claims/:claimId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, claimId } = req.params;
    const { status, reviewNotes } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be APPROVED or REJECTED' });
    }

    const item = await prisma.lostAndFoundItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Item not found' });
    }

    // Only the reporter or Admin can review claims
    const isReporter = item.reportedById === req.user!.id;
    const isAdmin = req.user!.role === 'ACADEMIC_ADMIN' || req.user!.role === 'EXAM_ADMIN';
    if (!isReporter && !isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only the reporter or admin can review claims' });
    }

    const claim = await prisma.itemClaim.findUnique({ where: { id: claimId } });
    if (!claim || claim.itemId !== id) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Claim not found for this item' });
    }

    const updatedClaim = await prisma.itemClaim.update({
      where: { id: claimId },
      data: {
        status,
        reviewNotes: reviewNotes || null,
        resolvedAt: new Date(),
      },
    });

    if (status === 'APPROVED') {
      await prisma.lostAndFoundItem.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          claimedById: claim.claimantId,
        },
      });
    }

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `ITEM_CLAIM_${status}`,
      entityType: 'ItemClaim',
      entityId: claimId,
      newData: updatedClaim,
      req,
    });

    return res.json({ message: `Claim ${status.toLowerCase()} successfully`, claim: updatedClaim });
  } catch (err: any) {
    console.error('Review claim error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

campusHubRouter.put('/lost-found/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['OPEN', 'CLAIMED', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Invalid status' });
    }

    const item = await prisma.lostAndFoundItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Item not found' });
    }

    const isReporter = item.reportedById === req.user!.id;
    const isAdmin = req.user!.role === 'ACADEMIC_ADMIN' || req.user!.role === 'EXAM_ADMIN';
    if (!isReporter && !isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only the reporter or admin can update status' });
    }

    const updatedItem = await prisma.lostAndFoundItem.update({
      where: { id },
      data: { status },
    });

    return res.json({ message: 'Item status updated', item: updatedItem });
  } catch (err: any) {
    console.error('Update item status error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// ============================================================================
// 2. TRENDING EVENTS ENDPOINTS
// ============================================================================

const createEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  category: z.string().min(2),
  venue: z.string().min(2),
  eventDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  departmentId: z.string().uuid().optional().nullable().or(z.literal('')),
  bannerData: z.string().optional(),
});

campusHubRouter.get('/events', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { category, departmentId } = req.query;

    const whereClause: any = {};
    if (category && category !== 'ALL' && category !== 'undefined' && String(category).trim() !== '') {
      whereClause.category = String(category);
    }
    if (departmentId && departmentId !== 'undefined' && departmentId !== 'ALL' && String(departmentId).trim() !== '') {
      whereClause.departmentId = String(departmentId);
    }

    const events = await prisma.campusEvent.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        department: { select: { id: true, code: true, name: true } },
        upvotes: { select: { userId: true } },
        rsvps: { select: { userId: true, status: true } },
      },
      orderBy: { eventDate: 'asc' },
    });

    const currentUserId = req.user!.id;

    // Map events with trending score, upvote count, user status
    const enrichedEvents = events.map((ev) => {
      const upvotesCount = ev.upvotes.length;
      const attendingCount = ev.rsvps.filter((r) => r.status === 'ATTENDING').length;
      const interestedCount = ev.rsvps.filter((r) => r.status === 'INTERESTED').length;
      const hasUpvoted = ev.upvotes.some((u) => u.userId === currentUserId);
      const userRsvp = ev.rsvps.find((r) => r.userId === currentUserId)?.status || null;

      // Calculate trending weight: Upvotes (2 pts) + RSVPs (1 pt)
      const trendingScore = upvotesCount * 2 + attendingCount + interestedCount;

      return {
        id: ev.id,
        title: ev.title,
        description: ev.description,
        category: ev.category,
        venue: ev.venue,
        eventDate: ev.eventDate,
        bannerUrl: ev.bannerUrl,
        createdBy: ev.createdBy,
        department: ev.department,
        createdAt: ev.createdAt,
        upvotesCount,
        attendingCount,
        interestedCount,
        trendingScore,
        hasUpvoted,
        userRsvp,
      };
    });

    // Sort by trending score descending
    enrichedEvents.sort((a, b) => b.trendingScore - a.trendingScore);

    return res.json({ events: enrichedEvents });
  } catch (err: any) {
    console.error('Get events error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

campusHubRouter.post('/events', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'STUDENT') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Students are not authorized to create campus events. Only Faculty and Academic Administrators may publish campus events.',
      });
    }

    const parseResult = createEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    }

    const { title, description, category, venue, eventDate, departmentId, bannerData } = parseResult.data;

    let bannerUrl: string | null = null;
    if (bannerData) {
      bannerUrl = saveBase64Image(bannerData);
    }

    const event = await prisma.campusEvent.create({
      data: {
        title,
        description,
        category,
        venue,
        eventDate: new Date(eventDate),
        departmentId: departmentId || null,
        bannerUrl,
        createdById: req.user!.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'CAMPUS_EVENT_CREATED',
      entityType: 'CampusEvent',
      entityId: event.id,
      newData: event,
      req,
    });

    return res.status(201).json({ message: 'Event created successfully', event });
  } catch (err: any) {
    console.error('Create event error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

campusHubRouter.post('/events/:id/upvote', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const event = await prisma.campusEvent.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Event not found' });
    }

    const existingUpvote = await prisma.eventUpvote.findUnique({
      where: { eventId_userId: { eventId: id, userId } },
    });

    let hasUpvoted = false;
    if (existingUpvote) {
      await prisma.eventUpvote.delete({
        where: { id: existingUpvote.id },
      });
      hasUpvoted = false;
    } else {
      await prisma.eventUpvote.create({
        data: { eventId: id, userId },
      });
      hasUpvoted = true;
    }

    const count = await prisma.eventUpvote.count({ where: { eventId: id } });

    return res.json({ hasUpvoted, upvotesCount: count });
  } catch (err: any) {
    console.error('Toggle upvote error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

campusHubRouter.post('/events/:id/rsvp', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { status } = req.body; // 'ATTENDING', 'INTERESTED', or 'REMOVE'

    const event = await prisma.campusEvent.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Event not found' });
    }

    if (status === 'REMOVE') {
      await prisma.eventRsvp.deleteMany({
        where: { eventId: id, userId },
      });
    } else if (status === 'ATTENDING' || status === 'INTERESTED') {
      await prisma.eventRsvp.upsert({
        where: { eventId_userId: { eventId: id, userId } },
        create: { eventId: id, userId, status },
        update: { status },
      });
    } else {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be ATTENDING, INTERESTED, or REMOVE' });
    }

    const [attendingCount, interestedCount] = await Promise.all([
      prisma.eventRsvp.count({ where: { eventId: id, status: 'ATTENDING' } }),
      prisma.eventRsvp.count({ where: { eventId: id, status: 'INTERESTED' } }),
    ]);

    return res.json({
      userRsvp: status === 'REMOVE' ? null : status,
      attendingCount,
      interestedCount,
    });
  } catch (err: any) {
    console.error('RSVP error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});
