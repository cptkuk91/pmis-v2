import CodeGroup from "@/models/CodeGroup";
import CodeItem from "@/models/CodeItem";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { WORK_TYPE_GROUP_CODE } from "@/lib/system-code-group";

export type WorkTypeOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

export async function listWorkTypeOptions(siteId: string): Promise<WorkTypeOption[]> {
  const group = await CodeGroup.findOne({
    siteId,
    groupCode: WORK_TYPE_GROUP_CODE,
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

export async function ensureAllowedWorkType(siteId: string, value: string, fieldLabel = "공종") {
  if (!value) {
    return;
  }

  const group = await CodeGroup.findOne({
    siteId,
    groupCode: WORK_TYPE_GROUP_CODE,
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
