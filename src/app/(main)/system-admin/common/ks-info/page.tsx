import { redirect } from "next/navigation";

export default function KsInfoPage() {
  redirect("/system-admin/common/external-sites?category=ks");
}
