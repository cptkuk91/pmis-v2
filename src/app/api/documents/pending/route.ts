import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";

type PendingDoc = {
  _id: string;
  docNo: string;
  title: string;
  status: string;
  updatedAt: Date | null;
};

export async function GET(request: NextRequest) {
  try {
    await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success<PendingDoc[]>([]);
    }

    const db = mongoose.connection.db;
    if (!db) {
      return success<PendingDoc[]>([]);
    }

    const docs = (await db
      .collection("documents")
      .find({
        siteId: new mongoose.Types.ObjectId(siteId),
        status: { $in: ["draft", "in_review"] },
      })
      .project({ docNo: 1, title: 1, status: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(20)
      .toArray()) as PendingDoc[];

    return success(docs);
  } catch (err) {
    return handleApiError(err);
  }
}
