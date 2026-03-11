import { CodeItemsManager } from "@/components/features/code-items-manager";

export default function SystemAdminEquipmentSpecificationsCodePage() {
  return (
    <CodeItemsManager
      groupCode="equipment-specifications"
      title="장비 규격 코드관리"
      subtitle="장비 규격 코드 CRUD (site_admin 이상)"
    />
  );
}
