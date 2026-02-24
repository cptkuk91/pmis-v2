import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import ExternalLinkItem from "@/models/ExternalLinkItem";

const categoryAliasMap: Record<string, string> = {
  laws: "laws",
  law: "laws",
  ks: "ks",
  pro: "pro-sites",
  "pro-sites": "pro-sites",
  construction: "pro-sites",
};

const defaultExternalLinks = {
  laws: [
    {
      _id: "default-law-1",
      category: "laws",
      name: "국가법령정보센터",
      url: "https://www.law.go.kr",
      description: "건설/안전 관련 법령 검색",
    },
  ],
  ks: [
    {
      _id: "default-ks-1",
      category: "ks",
      name: "국가표준인증 통합정보시스템",
      url: "https://www.standard.go.kr",
      description: "KS 규격 검색",
    },
  ],
  "pro-sites": [
    {
      _id: "default-pro-1",
      category: "pro-sites",
      name: "건설기술정보시스템",
      url: "https://www.codil.or.kr",
      description: "건설 기술/기준 정보",
    },
  ],
  general: [
    {
      _id: "default-general-1",
      category: "general",
      name: "WIS",
      url: "https://wis.example.com",
      description: "출역/안전교육 외부 연계 시스템",
    },
    {
      _id: "default-general-2",
      category: "general",
      name: "DIS",
      url: "https://dis.example.com",
      description: "설계도면 검색/열람 연계 시스템",
    },
    {
      _id: "default-general-3",
      category: "general",
      name: "Support",
      url: "https://support.example.com",
      description: "FAQ/문의 운영 지원 시스템",
    },
  ],
} as const;

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const rawCategory = request.nextUrl.searchParams.get("category") ?? "general";
    const category = categoryAliasMap[rawCategory] ?? rawCategory;

    const filter =
      category === "general"
        ? { isActive: true }
        : { category, isActive: true };

    const items = await ExternalLinkItem.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    if (items.length > 0) {
      return success(items);
    }

    if (category === "laws" || category === "ks" || category === "pro-sites") {
      return success(defaultExternalLinks[category]);
    }

    if (category === "general") {
      return success(defaultExternalLinks.general);
    }

    return success([]);
  } catch (err) {
    return handleApiError(err);
  }
}
