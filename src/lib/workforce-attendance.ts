import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { JOB_TYPE_GROUP_CODE, WORK_TYPE_GROUP_CODE } from "@/lib/system-code-group";
import CodeGroup from "@/models/CodeGroup";
import CodeItem from "@/models/CodeItem";

export type WorkforceCodeOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

export type WorkforceAttendanceOptions = {
  jobTypes: WorkforceCodeOption[];
  workTypes: WorkforceCodeOption[];
};

export type NormalizedWorkforceAttendancePayload = {
  siteId: string;
  attendanceDate: Date;
  workerName: string;
  company: string;
  jobType: string;
  workType: string;
  isPresent: boolean;
  hoursWorked: number;
  overtimeHours: number;
};

async function listCodeItemsByGroupCode(
  siteId: string,
  groupCode: string,
): Promise<WorkforceCodeOption[]> {
  const group = await CodeGroup.findOne({
    siteId,
    groupCode,
    isActive: true,
  }).lean();

  if (!group) {
    return [];
  }

  const items = await CodeItem.find({
    siteId,
    groupId: group._id,
    isActive: true,
  })
    .sort({ sortOrder: 1, itemName: 1, createdAt: -1 })
    .lean();

  return items.map((item) => ({
    id: String(item._id),
    code: item.itemCode,
    name: item.itemName,
    description: item.description ?? "",
  }));
}

async function ensureAllowedCodeValue(
  siteId: string,
  groupCode: string,
  value: string,
  fieldLabel: string,
): Promise<void> {
  if (!value) {
    return;
  }

  const group = await CodeGroup.findOne({
    siteId,
    groupCode,
    isActive: true,
  }).lean();

  if (!group) {
    throw VALIDATION_ERROR(`${fieldLabel} 코드가 등록되어 있지 않습니다.`);
  }

  const item = await CodeItem.findOne({
    siteId,
    groupId: group._id,
    itemName: value,
    isActive: true,
  }).lean();

  if (!item) {
    throw VALIDATION_ERROR(`허용되지 않은 ${fieldLabel}입니다.`);
  }
}

function parseRequiredDate(value: unknown, fieldLabel: string): Date {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw VALIDATION_ERROR(`${fieldLabel}은 필수입니다.`);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldLabel} 형식이 올바르지 않습니다.`);
  }

  return parsed;
}

function parseNonNegativeNumber(value: unknown, fieldLabel: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw VALIDATION_ERROR(`${fieldLabel} 값이 올바르지 않습니다.`);
  }

  return Math.max(0, parsed);
}

export async function listWorkforceAttendanceOptions(
  siteId: string,
): Promise<WorkforceAttendanceOptions> {
  const [jobTypes, workTypes] = await Promise.all([
    listCodeItemsByGroupCode(siteId, JOB_TYPE_GROUP_CODE),
    listCodeItemsByGroupCode(siteId, WORK_TYPE_GROUP_CODE),
  ]);

  return {
    jobTypes,
    workTypes,
  };
}

export async function normalizeWorkforceAttendancePayload(
  body: Record<string, unknown>,
): Promise<NormalizedWorkforceAttendancePayload> {
  const siteId = String(body.siteId ?? "").trim();
  const workerName = String(body.workerName ?? "").trim();
  const company = String(body.company ?? "").trim();
  const jobType = String(body.jobType ?? "").trim();
  const workType = String(body.workType ?? "").trim();

  if (!siteId) {
    throw VALIDATION_ERROR("siteId가 필요합니다.");
  }
  if (!mongoose.Types.ObjectId.isValid(siteId)) {
    throw VALIDATION_ERROR("siteId 형식이 올바르지 않습니다.");
  }
  if (!workerName) {
    throw VALIDATION_ERROR("성명은 필수입니다.");
  }

  await Promise.all([
    ensureAllowedCodeValue(siteId, JOB_TYPE_GROUP_CODE, jobType, "직종"),
    ensureAllowedCodeValue(siteId, WORK_TYPE_GROUP_CODE, workType, "공종"),
  ]);

  return {
    siteId,
    attendanceDate: parseRequiredDate(body.attendanceDate, "출역일"),
    workerName,
    company,
    jobType,
    workType,
    isPresent: body.isPresent === undefined ? true : Boolean(body.isPresent),
    hoursWorked: parseNonNegativeNumber(body.hoursWorked, "근무시간"),
    overtimeHours: parseNonNegativeNumber(body.overtimeHours, "잔업시간"),
  };
}
