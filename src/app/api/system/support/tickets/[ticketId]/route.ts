import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logUpdate } from "@/lib/audit-logger";
import SupportTicket from "@/models/SupportTicket";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const { ticketId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw VALIDATION_ERROR("ticketId 형식이 올바르지 않습니다.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    const status = body.status ? String(body.status) : undefined;
    if (status) {
      if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
        throw VALIDATION_ERROR("status 값이 올바르지 않습니다.");
      }
      updates.status = status;
    }

    const priority = body.priority ? String(body.priority) : undefined;
    if (priority) {
      if (!["low", "medium", "high", "urgent"].includes(priority)) {
        throw VALIDATION_ERROR("priority 값이 올바르지 않습니다.");
      }
      updates.priority = priority;
    }

    if (body.assigneeName !== undefined) {
      updates.assigneeName = String(body.assigneeName ?? "").trim() || null;
    }
    if (body.resolution !== undefined) {
      const resolution = String(body.resolution ?? "").trim();
      assertNoUnsafeHtml(resolution, "해결내용");
      updates.resolution = resolution || null;
    }
    if (status === "resolved" || status === "closed") {
      updates.resolvedAt = new Date();
    }
    updates.updatedBy = requester.userId ?? undefined;

    const updated = await SupportTicket.findByIdAndUpdate(ticketId, updates, { new: true }).lean();
    if (!updated) {
      throw NOT_FOUND("support ticket");
    }

    await logUpdate(String(updated.siteId ?? ""), "support_ticket", ticketId, requester);

    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
