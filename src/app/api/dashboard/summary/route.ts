import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import Notice from "@/models/Notice";
import Meeting from "@/models/Meeting";
import Issue from "@/models/Issue";
import DocumentModel from "@/models/Document";

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
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [notices, meetingsToday, openIssues, pendingDocs] = await Promise.all([
      Notice.countDocuments({ siteId }),
      Meeting.countDocuments({ siteId, meetingDate: { $gte: startOfDay, $lt: endOfDay } }),
      Issue.countDocuments({ siteId, status: "open" }),
      DocumentModel.countDocuments({ siteId, status: { $in: ["draft", "in_review"] } }),
    ]);

    return success({ notices, meetingsToday, pendingDocs, openIssues });
  } catch (err) {
    return handleApiError(err);
  }
}
