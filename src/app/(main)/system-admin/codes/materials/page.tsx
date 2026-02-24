import { CodeItemsManager } from "@/components/features/code-items-manager";

export default function SystemAdminMaterialsCodePage() {
  return (
    <CodeItemsManager
      groupCode="materials"
      title="자재 코드관리"
      subtitle="자재 분류/품목 코드 CRUD (site_admin 이상)"
    />
  );
}
