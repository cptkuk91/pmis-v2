import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import Issue from "@/models/Issue";

type Params = {
  params: Promise<{ issueId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { issueId } = await params;
    if (!mongoose.Types.ObjectId.isValid(issueId)) {
      throw VALIDATION_ERROR("issueId 형식이 올바르지 않습니다.");
    }

    const issue = await Issue.findOne({ _id: issueId, siteId });
    if (!issue) {
      throw NOT_FOUND("이슈");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextTitle = body.title === undefined ? undefined : String(body.title ?? "").trim();
    const nextContent = body.content === undefined ? undefined : String(body.content ?? "").trim();
    const nextStatus = body.status === undefined ? undefined : String(body.status ?? "").trim();

    if (nextTitle !== undefined && !nextTitle) {
      throw VALIDATION_ERROR("제목은 비워둘 수 없습니다.");
    }
    if (nextContent !== undefined && !nextContent) {
      throw VALIDATION_ERROR("내용은 비워둘 수 없습니다.");
    }
    if (nextStatus !== undefined && nextStatus !== "open" && nextStatus !== "closed") {
      throw VALIDATION_ERROR("상태는 open 또는 closed만 가능합니다.");
    }

    if (nextTitle !== undefined) {
      issue.title = nextTitle;
    }
    if (nextContent !== undefined) {
      issue.content = nextContent;
    }
    if (nextStatus === "open" || nextStatus === "closed") {
      issue.status = nextStatus;
    }
    issue.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await issue.save();

    logUpdate(siteId, "issue", issueId, requester, { updatedFields: Object.keys(body) });
    return success(issue);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { issueId } = await params;
    if (!mongoose.Types.ObjectId.isValid(issueId)) {
      throw VALIDATION_ERROR("issueId 형식이 올바르지 않습니다.");
    }

    const issue = await Issue.findOne({ _id: issueId, siteId });
    if (!issue) {
      throw NOT_FOUND("이슈");
    }

    issue.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;
    await issue.softDelete();

    logDelete(siteId, "issue", issueId, requester);
    return success({ id: issueId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
