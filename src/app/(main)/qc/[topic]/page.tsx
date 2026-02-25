import { notFound } from "next/navigation";
import { ModuleComingSoon } from "@/components/features/module-coming-soon";
import { qcMenuBySlug, qcMenuItems } from "../menu-config";

type QcTopicPageProps = {
  params: Promise<{ topic: string }>;
};

export default async function QcTopicPage({ params }: QcTopicPageProps) {
  const { topic } = await params;
  const menu = qcMenuBySlug.get(topic);
  if (!menu) {
    notFound();
  }

  return (
    <ModuleComingSoon
      moduleName="QC"
      pageTitle={menu.label}
      description={menu.description}
      roadmapItems={menu.roadmap}
      menuLinks={qcMenuItems.map((item) => ({ href: item.href, label: item.label }))}
    />
  );
}
