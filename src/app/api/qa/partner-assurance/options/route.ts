import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { listApprovedSupplierCompanies } from "@/lib/approved-supplier-company";
import { normalizeSystemCodeGroupCode } from "@/lib/system-code-group";
import CodeGroup from "@/models/CodeGroup";
import CodeItem from "@/models/CodeItem";
import QaCapa from "@/models/QaCapa";

type PartnerOption = {
  key: string;
  partnerCode: string;
  partnerName: string;
  partnerSource: "system_code" | "approved_supplier";
  partnerCategory: "subcontractor" | "material_supplier" | "equipment_supplier";
};

export async function GET() {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId();
    if (!siteId) {
      return success({ partnerOptions: [] as PartnerOption[], capaOptions: [] });
    }

    const partnersGroupCode = normalizeSystemCodeGroupCode("partners");
    const partnersGroup = await CodeGroup.findOne({ siteId, groupCode: partnersGroupCode, isActive: true }).lean();

    const [partnerItems, materialSuppliers, equipmentSuppliers, capaOptions] = await Promise.all([
      partnersGroup
        ? CodeItem.find({
            siteId,
            groupId: partnersGroup._id,
            isActive: true,
          })
            .sort({ sortOrder: 1, itemName: 1 })
            .lean()
        : Promise.resolve([]),
      listApprovedSupplierCompanies(siteId, "material"),
      listApprovedSupplierCompanies(siteId, "equipment"),
      QaCapa.find({ siteId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .select({ title: 1, status: 1, priority: 1, dueDate: 1 })
        .lean(),
    ]);

    const deduped = new Map<string, PartnerOption>();

    partnerItems.forEach((item) => {
      const partnerName = String(item.itemName ?? "").trim();
      if (!partnerName) {
        return;
      }
      const key = `system_code:subcontractor:${partnerName.toLowerCase()}`;
      deduped.set(key, {
        key,
        partnerCode: String(item.itemCode ?? "").trim(),
        partnerName,
        partnerSource: "system_code",
        partnerCategory: "subcontractor",
      });
    });

    materialSuppliers.forEach((item) => {
      const partnerName = String(item.name ?? "").trim();
      if (!partnerName) {
        return;
      }
      const key = `approved_supplier:material_supplier:${partnerName.toLowerCase()}`;
      deduped.set(key, {
        key,
        partnerCode: "",
        partnerName,
        partnerSource: "approved_supplier",
        partnerCategory: "material_supplier",
      });
    });

    equipmentSuppliers.forEach((item) => {
      const partnerName = String(item.name ?? "").trim();
      if (!partnerName) {
        return;
      }
      const key = `approved_supplier:equipment_supplier:${partnerName.toLowerCase()}`;
      deduped.set(key, {
        key,
        partnerCode: "",
        partnerName,
        partnerSource: "approved_supplier",
        partnerCategory: "equipment_supplier",
      });
    });

    const partnerOptions = [...deduped.values()].sort((left, right) =>
      left.partnerName.localeCompare(right.partnerName, "ko"),
    );

    return success({ partnerOptions, capaOptions });
  } catch (err) {
    return handleApiError(err);
  }
}
