import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import {
  QC_ATTACHMENT_CATEGORY_OPTIONS,
  QC_INSPECTION_STATUS_OPTIONS,
  QC_NOTIFICATION_EVENT_OPTIONS,
  QC_PERMISSION_ROLE_OPTIONS,
} from "@/lib/qc-core";
import {
  QC_MATERIAL_CATEGORY_OPTIONS,
  QC_MATERIAL_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS,
  QC_MATERIAL_INSPECTION_CHECK_STATUS_OPTIONS,
  QC_MATERIAL_INSPECTION_DISPOSITION_OPTIONS,
  QC_MATERIAL_INSPECTION_NCR_STATUS_OPTIONS,
  QC_MATERIAL_INSPECTION_RESULT_LABELS,
  QC_MATERIAL_INSPECTION_RESULT_VALUES,
  QC_MATERIAL_INSPECTION_SORT_LABELS,
  QC_MATERIAL_INSPECTION_SORT_VALUES,
} from "@/lib/qc-material-inspections";

export async function GET() {
  try {
    await requireRole("viewer");
    await connectDB();

    return success({
      permissionRoles: QC_PERMISSION_ROLE_OPTIONS,
      inspectionStatuses: QC_INSPECTION_STATUS_OPTIONS,
      attachmentCategories: QC_ATTACHMENT_CATEGORY_OPTIONS,
      notificationEvents: QC_NOTIFICATION_EVENT_OPTIONS,
      materialCategories: QC_MATERIAL_CATEGORY_OPTIONS,
      materialInspectionResults: QC_MATERIAL_INSPECTION_RESULT_VALUES.map((value) => ({
        value,
        label: QC_MATERIAL_INSPECTION_RESULT_LABELS[value],
      })),
      materialInspectionAttachmentCategories: QC_MATERIAL_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS,
      materialInspectionCheckStatuses: QC_MATERIAL_INSPECTION_CHECK_STATUS_OPTIONS,
      materialInspectionDispositions: QC_MATERIAL_INSPECTION_DISPOSITION_OPTIONS,
      materialInspectionNcrStatuses: QC_MATERIAL_INSPECTION_NCR_STATUS_OPTIONS,
      materialInspectionSorts: QC_MATERIAL_INSPECTION_SORT_VALUES.map((value) => ({
        value,
        label: QC_MATERIAL_INSPECTION_SORT_LABELS[value],
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
