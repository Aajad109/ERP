import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { config } from '../config';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'FACULTY' | 'ACADEMIC_ADMIN' | 'EXAM_ADMIN';
  departmentId: string | null;
  studentProfileId?: string;
  facultyProfileId?: string;
  designatedDepartmentId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authorization token is missing',
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        studentProfile: true,
        facultyProfile: true,
        examAdminDesignation: {
          where: { isActive: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'INVALID_ACCOUNT',
        message: 'Account does not exist or has been deactivated',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      studentProfileId: user.studentProfile?.id,
      facultyProfileId: user.facultyProfile?.id,
      designatedDepartmentId: user.examAdminDesignation?.departmentId,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Supplied token is expired or malformed',
    });
  }
}
