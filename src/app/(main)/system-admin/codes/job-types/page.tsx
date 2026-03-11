import { CodeItemsManager } from "@/components/features/code-items-manager";

export default function SystemAdminJobTypesCodePage() {
  return (
    <CodeItemsManager
      groupCode="job-types"
      title="직종 코드관리"
      subtitle="근태/교육 등에 사용하는 직종 코드 CRUD (site_admin 이상)"
    />
  );
}
