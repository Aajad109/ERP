import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

export const auditRouter = Router();

auditRouter.get(
  '/',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN', 'EXAM_ADMIN'),
  async (req: Request, res: Response) => {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 100);
    const action = req.query.action as string | undefined;

    const where: any = {};
    if (action) {
      where.action = action;
    }

    // Branch scoping for Exam Admin
    if (req.user!.role === 'EXAM_ADMIN' && req.user!.designatedDepartmentId) {
      where.OR = [
        { departmentId: req.user!.designatedDepartmentId },
        { departmentId: null },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      total,
      page,
      limit,
      logs,
    });
  }
);
