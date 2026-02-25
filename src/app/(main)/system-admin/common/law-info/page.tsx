import { redirect } from "next/navigation";

export default function LawInfoPage() {
  redirect("/system-admin/common/external-sites?category=laws");
}
