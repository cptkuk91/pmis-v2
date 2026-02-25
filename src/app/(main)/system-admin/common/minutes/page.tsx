import { redirect } from "next/navigation";

export default function LegacyMinutesPage() {
  redirect("/system-admin/common/meetings?tab=minutes");
}
