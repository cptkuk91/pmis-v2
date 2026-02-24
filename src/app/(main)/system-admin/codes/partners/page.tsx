import { CodeItemsManager } from "@/components/features/code-items-manager";

export default function SystemAdminPartnersCodePage() {
  return (
    <CodeItemsManager
      groupCode="partners"
      title="관련사 코드관리"
      subtitle="관련사 마스터 코드 CRUD (site_admin 이상)"
    />
  );
}
