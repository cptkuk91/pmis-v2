import { redirect } from "next/navigation";

export default function LegacyExcellentFacilitiesPage() {
  redirect("/quality-safety/safety/facilities?tab=excellent");
}
