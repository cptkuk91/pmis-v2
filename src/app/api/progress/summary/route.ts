import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import Report from "@/models/Report";
import DailySafetyLog from "@/models/DailySafetyLog";
import ScheduleItem from "@/models/ScheduleItem";
import ProjectCalendarEvent from "@/models/ProjectCalendarEvent";

export async function GET() {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId();
    if (!siteId) {
      return success({
        reports: 0,
        safetyLogs: 0,
        scheduleItems: 0,
        calendarEvents: 0,
        delayedTasks: 0,
        averageActualProgress: 0,
      });
    }

    const today = new Date();
    const [reports, safetyLogs, scheduleItems, calendarEvents, delayedTasks, progressAgg] =
      await Promise.all([
        Report.countDocuments({ siteId }),
        DailySafetyLog.countDocuments({ siteId }),
        ScheduleItem.countDocuments({ siteId }),
        ProjectCalendarEvent.countDocuments({ siteId }),
        ScheduleItem.countDocuments({
          siteId,
          plannedEnd: { $lt: today },
          $expr: { $lt: ["$actualProgress", "$plannedProgress"] },
        }),
        ScheduleItem.aggregate<{ avgProgress: number }>([
          { $match: { siteId: new mongoose.Types.ObjectId(siteId), isDeleted: false } },
          { $group: { _id: null, avgProgress: { $avg: "$actualProgress" } } },
        ]),
      ]);

    return success({
      reports,
      safetyLogs,
      scheduleItems,
      calendarEvents,
      delayedTasks,
      averageActualProgress: Math.round(progressAgg[0]?.avgProgress ?? 0),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
