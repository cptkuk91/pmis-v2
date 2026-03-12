import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import Notice from "@/models/Notice";
import Meeting from "@/models/Meeting";
import Issue from "@/models/Issue";
import DocumentModel from "@/models/Document";
import { getQaOpsSnapshot } from "@/lib/qa-ops-summary";

export async function GET() {
  try {
    await requireRole("viewer");
    await connectDB();
    const siteId = await resolveSiteId();

    if (!siteId) {
      return success({
        notices: 0,
        meetingsToday: 0,
        pendingDocs: 0,
        openIssues: 0,
        qaPolicyGoalsActive: 0,
        qaPendingAudits: 0,
        qaOverdueCapas: 0,
        qaKpiAlerts: 0,
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [notices, meetingsToday, openIssues, pendingDocs, qaSummary] = await Promise.all([
      Notice.countDocuments({ siteId }),
      Meeting.countDocuments({ siteId, meetingDate: { $gte: startOfDay, $lt: endOfDay } }),
      Issue.countDocuments({ siteId, status: "open" }),
      DocumentModel.countDocuments({ siteId, status: { $in: ["draft", "in_review"] } }),
      getQaOpsSnapshot(siteId, { limit: 3, referenceDate: today, kpiYear: today.getFullYear() }),
    ]);

    return success({
      notices,
      meetingsToday,
      pendingDocs,
      openIssues,
      qaPolicyGoalsActive: qaSummary.activePolicyGoalCount,
      qaPendingAudits: qaSummary.pendingAuditCount,
      qaOverdueCapas: qaSummary.overdueCapaCount,
      qaKpiAlerts: qaSummary.kpiAlertCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
