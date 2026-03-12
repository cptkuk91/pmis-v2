import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import QaAudit from "@/models/QaAudit";

export type QaCapaAuditSourceMeta = {
  sourceSummary: string;
  sourceAuditTitle: string;
  sourceChecklistSection: string;
  sourceChecklistTitle: string;
};

type LinkArgs = {
  siteId: string;
  auditId: string;
  checklistId: string;
  capaId: string;
  updatedByUserId?: string | null;
};

export async function resolveQaCapaAuditSource(
  siteId: string,
  auditId: string,
  checklistId: string,
  currentCapaId?: string | null,
): Promise<QaCapaAuditSourceMeta> {
  if (!mongoose.Types.ObjectId.isValid(auditId)) {
    throw VALIDATION_ERROR("연결 심사 식별자 형식이 올바르지 않습니다.");
  }

  const audit = await QaAudit.findOne({ _id: auditId, siteId });
  if (!audit) {
    throw VALIDATION_ERROR("연결할 내부 심사를 찾을 수 없습니다.");
  }

  const checklist = audit.checklistItems.find((item) => item.checklistId === checklistId);
  if (!checklist) {
    throw VALIDATION_ERROR("연결할 심사 점검 항목을 찾을 수 없습니다.");
  }
  if (checklist.result !== "nonconformity" || !checklist.requiresCapa) {
    throw VALIDATION_ERROR("CAPA 후보로 표시된 부적합 항목만 연결할 수 있습니다.");
  }
  if (checklist.linkedCapaId && checklist.linkedCapaId !== currentCapaId) {
    throw VALIDATION_ERROR("이미 다른 CAPA와 연결된 심사 항목입니다.");
  }

  return {
    sourceSummary: `${audit.auditTitle} · ${checklist.sectionTitle} / ${checklist.itemTitle}`,
    sourceAuditTitle: audit.auditTitle,
    sourceChecklistSection: checklist.sectionTitle,
    sourceChecklistTitle: checklist.itemTitle,
  };
}

export async function linkQaCapaToAudit({
  siteId,
  auditId,
  checklistId,
  capaId,
  updatedByUserId,
}: LinkArgs) {
  if (!auditId || !checklistId) {
    return;
  }

  const audit = await QaAudit.findOne({ _id: auditId, siteId });
  if (!audit) {
    throw VALIDATION_ERROR("연결할 내부 심사를 찾을 수 없습니다.");
  }

  const checklist = audit.checklistItems.find((item) => item.checklistId === checklistId);
  if (!checklist) {
    throw VALIDATION_ERROR("연결할 심사 점검 항목을 찾을 수 없습니다.");
  }
  if (checklist.linkedCapaId && checklist.linkedCapaId !== capaId) {
    throw VALIDATION_ERROR("이미 다른 CAPA와 연결된 심사 항목입니다.");
  }

  checklist.requiresCapa = true;
  checklist.linkedCapaId = capaId;
  audit.updatedBy = updatedByUserId ? new mongoose.Types.ObjectId(updatedByUserId) : undefined;
  await audit.save();
}

export async function unlinkQaCapaFromAudit({
  siteId,
  auditId,
  checklistId,
  capaId,
  updatedByUserId,
}: LinkArgs) {
  if (!auditId || !checklistId) {
    return;
  }

  const audit = await QaAudit.findOne({ _id: auditId, siteId });
  if (!audit) {
    return;
  }

  const checklist = audit.checklistItems.find((item) => item.checklistId === checklistId);
  if (!checklist || checklist.linkedCapaId !== capaId) {
    return;
  }

  checklist.linkedCapaId = "";
  audit.updatedBy = updatedByUserId ? new mongoose.Types.ObjectId(updatedByUserId) : undefined;
  await audit.save();
}
