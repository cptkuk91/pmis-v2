import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { getNextDocumentCategoryCode } from "@/lib/document-category-code-format";
import DocumentCategory from "@/models/DocumentCategory";

export type DocumentCategoryOption = {
  id: string;
  code: string;
  name: string;
  parentCategoryId: string | null;
};

type CategoryCodeSource = {
  id: string;
  code: string;
  parentCategoryId: string | null;
};

export async function listDocumentCategoryOptions(siteId: string): Promise<DocumentCategoryOption[]> {
  const items = await DocumentCategory.find({
    siteId,
  })
    .sort({ sortOrder: 1, categoryCode: 1 })
    .lean();

  return items.map((item) => ({
    id: String(item._id),
    code: item.categoryCode,
    name: item.categoryName,
    parentCategoryId: item.parentCategoryId ? String(item.parentCategoryId) : null,
  }));
}

export async function ensureAllowedDocumentCategory(
  siteId: string,
  value: string,
  fieldLabel = "분류 코드",
) {
  if (!value) {
    return;
  }

  const item = await DocumentCategory.findOne({
    siteId,
    categoryCode: value,
    isActive: true,
  }).lean();

  if (!item) {
    throw VALIDATION_ERROR(`허용되지 않은 ${fieldLabel}입니다.`);
  }
}

export async function generateNextDocumentCategoryCode(
  siteId: string,
  parentCategoryId?: string | null,
): Promise<string> {
  const items = await listDocumentCategoryOptions(siteId);
  return getNextDocumentCategoryCode(items, parentCategoryId ?? null);
}

export async function validateDocumentCategoryParent(
  siteId: string,
  parentCategoryId?: string | null,
  currentCategoryId?: string | null,
) {
  if (!parentCategoryId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(parentCategoryId)) {
    throw VALIDATION_ERROR("parentCategoryId 형식이 올바르지 않습니다.");
  }

  if (currentCategoryId && String(currentCategoryId) === String(parentCategoryId)) {
    throw VALIDATION_ERROR("상위 분류로 자기 자신을 선택할 수 없습니다.");
  }

  const parentCategory = await DocumentCategory.findOne({
    _id: parentCategoryId,
    siteId,
  })
    .select({ _id: 1, parentCategoryId: 1 })
    .lean();

  if (!parentCategory) {
    throw VALIDATION_ERROR("선택한 상위 분류가 존재하지 않습니다.");
  }

  if (!currentCategoryId) {
    return parentCategory;
  }

  let cursorParentId = parentCategory.parentCategoryId ? String(parentCategory.parentCategoryId) : null;
  while (cursorParentId) {
    if (cursorParentId === String(currentCategoryId)) {
      throw VALIDATION_ERROR("하위 분류는 상위 분류로 선택할 수 없습니다.");
    }

    const ancestor = await DocumentCategory.findOne({
      _id: cursorParentId,
      siteId,
    })
      .select({ parentCategoryId: 1 })
      .lean();

    cursorParentId = ancestor?.parentCategoryId ? String(ancestor.parentCategoryId) : null;
  }

  return parentCategory;
}
