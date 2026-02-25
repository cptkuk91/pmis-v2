import { notFound } from "next/navigation";
import { ModuleComingSoon } from "@/components/features/module-coming-soon";
import { qaMenuBySlug, qaMenuItems } from "../menu-config";

type QaTopicPageProps = {
  params: Promise<{ topic: string }>;
};

export default async function QaTopicPage({ params }: QaTopicPageProps) {
  const { topic } = await params;
  const menu = qaMenuBySlug.get(topic);
  if (!menu) {
    notFound();
  }

  return (
    <ModuleComingSoon
      moduleName="QA"
      pageTitle={menu.label}
      description={menu.description}
      roadmapItems={menu.roadmap}
      menuLinks={qaMenuItems.map((item) => ({ href: item.href, label: item.label }))}
    />
  );
}
