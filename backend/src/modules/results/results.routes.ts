import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { requireRole, verifyStudentOwnership } from '../../middleware/rbac';
import { logAuditEvent } from '../../middleware/audit';
import {
  calculateGrade,
  calculateSGPA,
  evaluateCGPA,
  isDirectCorrectionEligible,
  ELIGIBLE_DIRECT_CORRECTION_CATEGORIES,
} from '../../utils/academic-rules';

export const resultsRouter = Router();

/**
 * Student views own published results (Scenario B target endpoint for IDOR tests)
 */
resultsRouter.get(
  '/student/:studentId',
  authenticateToken,
  verifyStudentOwnership,
  async (req: Request, res: Response) => {
    const { studentId } = req.params;

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: true, department: true, batch: true, section: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Student not found' });
    }

    const results = await prisma.publishedResult.findMany({
      where: { studentId },
      include: {
        offering: {
          include: {
            course: true,
          },
        },
        history: {
          orderBy: { versionNumber: 'desc' },
          include: { changedBy: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    // Compute student's CGPA evaluation dynamically across all published courses
    const courseResults = results.map((r) => ({
      credits: r.offering.course.credits,
      gradePoint: r.gradePoint,
      isPassed: r.isPassed,
    }));

    const cgpaEvaluation = evaluateCGPA(courseResults);

    return res.json({
      student,
      results,
      cgpaEvaluation,
    });
  }
);

/**
 * Get results for a course offering
 */
resultsRouter.get('/offering/:offeringId', authenticateToken, async (req: Request, res: Response) => {
  const { offeringId } = req.params;

  const offering = await prisma.courseOffering.findUnique({
    where: { id: offeringId },
    include: {
      course: { include: { department: true } },
      batch: true,
      section: true,
      enrollments: {
        include: {
          student: { include: { user: true } },
        },
      },
    },
  });

  if (!offering) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Course offering not found' });
  }

  const publishedResults = await prisma.publishedResult.findMany({
    where: { offeringId },
    include: {
      student: { include: { user: true } },
      offering: { include: { course: true } },
      history: { orderBy: { versionNumber: 'desc' } },
    },
  });

  const assessmentMarks = await prisma.assessmentMark.findMany({
    where: { offeringId },
    include: { component: true },
  });

  const resultMap = new Map(publishedResults.map((r) => [r.studentId, r]));

  const combinedResults = offering.enrollments.map((enr) => {
    const existing = resultMap.get(enr.studentId);
    if (existing) {
      return existing;
    }

    const studentMarks = assessmentMarks.filter(
      (m) => m.studentId === enr.studentId && m.component?.type === 'INTERNAL' && m.marksObtained !== null
    );
    const internalSum = Math.min(40, studentMarks.reduce((acc, m) => acc + (m.marksObtained || 0), 0));

    return {
      id: `draft-${enr.studentId}`,
      offeringId,
      studentId: enr.studentId,
      internalMarks: internalSum,
      externalMarks: 0,
      totalMarks: internalSum,
      grade: '-',
      gradePoint: 0,
      currentVersion: 0,
      publicationState: 'DRAFT',
      isPassed: false,
      student: enr.student,
      offering,
      history: [],
      isDraft: true,
    };
  });

  // Also include any published results for students not in enrollments
  const enrolledStudentIds = new Set(offering.enrollments.map((e) => e.studentId));
  for (const pr of publishedResults) {
    if (!enrolledStudentIds.has(pr.studentId)) {
      combinedResults.push(pr as any);
    }
  }

  return res.json({ results: combinedResults });
});

/**
 * Get version history for a specific result
 */
resultsRouter.get('/:resultId/history', authenticateToken, async (req: Request, res: Response) => {
  const { resultId } = req.params;
  const history = await prisma.resultVersionHistory.findMany({
    where: { resultId },
    include: {
      changedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: { versionNumber: 'desc' },
  });
  return res.json({ history });
});

/**
 * Initial Publication of Result by Designated Examination Admin
 */
const publishSchema = z.object({
  offeringId: z.string().uuid(),
  studentId: z.string().uuid(),
  internalMarks: z.number().min(0).max(40),
  externalMarks: z.number().min(0).max(60),
  isAbsent: z.boolean().optional(),
});

resultsRouter.post(
  '/publish',
  authenticateToken,
  requireRole('EXAM_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parseResult = publishSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { offeringId, studentId, internalMarks, externalMarks, isAbsent } = parseResult.data;

      const offering = await prisma.courseOffering.findUnique({
        where: { id: offeringId },
        include: { course: true },
      });
      if (!offering) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Offering not found' });
      }

      // Check branch designation
      if (req.user!.designatedDepartmentId !== offering.course.departmentId) {
        return res.status(403).json({
          error: 'FORBIDDEN_BRANCH_SCOPE',
          message: 'You are not the designated Examination Admin for this branch.',
        });
      }

      const totalMarks = Math.round((internalMarks + externalMarks) * 100) / 100;
      const gradeResult = calculateGrade(internalMarks, externalMarks, isAbsent);

      // Check existing results for CGPA calculation
      const existingResults = await prisma.publishedResult.findMany({
        where: { studentId },
        include: { offering: { include: { course: true } } },
      });

      const allCourses = [
        ...existingResults.map((r) => ({
          credits: r.offering.course.credits,
          gradePoint: r.gradePoint,
          isPassed: r.isPassed,
        })),
        {
          credits: offering.course.credits,
          gradePoint: gradeResult.gradePoint,
          isPassed: gradeResult.isPassed,
        },
      ];

      const sgpa = calculateSGPA(allCourses);
      const cgpaEval = evaluateCGPA(allCourses);

      const publishedResult = await prisma.$transaction(async (tx) => {
        const result = await tx.publishedResult.upsert({
          where: { offeringId_studentId: { offeringId, studentId } },
          create: {
            offeringId,
            studentId,
            currentVersion: 1,
            internalMarks,
            externalMarks,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa,
            cgpa: cgpaEval.cgpa,
            cgpaStatus: cgpaEval.cgpaStatus,
            publicationState: 'PUBLISHED',
            publishedByExamAdminId: req.user!.id,
          },
          update: {
            currentVersion: { increment: 1 },
            internalMarks,
            externalMarks,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa,
            cgpa: cgpaEval.cgpa,
            cgpaStatus: cgpaEval.cgpaStatus,
            publicationState: 'PUBLISHED',
            publishedByExamAdminId: req.user!.id,
          },
        });

        await tx.resultVersionHistory.create({
          data: {
            resultId: result.id,
            versionNumber: result.currentVersion,
            internalMarks,
            externalMarks,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa,
            cgpa: cgpaEval.cgpa,
            cgpaStatus: cgpaEval.cgpaStatus,
            changeType: 'INITIAL_PUBLICATION',
            reason: 'Initial exam result publication',
            changedByUserId: req.user!.id,
          },
        });

        return result;
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'RESULT_PUBLISHED',
        entityType: 'PublishedResult',
        entityId: publishedResult.id,
        departmentId: offering.course.departmentId,
        newData: publishedResult,
        req,
      });

      return res.status(201).json({
        message: 'Result published successfully',
        result: publishedResult,
      });
    } catch (err: any) {
      console.error('Publish error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

/**
 * Privileged Direct Examination Admin Correction (Section 8.1 & 8.2)
 * Scenario C target endpoint: Verifies eligible category, evidence, branch, and OCC version.
 */
const directCorrectionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  category: z.string(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  evidenceReference: z.string().min(3, 'Authoritative evidence reference is mandatory'),
  internalMarks: z.number().min(0).max(40),
  externalMarks: z.number().min(0).max(60),
  isAbsent: z.boolean().optional(),
});

resultsRouter.post(
  '/:resultId/direct-correction',
  authenticateToken,
  requireRole('EXAM_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { resultId } = req.params;
      const parseResult = directCorrectionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { expectedVersion, category, reason, evidenceReference, internalMarks, externalMarks, isAbsent } =
        parseResult.data;

      // 1. Category Eligibility Check
      if (!isDirectCorrectionEligible(category)) {
        await logAuditEvent({
          actorUserId: req.user!.id,
          actorRole: req.user!.role,
          action: 'DIRECT_CORRECTION_INELIGIBLE_CATEGORY_REJECTED',
          entityType: 'PublishedResult',
          entityId: resultId,
          category,
          evidenceRef: evidenceReference,
          reason: `Attempted direct correction with ineligible category '${category}'. Permitted: [${ELIGIBLE_DIRECT_CORRECTION_CATEGORIES.join(', ')}]`,
          req,
        });

        return res.status(400).json({
          error: 'INELIGIBLE_CORRECTION_CATEGORY',
          message: `Category '${category}' is not eligible for direct correction. Permitted categories: [${ELIGIBLE_DIRECT_CORRECTION_CATEGORIES.join(', ')}]. Disputed evaluations must use normal faculty workflow.`,
        });
      }

      // 2. Fetch current published result
      const currentResult = await prisma.publishedResult.findUnique({
        where: { id: resultId },
        include: {
          offering: { include: { course: true } },
          student: true,
        },
      });

      if (!currentResult) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Published result record not found' });
      }

      // 3. Branch Designation Check
      const offeringBranchId = currentResult.offering.course.departmentId;
      if (req.user!.designatedDepartmentId !== offeringBranchId) {
        await logAuditEvent({
          actorUserId: req.user!.id,
          actorRole: req.user!.role,
          action: 'EXAM_ADMIN_WRONG_BRANCH_CORRECTION_ATTEMPT',
          entityType: 'PublishedResult',
          entityId: resultId,
          departmentId: offeringBranchId,
          reason: `Exam Admin designated for ${req.user!.designatedDepartmentId} attempted correction in branch ${offeringBranchId}`,
          req,
        });

        return res.status(403).json({
          error: 'FORBIDDEN_BRANCH_SCOPE',
          message: 'You are not the designated Examination Admin for this branch.',
        });
      }

      // 4. Stale Version / Optimistic Concurrency Check
      if (currentResult.currentVersion !== expectedVersion) {
        await logAuditEvent({
          actorUserId: req.user!.id,
          actorRole: req.user!.role,
          action: 'STALE_RESULT_CORRECTION_CONFLICT',
          entityType: 'PublishedResult',
          entityId: resultId,
          reason: `Expected version ${expectedVersion} does not match database version ${currentResult.currentVersion}`,
          req,
        });

        return res.status(409).json({
          error: 'CONCURRENT_MODIFICATION_CONFLICT',
          message: 'Result has been modified by another transaction. Please reload current version before correcting.',
          currentVersion: currentResult.currentVersion,
          staleVersion: expectedVersion,
        });
      }

      // 5. Recalculate derived grade, SGPA, and CGPA
      const totalMarks = Math.round((internalMarks + externalMarks) * 100) / 100;
      const gradeResult = calculateGrade(internalMarks, externalMarks, isAbsent);

      // Fetch other student results for CGPA recalculation
      const otherResults = await prisma.publishedResult.findMany({
        where: {
          studentId: currentResult.studentId,
          id: { not: resultId },
        },
        include: { offering: { include: { course: true } } },
      });

      const allCourses = [
        ...otherResults.map((r) => ({
          credits: r.offering.course.credits,
          gradePoint: r.gradePoint,
          isPassed: r.isPassed,
        })),
        {
          credits: currentResult.offering.course.credits,
          gradePoint: gradeResult.gradePoint,
          isPassed: gradeResult.isPassed,
        },
      ];

      const newSgpa = calculateSGPA(allCourses);
      const newCgpaEval = evaluateCGPA(allCourses);
      const nextVersion = currentResult.currentVersion + 1;

      // 6. Execute atomic correction transaction
      const updated = await prisma.$transaction(async (tx) => {
        // Update PublishedResult to next version
        const resRecord = await tx.publishedResult.update({
          where: { id: resultId },
          data: {
            currentVersion: nextVersion,
            internalMarks,
            externalMarks,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa: newSgpa,
            cgpa: newCgpaEval.cgpa,
            cgpaStatus: newCgpaEval.cgpaStatus,
            publicationState: 'PUBLISHED',
            updatedAt: new Date(),
          },
        });

        // Create immutable version history record
        const historyRecord = await tx.resultVersionHistory.create({
          data: {
            resultId,
            versionNumber: nextVersion,
            internalMarks,
            externalMarks,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa: newSgpa,
            cgpa: newCgpaEval.cgpa,
            cgpaStatus: newCgpaEval.cgpaStatus,
            changeType: 'DIRECT_ADMIN_CORRECTION',
            correctionCategory: category,
            evidenceReference,
            reason,
            changedByUserId: req.user!.id,
          },
        });

        return { resRecord, historyRecord };
      });

      // 7. Audit log
      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'DIRECT_RESULT_CORRECTION',
        entityType: 'PublishedResult',
        entityId: resultId,
        departmentId: offeringBranchId,
        category,
        evidenceRef: evidenceReference,
        reason,
        oldData: {
          version: currentResult.currentVersion,
          internal: currentResult.internalMarks,
          external: currentResult.externalMarks,
          total: currentResult.totalMarks,
          grade: currentResult.grade,
          cgpaStatus: currentResult.cgpaStatus,
        },
        newData: {
          version: nextVersion,
          internal: internalMarks,
          external: externalMarks,
          total: totalMarks,
          grade: gradeResult.grade,
          cgpaStatus: newCgpaEval.cgpaStatus,
        },
        req,
      });

      return res.json({
        message: 'Direct examination correction executed successfully',
        result: updated.resRecord,
        history: updated.historyRecord,
      });
    } catch (err: any) {
      console.error('Direct correction error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

/**
 * Normal Student Correction Request Pathway
 */
const requestCorrectionSchema = z.object({
  reason: z.string().min(5),
  requestedMarks: z.number().min(0).max(100).optional(),
});

/**
 * Fetch Correction Requests for Student, Faculty, or Exam Admin
 */
resultsRouter.get('/correction-requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userRole = req.user!.role;
    let whereClause: any = {};

    if (userRole === 'STUDENT') {
      const student = await prisma.studentProfile.findFirst({
        where: { userId: req.user!.id },
      });
      if (!student) {
        return res.json({ requests: [] });
      }
      whereClause.studentId = student.id;
    } else if (userRole === 'FACULTY') {
      const assignments = await prisma.teachingAssignment.findMany({
        where: { facultyId: req.user!.id, isActive: true },
        select: { offeringId: true },
      });
      const offeringIds = assignments.map((a) => a.offeringId);
      whereClause.offeringId = { in: offeringIds };
    } else if (userRole === 'EXAM_ADMIN') {
      if (req.user!.designatedDepartmentId) {
        whereClause.offering = {
          course: {
            departmentId: req.user!.designatedDepartmentId,
          },
        };
      }
    }

    const requests = await prisma.correctionRequest.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            department: true,
            batch: true,
            section: true,
          },
        },
        offering: {
          include: {
            course: true,
            batch: true,
            section: true,
            teachingAssignments: {
              where: { isActive: true },
              include: { faculty: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        result: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ requests });
  } catch (err: any) {
    console.error('Fetch correction requests error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

resultsRouter.post(
  '/:resultId/request-correction',
  authenticateToken,
  requireRole('STUDENT'),
  async (req: Request, res: Response) => {
    try {
      const { resultId } = req.params;
      const parseResult = requestCorrectionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { reason, requestedMarks } = parseResult.data;

      const result = await prisma.publishedResult.findUnique({
        where: { id: resultId },
      });
      if (!result) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Result not found' });
      }

      if (result.studentId !== req.user!.studentProfileId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only request corrections for your own results' });
      }

      const request = await prisma.correctionRequest.create({
        data: {
          resultId,
          studentId: result.studentId,
          offeringId: result.offeringId,
          reason,
          requestedMarks,
          status: 'PENDING_FACULTY',
        },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'CORRECTION_REQUEST_SUBMITTED',
        entityType: 'CorrectionRequest',
        entityId: request.id,
        reason,
        req,
      });

      return res.status(201).json({ message: 'Correction request submitted to faculty', request });
    } catch (err: any) {
      console.error('Request correction error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

/**
 * Faculty Reviews Correction Request (Proposes or Rejects)
 */
const facultyReviewSchema = z.object({
  action: z.enum(['PROPOSE', 'REJECT']),
  reason: z.string().min(5),
  proposedInternalMarks: z.number().min(0).max(40).optional(),
  proposedMarks: z.number().min(0).max(40).optional(),
  proposedExternalMarks: z.number().min(0).max(60).optional(),
});

resultsRouter.put(
  '/requests/:requestId/faculty-review',
  authenticateToken,
  requireRole('FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const parseResult = facultyReviewSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { action, reason } = parseResult.data;
      const proposedInternalMarks = parseResult.data.proposedInternalMarks ?? parseResult.data.proposedMarks;

      const corrRequest = await prisma.correctionRequest.findUnique({
        where: { id: requestId },
        include: { offering: true },
      });
      if (!corrRequest) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Request not found' });
      }

      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          offeringId: corrRequest.offeringId,
          facultyId: req.user!.id,
          isActive: true,
        },
      });

      if (!assignment) {
        return res.status(403).json({
          error: 'FORBIDDEN_TEACHING_SCOPE',
          message: 'You are not the assigned faculty for this course offering.',
        });
      }

      // If faculty approves/proposes internal marks correction, directly commit to PublishedResult
      let updatedResult = null;
      if (action === 'PROPOSE' && proposedInternalMarks !== undefined && corrRequest.resultId) {
        const currentResult = await prisma.publishedResult.findUnique({
          where: { id: corrRequest.resultId },
          include: { offering: { include: { course: true } } },
        });

        if (currentResult) {
          const totalMarks = Math.round((proposedInternalMarks + currentResult.externalMarks) * 100) / 100;
          const gradeResult = calculateGrade(proposedInternalMarks, currentResult.externalMarks);

          const allStudentResults = await prisma.publishedResult.findMany({
            where: { studentId: currentResult.studentId },
            include: { offering: { include: { course: true } } },
          });

          const allCourses = allStudentResults.map((r) =>
            r.id === currentResult.id
              ? { credits: r.offering.course.credits, gradePoint: gradeResult.gradePoint, isPassed: gradeResult.isPassed }
              : { credits: r.offering.course.credits, gradePoint: r.gradePoint, isPassed: r.isPassed }
          );

          const sgpa = calculateSGPA(allCourses);
          const cgpaEval = evaluateCGPA(allCourses);

          updatedResult = await prisma.$transaction(async (tx) => {
            const res = await tx.publishedResult.update({
              where: { id: currentResult.id },
              data: {
                currentVersion: { increment: 1 },
                internalMarks: proposedInternalMarks,
                totalMarks,
                grade: gradeResult.grade,
                gradePoint: gradeResult.gradePoint,
                isPassed: gradeResult.isPassed,
                sgpa,
                cgpa: cgpaEval.cgpa,
                cgpaStatus: cgpaEval.cgpaStatus,
              },
            });

            await tx.resultVersionHistory.create({
              data: {
                resultId: currentResult.id,
                versionNumber: res.currentVersion,
                internalMarks: proposedInternalMarks,
                externalMarks: currentResult.externalMarks,
                totalMarks,
                grade: gradeResult.grade,
                gradePoint: gradeResult.gradePoint,
                isPassed: gradeResult.isPassed,
                sgpa,
                cgpa: cgpaEval.cgpa,
                cgpaStatus: cgpaEval.cgpaStatus,
                changeType: 'FACULTY_INTERNAL_CORRECTION',
                correctionCategory: 'INTERNAL_EVALUATION_REVIEW',
                reason,
                changedByUserId: req.user!.id,
              },
            });

            return res;
          });
        }
      }

      const updatedRequest = await prisma.correctionRequest.update({
        where: { id: requestId },
        data: {
          status: action === 'PROPOSE' ? 'RESOLVED_BY_FACULTY' : 'REJECTED_BY_FACULTY',
          facultyReviewReason: reason,
          proposedMarks: proposedInternalMarks,
          reviewedByFacultyId: req.user!.id,
          updatedAt: new Date(),
        },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: action === 'PROPOSE' ? 'FACULTY_DIRECT_INTERNAL_CORRECTION' : 'FACULTY_REJECTED_CORRECTION',
        entityType: 'CorrectionRequest',
        entityId: requestId,
        reason,
        newData: { updatedRequest, updatedResult },
        req,
      });

      return res.json({
        message: `Internal marks correction resolved directly by faculty. Changes reflected across all portals.`,
        request: updatedRequest,
        result: updatedResult,
      });
    } catch (err: any) {
      console.error('Faculty review error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

/**
 * Designated Examination Admin Authorizes Proposed Normal Correction
 */
resultsRouter.put(
  '/requests/:requestId/admin-approve',
  authenticateToken,
  requireRole('EXAM_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      const corrRequest = await prisma.correctionRequest.findUnique({
        where: { id: requestId },
        include: {
          result: { include: { offering: { include: { course: true } } } },
        },
      });

      if (!corrRequest) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Correction request not found' });
      }

      if (corrRequest.status !== 'PROPOSED_BY_FACULTY' && corrRequest.status !== 'RESOLVED_BY_FACULTY') {
        return res.status(400).json({
          error: 'INVALID_STATE',
          message: 'Only requests reviewed by faculty can be authorized by Exam Admin',
        });
      }

      const deptId = corrRequest.result.offering.course.departmentId;
      if (req.user!.designatedDepartmentId !== deptId) {
        return res.status(403).json({
          error: 'FORBIDDEN_BRANCH_SCOPE',
          message: 'You are not the designated Examination Admin for this branch.',
        });
      }

      const nextVersion = corrRequest.result.currentVersion + 1;
      const newInternal = corrRequest.proposedMarks ?? corrRequest.result.internalMarks;
      const newExternal = corrRequest.result.externalMarks;
      const totalMarks = Math.round((newInternal + newExternal) * 100) / 100;
      const gradeRes = calculateGrade(newInternal, newExternal, false);

      const cgpaEval = evaluateCGPA([
        {
          credits: corrRequest.result.offering.course.credits,
          gradePoint: gradeRes.gradePoint,
          isPassed: gradeRes.isPassed,
        },
      ]);

      const result = await prisma.$transaction(async (tx) => {
        const updatedRes = await tx.publishedResult.update({
          where: { id: corrRequest.resultId },
          data: {
            currentVersion: nextVersion,
            internalMarks: newInternal,
            totalMarks,
            grade: gradeRes.grade,
            gradePoint: gradeRes.gradePoint,
            isPassed: gradeRes.isPassed,
            sgpa: gradeRes.gradePoint,
            cgpa: cgpaEval.cgpa,
            cgpaStatus: cgpaEval.cgpaStatus,
            updatedAt: new Date(),
          },
        });

        await tx.resultVersionHistory.create({
          data: {
            resultId: corrRequest.resultId,
            versionNumber: nextVersion,
            internalMarks: newInternal,
            externalMarks: newExternal,
            totalMarks,
            grade: gradeRes.grade,
            gradePoint: gradeRes.gradePoint,
            isPassed: gradeRes.isPassed,
            sgpa: gradeRes.gradePoint,
            cgpa: cgpaEval.cgpa,
            cgpaStatus: cgpaEval.cgpaStatus,
            changeType: 'NORMAL_FACULTY_CORRECTION',
            reason: reason || corrRequest.facultyReviewReason || 'Faculty approved correction',
            changedByUserId: req.user!.id,
          },
        });

        const reqDone = await tx.correctionRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED_BY_EXAM_ADMIN',
            examAdminReason: reason || 'Approved by branch Examination Admin',
            decidedByExamAdminId: req.user!.id,
          },
        });

        return { updatedRes, reqDone };
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'NORMAL_CORRECTION_APPROVED',
        entityType: 'PublishedResult',
        entityId: corrRequest.resultId,
        departmentId: deptId,
        reason,
        newData: result.updatedRes,
        req,
      });

      return res.json({ message: 'Correction authorized and published', result: result.updatedRes });
    } catch (err: any) {
      console.error('Admin approve error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// REVALUATION WORKFLOW
// ============================================================================

const revaluationApplySchema = z.object({
  reason: z.string().min(5),
});

resultsRouter.post(
  '/:resultId/revaluation',
  authenticateToken,
  requireRole('STUDENT'),
  async (req: Request, res: Response) => {
    try {
      const { resultId } = req.params;
      const parsed = revaluationApplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const result = await prisma.publishedResult.findUnique({
        where: { id: resultId },
        include: { offering: { include: { course: true } } },
      });

      if (!result) return res.status(404).json({ error: 'NOT_FOUND', message: 'Result not found' });
      if (result.studentId !== req.user!.studentProfileId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only apply for revaluation of your own results' });
      }

      // Check if already applied
      const existing = await prisma.revaluationRequest.findFirst({
        where: { resultId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      });
      if (existing) {
        return res.status(409).json({ error: 'ALREADY_EXISTS', message: 'Revaluation request already pending for this course' });
      }

      const reval = await prisma.revaluationRequest.create({
        data: {
          resultId,
          studentId: req.user!.studentProfileId!,
          reason: parsed.data.reason,
          originalMarks: result.totalMarks,
          status: 'SUBMITTED',
        },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'REVALUATION_REQUEST_SUBMITTED',
        entityType: 'RevaluationRequest',
        entityId: reval.id,
        departmentId: result.offering.course.departmentId,
        reason: parsed.data.reason,
        req,
      });

      return res.status(201).json({ message: 'Revaluation request submitted successfully', request: reval });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

resultsRouter.get('/revaluation/requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.user!.role === 'STUDENT') {
      where.studentId = req.user!.studentProfileId;
    } else if (req.user!.role === 'EXAM_ADMIN') {
      if (req.user!.designatedDepartmentId) {
        where.result = {
          offering: {
            course: {
              departmentId: req.user!.designatedDepartmentId,
            },
          },
        };
      }
    }

    const requests = await prisma.revaluationRequest.findMany({
      where,
      include: {
        student: { include: { user: true } },
        result: {
          include: {
            offering: { include: { course: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ requests });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

const revaluationDecisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  revisedExternalMarks: z.number().min(0).max(60).optional(),
  decisionNotes: z.string().min(3),
});

resultsRouter.put(
  '/revaluation/:requestId/decide',
  authenticateToken,
  requireRole('EXAM_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const parsed = revaluationDecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { status, revisedExternalMarks, decisionNotes } = parsed.data;

      const reval = await prisma.revaluationRequest.findUnique({
        where: { id: requestId },
        include: {
          result: {
            include: {
              offering: { include: { course: true } },
            },
          },
          student: true,
        },
      });

      if (!reval) return res.status(404).json({ error: 'NOT_FOUND', message: 'Revaluation request not found' });

      // Branch scope check
      if (req.user!.designatedDepartmentId && req.user!.designatedDepartmentId !== reval.result.offering.course.departmentId) {
        return res.status(403).json({ error: 'FORBIDDEN_BRANCH_SCOPE', message: 'You are not the designated Examination Admin for this branch' });
      }

      if (status === 'REJECTED') {
        const updated = await prisma.revaluationRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            decisionNotes,
            assignedEvaluatorId: req.user!.id,
          },
        });
        return res.json({ message: 'Revaluation request rejected (no grade change)', request: updated });
      }

      // If approved with mark change
      const newExternal = revisedExternalMarks ?? reval.result.externalMarks;
      const internalMarks = reval.result.internalMarks;
      const totalMarks = Math.round((internalMarks + newExternal) * 100) / 100;
      const gradeResult = calculateGrade(internalMarks, newExternal, false);

      const otherResults = await prisma.publishedResult.findMany({
        where: { studentId: reval.studentId, id: { not: reval.resultId } },
        include: { offering: { include: { course: true } } },
      });

      const allCourses = [
        ...otherResults.map((r) => ({
          credits: r.offering.course.credits,
          gradePoint: r.gradePoint,
          isPassed: r.isPassed,
        })),
        {
          credits: reval.result.offering.course.credits,
          gradePoint: gradeResult.gradePoint,
          isPassed: gradeResult.isPassed,
        },
      ];

      const newSgpa = calculateSGPA(allCourses);
      const newCgpaEval = evaluateCGPA(allCourses);
      const nextVersion = reval.result.currentVersion + 1;

      const txResult = await prisma.$transaction(async (tx) => {
        const updatedRes = await tx.publishedResult.update({
          where: { id: reval.resultId },
          data: {
            currentVersion: nextVersion,
            externalMarks: newExternal,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa: newSgpa,
            cgpa: newCgpaEval.cgpa,
            cgpaStatus: newCgpaEval.cgpaStatus,
            updatedAt: new Date(),
          },
        });

        await tx.resultVersionHistory.create({
          data: {
            resultId: reval.resultId,
            versionNumber: nextVersion,
            internalMarks,
            externalMarks: newExternal,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa: newSgpa,
            cgpa: newCgpaEval.cgpa,
            cgpaStatus: newCgpaEval.cgpaStatus,
            changeType: 'REVALUATION_OUTCOME',
            correctionCategory: 'REVALUATION_ASSESSMENT',
            evidenceReference: `REVAL-CASE-${requestId.slice(0, 8)}`,
            reason: decisionNotes,
            changedByUserId: req.user!.id,
          },
        });

        const updatedReq = await tx.revaluationRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            revisedMarks: totalMarks,
            decisionNotes,
            assignedEvaluatorId: req.user!.id,
          },
        });

        return { updatedRes, updatedReq };
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'REVALUATION_APPROVED_RESULT_REPUBLISHED',
        entityType: 'PublishedResult',
        entityId: reval.resultId,
        departmentId: reval.result.offering.course.departmentId,
        reason: decisionNotes,
        newData: txResult.updatedRes,
        req,
      });

      return res.json({ message: 'Revaluation approved and result updated to new version', result: txResult.updatedRes, request: txResult.updatedReq });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// RESULT UNPUBLISH & REOPEN
// ============================================================================

resultsRouter.post(
  '/:resultId/unpublish',
  authenticateToken,
  requireRole('EXAM_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { resultId } = req.params;
      const result = await prisma.publishedResult.findUnique({
        where: { id: resultId },
        include: { offering: { include: { course: true } } },
      });
      if (!result) return res.status(404).json({ error: 'NOT_FOUND', message: 'Result not found' });

      if (req.user!.designatedDepartmentId !== result.offering.course.departmentId) {
        return res.status(403).json({ error: 'FORBIDDEN_BRANCH_SCOPE', message: 'You are not the designated Examination Admin for this branch' });
      }

      const updated = await prisma.publishedResult.update({
        where: { id: resultId },
        data: { publicationState: 'UNPUBLISHED' },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'RESULT_UNPUBLISHED',
        entityType: 'PublishedResult',
        entityId: resultId,
        departmentId: result.offering.course.departmentId,
        req,
      });

      return res.json({ message: 'Result unpublished successfully', result: updated });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

resultsRouter.post(
  '/:resultId/reopen',
  authenticateToken,
  requireRole('EXAM_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { resultId } = req.params;
      const result = await prisma.publishedResult.findUnique({
        where: { id: resultId },
        include: { offering: { include: { course: true } } },
      });
      if (!result) return res.status(404).json({ error: 'NOT_FOUND', message: 'Result not found' });

      if (req.user!.designatedDepartmentId !== result.offering.course.departmentId) {
        return res.status(403).json({ error: 'FORBIDDEN_BRANCH_SCOPE', message: 'You are not the designated Examination Admin for this branch' });
      }

      const updated = await prisma.publishedResult.update({
        where: { id: resultId },
        data: { publicationState: 'PUBLISHED' },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'RESULT_REOPENED_PUBLISHED',
        entityType: 'PublishedResult',
        entityId: resultId,
        departmentId: result.offering.course.departmentId,
        req,
      });

      return res.json({ message: 'Result reopened and published', result: updated });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

/**
 * End-Semester External Marks Administration (Exam Admin entry out of 60)
 */
const externalMarksEntrySchema = z.object({
  offeringId: z.string().uuid(),
  entries: z.array(
    z.object({
      studentId: z.string().uuid(),
      externalMarks: z.number().min(0).max(60),
    })
  ),
});

resultsRouter.post(
  '/external-marks',
  authenticateToken,
  requireRole('EXAM_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = externalMarksEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { offeringId, entries } = parsed.data;

      const offering = await prisma.courseOffering.findUnique({
        where: { id: offeringId },
        include: { course: true },
      });
      if (!offering) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Course offering not found' });
      }

      if (req.user!.designatedDepartmentId && req.user!.designatedDepartmentId !== offering.course.departmentId) {
        return res.status(403).json({
          error: 'FORBIDDEN_BRANCH_SCOPE',
          message: 'You are not the designated Examination Admin for this branch.',
        });
      }

      const updatedResults = [];

      for (const entry of entries) {
        const { studentId, externalMarks } = entry;

        // Check if published result already exists or if internal marks exist
        const existingResult = await prisma.publishedResult.findUnique({
          where: { offeringId_studentId: { offeringId, studentId } },
        });

        let internalMarks = existingResult?.internalMarks ?? 0;

        // If no internal marks on published result, check assessment marks sum
        if (!existingResult) {
          const studentMarks = await prisma.assessmentMark.findMany({
            where: { offeringId, studentId },
            include: { component: true },
          });
          const internalSum = studentMarks
            .filter((m) => m.component?.type === 'INTERNAL' && m.marksObtained !== null)
            .reduce((sum, m) => sum + (m.marksObtained || 0), 0);
          if (internalSum > 0) {
            internalMarks = Math.min(40, internalSum);
          }
        }

        const totalMarks = Math.round((internalMarks + externalMarks) * 100) / 100;
        const gradeResult = calculateGrade(internalMarks, externalMarks);

        // Calculate SGPA
        const allStudentResults = await prisma.publishedResult.findMany({
          where: { studentId },
          include: { offering: { include: { course: true } } },
        });

        const allCourses = [
          ...allStudentResults.filter((r) => r.offeringId !== offeringId).map((r) => ({
            credits: r.offering.course.credits,
            gradePoint: r.gradePoint,
            isPassed: r.isPassed,
          })),
          {
            credits: offering.course.credits,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
          },
        ];

        const sgpa = calculateSGPA(allCourses);
        const cgpaEval = evaluateCGPA(allCourses);

        const saved = await prisma.publishedResult.upsert({
          where: { offeringId_studentId: { offeringId, studentId } },
          create: {
            offeringId,
            studentId,
            currentVersion: 1,
            internalMarks,
            externalMarks,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa,
            cgpa: cgpaEval.cgpa,
            cgpaStatus: cgpaEval.cgpaStatus,
            publicationState: 'PUBLISHED',
            publishedByExamAdminId: req.user!.id,
          },
          update: {
            currentVersion: { increment: 1 },
            externalMarks,
            totalMarks,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            isPassed: gradeResult.isPassed,
            sgpa,
            cgpa: cgpaEval.cgpa,
            cgpaStatus: cgpaEval.cgpaStatus,
            publicationState: 'PUBLISHED',
            publishedByExamAdminId: req.user!.id,
          },
        });

        await prisma.resultVersionHistory.create({
          data: {
            resultId: saved.id,
            versionNumber: saved.currentVersion,
            internalMarks: saved.internalMarks,
            externalMarks: saved.externalMarks,
            totalMarks: saved.totalMarks,
            grade: saved.grade,
            gradePoint: saved.gradePoint,
            isPassed: saved.isPassed,
            sgpa: saved.sgpa,
            cgpa: saved.cgpa,
            cgpaStatus: saved.cgpaStatus,
            changeType: 'EXTERNAL_MARKS_ENTRY',
            reason: 'End-semester external marks recorded by Exam Admin',
            changedByUserId: req.user!.id,
          },
        });

        updatedResults.push(saved);
      }

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'EXTERNAL_MARKS_RECORDED',
        entityType: 'PublishedResult',
        entityId: offeringId,
        departmentId: offering.course.departmentId,
        newData: { offeringId, count: updatedResults.length },
        req,
      });

      return res.status(200).json({
        message: `Successfully recorded external marks for ${updatedResults.length} students`,
        results: updatedResults,
      });
    } catch (err: any) {
      console.error('External marks entry error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);


