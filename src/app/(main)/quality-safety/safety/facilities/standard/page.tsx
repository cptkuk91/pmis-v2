import { redirect } from "next/navigation";

export default function LegacyStandardFacilitiesPage() {
  redirect("/quality-safety/safety/facilities?tab=standard");
}
