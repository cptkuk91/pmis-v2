import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DesignTreeNode from "@/models/DesignTreeNode";
import DesignAsset from "@/models/DesignAsset";
import { logUpdate, logDelete } from "@/lib/audit-logger";

type Params = {
  params: Promise<{ itemId: string }>;
};

function resolveKind(request: NextRequest, body?: Record<string, unknown>): "node" | "asset" | null {
  const queryKind = request.nextUrl.searchParams.get("kind");
  if (queryKind === "node" || queryKind === "asset") {
    return queryKind;
  }

  const bodyKind = String(body?.kind ?? "").trim();
  if (bodyKind === "node" || bodyKind === "asset") {
    return bodyKind;
  }

  return null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const kind = resolveKind(request, body);
    if (!kind) {
      throw VALIDATION_ERROR("kind는 node 또는 asset만 가능합니다.");
    }

    if (kind === "node") {
      const node = await DesignTreeNode.findOne({ _id: itemId, siteId });
      if (!node) {
        throw NOT_FOUND("설계 트리 노드");
      }

      const nextNodeCode = body.nodeCode === undefined ? undefined : String(body.nodeCode ?? "").trim();
      const nextNodeName = body.nodeName === undefined ? undefined : String(body.nodeName ?? "").trim();
      const nextSortOrder = body.sortOrder === undefined ? undefined : Number(body.sortOrder);
      if (nextNodeCode !== undefined && !nextNodeCode) {
        throw VALIDATION_ERROR("nodeCode는 비워둘 수 없습니다.");
      }
      if (nextNodeName !== undefined && !nextNodeName) {
        throw VALIDATION_ERROR("nodeName은 비워둘 수 없습니다.");
      }

      if (nextNodeCode !== undefined) {
        node.nodeCode = nextNodeCode;
      }
      if (nextNodeName !== undefined) {
        node.nodeName = nextNodeName;
        const parentPath = node.path.split("/").slice(0, -1).join("/") || "";
        node.path = `${parentPath}/${nextNodeName}`;
      }
      if (nextSortOrder !== undefined && Number.isFinite(nextSortOrder)) {
        node.sortOrder = Math.floor(nextSortOrder);
      }
      node.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
      await node.save();

      await logUpdate(String(siteId), "design_asset", itemId, requester);
      return success({ kind, item: node });
    }

    const asset = await DesignAsset.findOne({ _id: itemId, siteId });
    if (!asset) {
      throw NOT_FOUND("설계 자료");
    }

    const nextAssetCode = body.assetCode === undefined ? undefined : String(body.assetCode ?? "").trim();
    const nextAssetName = body.assetName === undefined ? undefined : String(body.assetName ?? "").trim();
    const rawFileAssetId = body.fileAssetId === undefined ? undefined : String(body.fileAssetId ?? "").trim();
    if (nextAssetCode !== undefined && !nextAssetCode) {
      throw VALIDATION_ERROR("assetCode는 비워둘 수 없습니다.");
    }
    if (nextAssetName !== undefined && !nextAssetName) {
      throw VALIDATION_ERROR("assetName은 비워둘 수 없습니다.");
    }
    if (rawFileAssetId && !mongoose.Types.ObjectId.isValid(rawFileAssetId)) {
      throw VALIDATION_ERROR("fileAssetId 형식이 올바르지 않습니다.");
    }

    if (nextAssetCode !== undefined) {
      asset.assetCode = nextAssetCode;
    }
    if (nextAssetName !== undefined) {
      asset.assetName = nextAssetName;
    }
    if (body.revision !== undefined) {
      asset.revision = String(body.revision ?? "").trim();
    }
    if (body.notes !== undefined) {
      asset.notes = String(body.notes ?? "").trim();
    }
    if (rawFileAssetId !== undefined) {
      asset.fileAssetId = rawFileAssetId ? new mongoose.Types.ObjectId(rawFileAssetId) : undefined;
    }
    if (body.nodeId !== undefined) {
      const nextNodeId = String(body.nodeId ?? "").trim();
      if (!mongoose.Types.ObjectId.isValid(nextNodeId)) {
        throw VALIDATION_ERROR("nodeId 형식이 올바르지 않습니다.");
      }
      const node = await DesignTreeNode.findOne({ _id: nextNodeId, siteId }).lean();
      if (!node) {
        throw NOT_FOUND("설계 트리 노드");
      }
      asset.nodeId = new mongoose.Types.ObjectId(nextNodeId);
    }

    asset.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await asset.save();
    await logUpdate(String(siteId), "design_asset", itemId, requester);
    return success({ kind, item: asset });
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

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const kind = resolveKind(request);
    if (!kind) {
      throw VALIDATION_ERROR("kind는 node 또는 asset만 가능합니다.");
    }

    if (kind === "node") {
      const node = await DesignTreeNode.findOne({ _id: itemId, siteId });
      if (!node) {
        throw NOT_FOUND("설계 트리 노드");
      }

      const [childCount, assetCount] = await Promise.all([
        DesignTreeNode.countDocuments({ siteId, parentNodeId: node._id }),
        DesignAsset.countDocuments({ siteId, nodeId: node._id }),
      ]);
      if (childCount > 0 || assetCount > 0) {
        throw new ApiError("하위 노드 또는 자료가 남아 있어 삭제할 수 없습니다.", 409, "NODE_NOT_EMPTY");
      }

      node.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
      await node.softDelete();
      await logDelete(String(siteId), "design_asset", itemId, requester);
      return success({ kind, id: itemId, deleted: true });
    }

    const asset = await DesignAsset.findOne({ _id: itemId, siteId });
    if (!asset) {
      throw NOT_FOUND("설계 자료");
    }

    asset.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await asset.softDelete();
    await logDelete(String(siteId), "design_asset", itemId, requester);
    return success({ kind, id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
