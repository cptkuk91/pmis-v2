type CategoryCodeSource = {
  id: string;
  code: string;
  parentCategoryId: string | null;
};

const ROOT_CATEGORY_PREFIX = "CAT";
const ROOT_CATEGORY_WIDTH = 3;
const CHILD_CATEGORY_WIDTH = 2;

function extractCategorySequence(code: string, parentCode: string | null): number | null {
  if (parentCode) {
    const match = new RegExp(`^${parentCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d{${CHILD_CATEGORY_WIDTH}})$`).exec(
      code,
    );
    return match ? Number(match[1]) : null;
  }

  const match = new RegExp(`^${ROOT_CATEGORY_PREFIX}-(\\d{${ROOT_CATEGORY_WIDTH}})$`).exec(code);
  return match ? Number(match[1]) : null;
}

export function getNextDocumentCategoryCode(
  items: CategoryCodeSource[],
  parentCategoryId?: string | null,
): string {
  const normalizedParentId = parentCategoryId ? String(parentCategoryId) : null;
  const parentCode = normalizedParentId
    ? items.find((item) => item.id === normalizedParentId)?.code ?? null
    : null;

  let maxSequence = 0;
  for (const item of items) {
    if ((item.parentCategoryId ?? null) !== normalizedParentId) {
      continue;
    }
    const sequence = extractCategorySequence(item.code, parentCode);
    if (sequence !== null) {
      maxSequence = Math.max(maxSequence, sequence);
    }
  }

  const nextSequence = maxSequence + 1;
  if (parentCode) {
    return `${parentCode}-${String(nextSequence).padStart(CHILD_CATEGORY_WIDTH, "0")}`;
  }

  return `${ROOT_CATEGORY_PREFIX}-${String(nextSequence).padStart(ROOT_CATEGORY_WIDTH, "0")}`;
}
