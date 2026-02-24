import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DocumentModel from "@/models/Document";
import Drawing from "@/models/Drawing";
import Issue from "@/models/Issue";
import ResourceLibraryItem from "@/models/ResourceLibraryItem";

type UnifiedSource = "document" | "drawing" | "issue" | "library";

type UnifiedSearchItem = {
  id: string;
  source: UnifiedSource;
  code: string;
  title: string;
  summary: string;
  status: string;
  updatedAt: string;
  href: string;
};

function parsePositiveInt(rawValue: string | null, fallback: number, max = 50): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIsoString(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }
  return date.toISOString();
}

function readDateField(
  row: unknown,
  primaryKey: string,
  fallbackKey?: string,
): Date | string | null {
  const record = row as Record<string, unknown>;
  const primary = record[primaryKey];
  if (primary instanceof Date || typeof primary === "string") {
    return primary;
  }
  if (!fallbackKey) {
    return null;
  }
  const fallback = record[fallbackKey];
  if (fallback instanceof Date || typeof fallback === "string") {
    return fallback;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success({
        query: "",
        counts: { documents: 0, drawings: 0, issues: 0, library: 0, total: 0 },
        groups: { documents: [], drawings: [], issues: [], library: [] },
        items: [],
      });
    }

    const query = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 8, 20);

    if (!query) {
      return success({
        query,
        counts: { documents: 0, drawings: 0, issues: 0, library: 0, total: 0 },
        groups: { documents: [], drawings: [], issues: [], library: [] },
        items: [],
      });
    }

    const regex = new RegExp(escapeRegex(query), "i");

    const [documents, drawings, issues, library] = await Promise.all([
      DocumentModel.find({
        siteId,
        $or: [
          { docNo: regex },
          { title: regex },
          { content: regex },
          { senderName: regex },
          { receiverName: regex },
          { categoryCode: regex },
        ],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
      Drawing.find({
        siteId,
        $or: [{ drawingNo: regex }, { drawingName: regex }, { discipline: regex }, { location: regex }, { notes: regex }],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
      Issue.find({
        siteId,
        $or: [{ title: regex }, { content: regex }, { authorName: regex }],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
      ResourceLibraryItem.find({
        siteId,
        $or: [{ title: regex }, { description: regex }, { authorName: regex }, { categoryCode: regex }],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const documentItems: UnifiedSearchItem[] = documents.map((doc) => ({
      id: String(doc._id),
      source: "document",
      code: String(doc.docNo ?? ""),
      title: String(doc.title ?? "(제목 없음)"),
      summary: String(doc.content ?? "").slice(0, 120),
      status: String(doc.status ?? "-"),
      updatedAt: toIsoString(readDateField(doc, "updatedAt", "createdAt")),
      href: "/design-docs/documents/search",
    }));

    const drawingItems: UnifiedSearchItem[] = drawings.map((drawing) => ({
      id: String(drawing._id),
      source: "drawing",
      code: String(drawing.drawingNo ?? ""),
      title: String(drawing.drawingName ?? "(도면명 없음)"),
      summary: [String(drawing.discipline ?? ""), String(drawing.location ?? "")]
        .filter(Boolean)
        .join(" · "),
      status: String(drawing.status ?? "-"),
      updatedAt: toIsoString(readDateField(drawing, "updatedAt", "createdAt")),
      href: "/design-docs/design/drawings",
    }));

    const issueItems: UnifiedSearchItem[] = issues.map((issue) => ({
      id: String(issue._id),
      source: "issue",
      code: String(issue._id),
      title: String(issue.title ?? "(제목 없음)"),
      summary: String(issue.content ?? "").slice(0, 120),
      status: String(issue.status ?? "-"),
      updatedAt: toIsoString(readDateField(issue, "updatedAt", "createdAt")),
      href: "/system-admin/common/issues",
    }));

    const libraryItems: UnifiedSearchItem[] = library.map((item) => ({
      id: String(item._id),
      source: "library",
      code: String(item.categoryCode ?? ""),
      title: String(item.title ?? "(제목 없음)"),
      summary: String(item.description ?? "").slice(0, 120),
      status: String(item.authorName ?? "-"),
      updatedAt: toIsoString(readDateField(item, "updatedAt", "createdAt")),
      href: "/system-admin/common/library",
    }));

    const items = [...documentItems, ...drawingItems, ...issueItems, ...libraryItems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    const counts = {
      documents: documentItems.length,
      drawings: drawingItems.length,
      issues: issueItems.length,
      library: libraryItems.length,
      total: items.length,
    };

    return success({
      query,
      counts,
      groups: {
        documents: documentItems,
        drawings: drawingItems,
        issues: issueItems,
        library: libraryItems,
      },
      items,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
