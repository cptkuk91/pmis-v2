import { redirect } from "next/navigation";
import { qcMenuGroups } from "./menu-config";

export default function QcPage() {
  redirect(qcMenuGroups[0]?.items[0]?.href ?? "/dashboard");
}
