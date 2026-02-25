import { redirect } from "next/navigation";

export default function ProSitesPage() {
  redirect("/system-admin/common/external-sites?category=pro-sites");
}
