import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import Notice from "@/models/Notice";

type Params = {
  params: Promise<{ noticeId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { noticeId } = await params;
    if (!mongoose.Types.ObjectId.isValid(noticeId)) {
      throw VALIDATION_ERROR("noticeId 형식이 올바르지 않습니다.");
    }

    const notice = await Notice.findOne({ _id: noticeId, siteId });
    if (!notice) {
      throw NOT_FOUND("공지사항");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextTitle = body.title === undefined ? undefined : String(body.title ?? "").trim();
    const nextContent = body.content === undefined ? undefined : String(body.content ?? "").trim();

    if (nextTitle !== undefined && !nextTitle) {
      throw VALIDATION_ERROR("제목은 비워둘 수 없습니다.");
    }
    if (nextContent !== undefined && !nextContent) {
      throw VALIDATION_ERROR("내용은 비워둘 수 없습니다.");
    }

    if (nextTitle !== undefined) {
      notice.title = nextTitle;
    }
    if (nextContent !== undefined) {
      notice.content = nextContent;
    }
    if (body.isPinned !== undefined) {
      notice.isPinned = Boolean(body.isPinned);
    }
    notice.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await notice.save();

    await logUpdate(siteId, "notice", noticeId, requester);

    return success(notice);
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

    const { noticeId } = await params;
    if (!mongoose.Types.ObjectId.isValid(noticeId)) {
      throw VALIDATION_ERROR("noticeId 형식이 올바르지 않습니다.");
    }

    const notice = await Notice.findOne({ _id: noticeId, siteId });
    if (!notice) {
      throw NOT_FOUND("공지사항");
    }

    notice.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;
    await notice.softDelete();

    await logDelete(siteId, "notice", noticeId, requester);

    return success({ id: noticeId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
