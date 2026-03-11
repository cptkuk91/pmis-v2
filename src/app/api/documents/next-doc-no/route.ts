import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { generateNextDocumentNo } from "@/lib/document-doc-no";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";

export async function GET() {
  try {
    await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId();
    if (!siteId) {
      return success({ docNo: "" });
    }

    const docNo = await generateNextDocumentNo(siteId);
    return success({ docNo });
  } catch (err) {
    return handleApiError(err);
  }
}
