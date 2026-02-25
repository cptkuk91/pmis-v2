import { redirect } from "next/navigation";
import { qaMenuGroups } from "./menu-config";

export default function QaPage() {
  redirect(qaMenuGroups[0]?.items[0]?.href ?? "/dashboard");
}
