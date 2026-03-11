import { CodeItemsManager } from "@/components/features/code-items-manager";

export default function SystemAdminWorkTypesCodePage() {
  return (
    <CodeItemsManager
      groupCode="work-types"
      title="공종 코드관리"
      subtitle="근태/협력사/기술자료 등에 사용하는 공종 코드 CRUD (site_admin 이상)"
    />
  );
}
