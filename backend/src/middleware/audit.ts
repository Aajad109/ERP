import { Request } from 'express';
import { prisma } from '../prisma';

export interface AuditLogParams {
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  departmentId?: string | null;
  category?: string;
  evidenceRef?: string;
  reason?: string;
  oldData?: any;
  newData?: any;
  req?: Request;
}

export async function logAuditEvent(params: AuditLogParams) {
  try {
    const ipAddress = params.req?.ip || params.req?.socket?.remoteAddress || 'unknown';
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        departmentId: params.departmentId || null,
        category: params.category || null,
        evidenceRef: params.evidenceRef || null,
        reason: params.reason || null,
        oldData: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : undefined,
        newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : undefined,
        ipAddress,
      },
    });
  } catch (err) {
    console.error('Failed to append to audit log:', err);
  }
}
