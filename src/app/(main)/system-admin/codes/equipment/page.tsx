import { CodeItemsManager } from "@/components/features/code-items-manager";

export default function SystemAdminEquipmentCodePage() {
  return (
    <CodeItemsManager
      groupCode="equipment"
      title="장비 코드관리"
      subtitle="장비 분류/품목 코드 CRUD (site_admin 이상)"
    />
  );
}
