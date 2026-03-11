import { CodeItemsManager } from "@/components/features/code-items-manager";

export default function SystemAdminMaterialSpecificationsCodePage() {
  return (
    <CodeItemsManager
      groupCode="material-specifications"
      title="자재 규격 코드관리"
      subtitle="자재 규격 코드 CRUD (site_admin 이상)"
    />
  );
}
