import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import SiteMembership from "@/models/SiteMembership";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();

    const memberships = await SiteMembership.find({
      siteId: new mongoose.Types.ObjectId(siteId),
      isActive: true,
      isDeleted: false,
    })
      .populate("userId", "name email role isActive isDeleted")
      .sort({ assignedAt: 1 })
      .lean();

    const normalizedKeyword = keyword.toLowerCase();
    const regex = keyword ? new RegExp(escapeRegex(keyword), "i") : null;

    const users = memberships
      .map((item) => {
        const user =
          item.userId && typeof item.userId === "object"
            ? (item.userId as {
                _id?: unknown;
                name?: string;
                email?: string;
                role?: string;
                isActive?: boolean;
                isDeleted?: boolean;
              })
            : null;

        return {
          _id: user?._id ? String(user._id) : "",
          name: String(user?.name ?? ""),
          email: String(user?.email ?? ""),
          role: String(user?.role ?? "viewer"),
          isActive: Boolean(user?.isActive),
          isDeleted: Boolean(user?.isDeleted),
          membershipRole: String(item.role ?? "viewer"),
        };
      })
      .filter((item) => item._id && item.name && item.isActive && !item.isDeleted)
      .filter((item) => {
        if (!regex) {
          return true;
        }
        return (
          regex.test(item.name) ||
          regex.test(item.email) ||
          item.role.toLowerCase().includes(normalizedKeyword) ||
          item.membershipRole.toLowerCase().includes(normalizedKeyword)
        );
      })
      .map((item) => ({
        _id: item._id,
        name: item.name,
        email: item.email,
        role: item.role,
        membershipRole: item.membershipRole,
      }));

    return success(users);
  } catch (err) {
    return handleApiError(err);
  }
}
