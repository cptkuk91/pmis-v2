import mongoose from "mongoose";
import WisWorkerRecord from "@/models/WisWorkerRecord";
import WorkforceAttendance from "@/models/WorkforceAttendance";
import SafetyEducationRecord from "@/models/SafetyEducationRecord";
import Site from "@/models/Site";

export type WisInputRecord = {
  workerName: string;
  company?: string;
  occupation?: string;
  recordDate: string | Date;
  recordType: "attendance" | "safety_education";
  checkInTime?: string;
  checkOutTime?: string;
  hoursWorked?: number;
  educationType?: string;
  educationTitle?: string;
  educationHours?: number;
};

type WisSyncResult = {
  siteId: string;
  siteName: string;
  processed: number;
  attendanceSynced: number;
  educationSynced: number;
  failed: number;
  usedFallbackData: boolean;
};

function normalizeDateOnly(rawDate: string | Date): Date {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("WIS recordDate 형식이 올바르지 않습니다.");
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function asPositiveNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

function buildFallbackWisRecords(): WisInputRecord[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return [
    {
      workerName: "김현장",
      company: "한산기업",
      occupation: "형틀목공",
      recordDate: today,
      recordType: "attendance",
      checkInTime: "07:30",
      checkOutTime: "17:30",
      hoursWorked: 8,
    },
    {
      workerName: "이안전",
      company: "강화기업",
      occupation: "철근공",
      recordDate: today,
      recordType: "attendance",
      checkInTime: "07:40",
      checkOutTime: "17:20",
      hoursWorked: 8,
    },
    {
      workerName: "박자재",
      company: "선주토건",
      occupation: "설비공",
      recordDate: yesterday,
      recordType: "attendance",
      checkInTime: "07:20",
      checkOutTime: "18:10",
      hoursWorked: 9,
    },
    {
      workerName: "김현장",
      company: "한산기업",
      occupation: "형틀목공",
      recordDate: today,
      recordType: "safety_education",
      educationType: "정기안전교육",
      educationTitle: "작업 전 위험성평가 브리핑",
      educationHours: 1,
    },
    {
      workerName: "이안전",
      company: "강화기업",
      occupation: "철근공",
      recordDate: yesterday,
      recordType: "safety_education",
      educationType: "신규작업교육",
      educationTitle: "철근작업 추락 방지 교육",
      educationHours: 1.5,
    },
  ];
}

export async function syncWisForSite(options: {
  siteId: string;
  userId?: string | null;
  records?: WisInputRecord[];
}): Promise<WisSyncResult> {
  const site = await Site.findById(options.siteId).select({ siteName: 1 }).lean();
  if (!site) {
    throw new Error("동기화 대상 현장을 찾을 수 없습니다.");
  }

  const sourceRecords =
    Array.isArray(options.records) && options.records.length > 0
      ? options.records
      : buildFallbackWisRecords();

  const userObjectId =
    options.userId && mongoose.Types.ObjectId.isValid(options.userId)
      ? new mongoose.Types.ObjectId(options.userId)
      : undefined;

  let processed = 0;
  let attendanceSynced = 0;
  let educationSynced = 0;
  let failed = 0;

  for (const record of sourceRecords) {
    try {
      if (!record.workerName || !record.recordType || !record.recordDate) {
        throw new Error("WIS 필수 데이터(workerName/recordType/recordDate) 누락");
      }

      const recordDate = normalizeDateOnly(record.recordDate);

      await WisWorkerRecord.findOneAndUpdate(
        {
          siteId: options.siteId,
          workerName: record.workerName,
          recordType: record.recordType,
          recordDate,
          ...(record.recordType === "safety_education"
            ? { educationTitle: record.educationTitle ?? "", educationType: record.educationType ?? "" }
            : {}),
        },
        {
          $set: {
            company: record.company ?? "",
            occupation: record.occupation ?? "",
            checkInTime: record.checkInTime ?? null,
            checkOutTime: record.checkOutTime ?? null,
            hoursWorked: asPositiveNumber(record.hoursWorked, 8),
            educationType: record.educationType ?? null,
            educationTitle: record.educationTitle ?? null,
            educationHours: asPositiveNumber(record.educationHours, 1),
            isSynced: true,
            syncedAt: new Date(),
            ...(userObjectId ? { updatedBy: userObjectId } : {}),
          },
          $setOnInsert: {
            siteId: options.siteId,
            workerName: record.workerName,
            recordDate,
            recordType: record.recordType,
            ...(userObjectId ? { createdBy: userObjectId } : {}),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      if (record.recordType === "attendance") {
        await WorkforceAttendance.findOneAndUpdate(
          {
            siteId: options.siteId,
            workerName: record.workerName,
            attendanceDate: recordDate,
          },
          {
            $set: {
              company: record.company ?? "",
              jobType: record.occupation ?? "",
              workType: "WIS",
              isPresent: true,
              hoursWorked: asPositiveNumber(record.hoursWorked, 8),
              overtimeHours: 0,
              remarks: "WIS 동기화",
              ...(userObjectId ? { updatedBy: userObjectId } : {}),
            },
            $setOnInsert: {
              siteId: options.siteId,
              attendanceDate: recordDate,
              workerName: record.workerName,
              ...(userObjectId ? { createdBy: userObjectId } : {}),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        attendanceSynced += 1;
      } else {
        const educationTitle = record.educationTitle ?? `${record.workerName} 안전교육`;
        await SafetyEducationRecord.findOneAndUpdate(
          {
            siteId: String(options.siteId),
            educationDate: recordDate,
            educationType: record.educationType ?? "WIS 교육",
            title: educationTitle,
            remarks: `WIS:${record.workerName}`,
          },
          {
            $set: {
              instructor: "WIS 연동",
              duration: asPositiveNumber(record.educationHours, 1),
              attendeeCount: 1,
              content: `${record.workerName} (${record.company ?? "소속 미상"})`,
              ...(userObjectId ? { updatedBy: userObjectId } : {}),
            },
            $setOnInsert: {
              siteId: String(options.siteId),
              educationDate: recordDate,
              educationType: record.educationType ?? "WIS 교육",
              title: educationTitle,
              remarks: `WIS:${record.workerName}`,
              ...(userObjectId ? { createdBy: userObjectId } : {}),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        educationSynced += 1;
      }

      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    siteId: String(options.siteId),
    siteName: String(site.siteName ?? ""),
    processed,
    attendanceSynced,
    educationSynced,
    failed,
    usedFallbackData: !(Array.isArray(options.records) && options.records.length > 0),
  };
}
