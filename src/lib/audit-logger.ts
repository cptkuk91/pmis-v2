import { connectDB } from "@/lib/db";
import AuditLog from "@/models/AuditLog";

interface Actor {
  userId: string | null;
  userName: string;
}

interface AuditEntry {
  siteId: string;
  action: string;
  entityType: string;
  entityId?: string;
  actor: Actor;
  details?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit logger. Never throws, never blocks the main response.
 */
function logAudit(entry: AuditEntry): void {
  void (async () => {
    try {
      await connectDB();
      await AuditLog.create({
        siteId: entry.siteId || undefined,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId || undefined,
        actorId: entry.actor.userId || undefined,
        actorName: entry.actor.userName,
        details: entry.details,
        metadata: entry.metadata,
      });
    } catch (err) {
      console.error("[audit-logger] Failed to write audit log:", err);
    }
  })();
}

function logCreate(
  siteId: string,
  entityType: string,
  entityId: string,
  actor: Actor,
  metadata?: Record<string, unknown>,
): void {
  logAudit({
    siteId,
    action: `${entityType}_created`,
    entityType,
    entityId,
    actor,
    metadata,
  });
}

function logUpdate(
  siteId: string,
  entityType: string,
  entityId: string,
  actor: Actor,
  changes?: Record<string, unknown>,
): void {
  logAudit({
    siteId,
    action: `${entityType}_updated`,
    entityType,
    entityId,
    actor,
    metadata: changes,
  });
}

function logDelete(
  siteId: string,
  entityType: string,
  entityId: string,
  actor: Actor,
): void {
  logAudit({
    siteId,
    action: `${entityType}_deleted`,
    entityType,
    entityId,
    actor,
  });
}

function logStatusChange(
  siteId: string,
  entityType: string,
  entityId: string,
  actor: Actor,
  fromStatus: string,
  toStatus: string,
): void {
  logAudit({
    siteId,
    action: `${entityType}_status_changed`,
    entityType,
    entityId,
    actor,
    metadata: { fromStatus, toStatus },
  });
}

export { logAudit, logCreate, logUpdate, logDelete, logStatusChange };
export type { Actor, AuditEntry };
