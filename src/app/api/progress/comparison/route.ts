import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import ScheduleItem from "@/models/ScheduleItem";

type ComparisonRow = {
  _id: string;
  taskCode: string;
  taskName: string;
  category: string;
  plannedStart: string;
  plannedEnd: string;
  plannedProgress: number;
  actualProgress: number;
  progressGap: number;
  isDelayed: boolean;
  delayDays: number;
};

function toISODate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function parseDateParam(rawValue: string | null): Date | null {
  if (!rawValue) {
    return null;
  }
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success({
        summary: {
          totalTasks: 0,
          delayedTasks: 0,
          avgPlannedProgress: 0,
          avgActualProgress: 0,
          completionRate: 0,
        },
        curve: [],
        items: [],
      });
    }

    const fromDate = parseDateParam(request.nextUrl.searchParams.get("from"));
    const toDate = parseDateParam(request.nextUrl.searchParams.get("to"));

    const filter: Record<string, unknown> = { siteId };
    if (fromDate || toDate) {
      const plannedEndFilter: Record<string, Date> = {};
      if (fromDate) {
        plannedEndFilter.$gte = fromDate;
      }
      if (toDate) {
        plannedEndFilter.$lte = toDate;
      }
      filter.plannedEnd = plannedEndFilter;
    }

    const scheduleItems = await ScheduleItem.find(filter)
      .sort({ plannedEnd: 1, sortOrder: 1, createdAt: 1 })
      .lean();

    if (scheduleItems.length === 0) {
      return success({
        summary: {
          totalTasks: 0,
          delayedTasks: 0,
          avgPlannedProgress: 0,
          avgActualProgress: 0,
          completionRate: 0,
        },
        curve: [],
        items: [],
      });
    }

    const now = Date.now();
    const mappedRows: ComparisonRow[] = scheduleItems.map((item) => {
      const plannedProgress = clampProgress(Number(item.plannedProgress ?? 0));
      const actualProgress = clampProgress(Number(item.actualProgress ?? 0));
      const plannedEndDate = new Date(item.plannedEnd);
      const isDelayed = plannedEndDate.getTime() < now && actualProgress < plannedProgress;
      const delayDays = isDelayed
        ? Math.max(0, Math.floor((now - plannedEndDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        _id: String(item._id),
        taskCode: String(item.taskCode ?? ""),
        taskName: String(item.taskName ?? ""),
        category: String(item.category ?? ""),
        plannedStart: toISODate(new Date(item.plannedStart)),
        plannedEnd: toISODate(plannedEndDate),
        plannedProgress,
        actualProgress,
        progressGap: Number((actualProgress - plannedProgress).toFixed(1)),
        isDelayed,
        delayDays,
      };
    });

    const groupedByDate = new Map<string, { planned: number; actual: number }>();
    for (const row of mappedRows) {
      const existing = groupedByDate.get(row.plannedEnd) ?? { planned: 0, actual: 0 };
      existing.planned += row.plannedProgress;
      existing.actual += row.actualProgress;
      groupedByDate.set(row.plannedEnd, existing);
    }

    const sortedDates = [...groupedByDate.keys()].sort();
    const totalPlanned = mappedRows.reduce((acc, row) => acc + row.plannedProgress, 0);

    let cumulativePlanned = 0;
    let cumulativeActual = 0;
    const curve = sortedDates.map((date) => {
      const bucket = groupedByDate.get(date) ?? { planned: 0, actual: 0 };
      cumulativePlanned += bucket.planned;
      cumulativeActual += bucket.actual;

      const plannedRate = totalPlanned > 0
        ? Number(((cumulativePlanned / totalPlanned) * 100).toFixed(1))
        : 0;
      const actualRate = totalPlanned > 0
        ? Number(((cumulativeActual / totalPlanned) * 100).toFixed(1))
        : 0;

      return {
        date,
        plannedRate,
        actualRate,
        gap: Number((actualRate - plannedRate).toFixed(1)),
      };
    });

    const delayedTasks = mappedRows.filter((row) => row.isDelayed).length;
    const completedTasks = mappedRows.filter((row) => row.actualProgress >= 100).length;
    const avgPlannedProgress = Number(
      (
        mappedRows.reduce((acc, row) => acc + row.plannedProgress, 0) / mappedRows.length
      ).toFixed(1),
    );
    const avgActualProgress = Number(
      (
        mappedRows.reduce((acc, row) => acc + row.actualProgress, 0) / mappedRows.length
      ).toFixed(1),
    );

    return success({
      summary: {
        totalTasks: mappedRows.length,
        delayedTasks,
        avgPlannedProgress,
        avgActualProgress,
        completionRate: Number(((completedTasks / mappedRows.length) * 100).toFixed(1)),
      },
      curve,
      items: mappedRows,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
