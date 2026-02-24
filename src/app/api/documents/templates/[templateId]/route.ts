import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import FormTemplate from "@/models/FormTemplate";

type Params = {
  params: Promise<{ templateId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { templateId } = await params;
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      throw VALIDATION_ERROR("templateId 형식이 올바르지 않습니다.");
    }

    const template = await FormTemplate.findOne({ _id: templateId, siteId });
    if (!template) {
      throw NOT_FOUND("양식");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextCode = body.templateCode === undefined ? undefined : String(body.templateCode ?? "").trim().toUpperCase();
    const nextName = body.templateName === undefined ? undefined : String(body.templateName ?? "").trim();
    if (nextCode !== undefined && !nextCode) {
      throw VALIDATION_ERROR("templateCode는 비워둘 수 없습니다.");
    }
    if (nextName !== undefined && !nextName) {
      throw VALIDATION_ERROR("templateName은 비워둘 수 없습니다.");
    }

    if (nextCode !== undefined) {
      template.templateCode = nextCode;
    }
    if (nextName !== undefined) {
      template.templateName = nextName;
    }
    if (body.description !== undefined) {
      template.description = String(body.description ?? "").trim();
    }
    if (body.body !== undefined) {
      template.body = String(body.body ?? "").trim();
    }
    if (body.sortOrder !== undefined) {
      template.sortOrder = Number(body.sortOrder ?? 0);
    }
    if (body.isActive !== undefined) {
      template.isActive = Boolean(body.isActive);
    }
    template.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await template.save();

    logUpdate(siteId, "form_template", templateId, requester, { updatedFields: Object.keys(body) });
    return success(template);
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

    const { templateId } = await params;
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      throw VALIDATION_ERROR("templateId 형식이 올바르지 않습니다.");
    }

    const template = await FormTemplate.findOne({ _id: templateId, siteId });
    if (!template) {
      throw NOT_FOUND("양식");
    }

    template.isActive = false;
    template.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await template.softDelete();
    logDelete(siteId, "form_template", templateId, requester);
    return success({ id: templateId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
