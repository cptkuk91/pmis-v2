import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DesignTreeNode from "@/models/DesignTreeNode";
import DesignAsset from "@/models/DesignAsset";
import { logCreate } from "@/lib/audit-logger";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type NodeLean = {
  _id: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  parentNodeId?: mongoose.Types.ObjectId;
  nodeCode: string;
  nodeName: string;
  sortOrder: number;
  depth: number;
  path: string;
};

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success({ nodes: [], assets: [], parentNode: null });
    }

    const parentNodeId = request.nextUrl.searchParams.get("parentNodeId");
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    if (parentNodeId && !mongoose.Types.ObjectId.isValid(parentNodeId)) {
      throw VALIDATION_ERROR("parentNodeId 형식이 올바르지 않습니다.");
    }

    const nodeFilter: Record<string, unknown> = {
      siteId,
      parentNodeId: parentNodeId ? new mongoose.Types.ObjectId(parentNodeId) : undefined,
    };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      nodeFilter.$or = [{ nodeCode: regex }, { nodeName: regex }];
    }

    const nodes = await DesignTreeNode.find(nodeFilter)
      .sort({ sortOrder: 1, nodeName: 1 })
      .lean();

    const assetFilter: Record<string, unknown> = { siteId };
    if (parentNodeId) {
      assetFilter.nodeId = new mongoose.Types.ObjectId(parentNodeId);
    } else if (!keyword) {
      return success({ nodes, assets: [], parentNode: null });
    }
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      assetFilter.$or = [{ assetCode: regex }, { assetName: regex }, { notes: regex }];
    }
    const assets = await DesignAsset.find(assetFilter)
      .sort({ createdAt: -1 })
      .lean();

    let parentNode: NodeLean | null = null;
    if (parentNodeId) {
      parentNode = (await DesignTreeNode.findOne({ _id: parentNodeId, siteId }).lean()) as NodeLean | null;
      if (!parentNode) {
        throw NOT_FOUND("부모 노드");
      }
    }

    return success({ nodes, assets, parentNode });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body.kind ?? "").trim();
    if (kind !== "node" && kind !== "asset") {
      throw VALIDATION_ERROR("kind는 node 또는 asset만 가능합니다.");
    }

    if (kind === "node") {
      const nodeName = String(body.nodeName ?? "").trim();
      if (!nodeName) {
        throw VALIDATION_ERROR("nodeName은 필수입니다.");
      }

      const requestedParentNodeId = String(body.parentNodeId ?? "").trim();
      if (requestedParentNodeId && !mongoose.Types.ObjectId.isValid(requestedParentNodeId)) {
        throw VALIDATION_ERROR("parentNodeId 형식이 올바르지 않습니다.");
      }

      let parentNode: NodeLean | null = null;
      if (requestedParentNodeId) {
        parentNode = (await DesignTreeNode.findOne({
          _id: requestedParentNodeId,
          siteId,
        }).lean()) as NodeLean | null;
        if (!parentNode) {
          throw NOT_FOUND("부모 노드");
        }
      }

      const nodeCode = String(body.nodeCode ?? "").trim() || `NODE-${Date.now()}`;
      const sortOrderRaw = Number(body.sortOrder ?? 0);
      const depth = parentNode ? parentNode.depth + 1 : 0;
      const path = parentNode ? `${parentNode.path}/${nodeName}` : `/${nodeName}`;

      const createdNode = await DesignTreeNode.create({
        siteId,
        parentNodeId: parentNode?._id ?? undefined,
        nodeCode,
        nodeName,
        sortOrder: Number.isFinite(sortOrderRaw) ? Math.floor(sortOrderRaw) : 0,
        depth,
        path,
        createdBy: requester.userId ?? undefined,
        updatedBy: requester.userId ?? undefined,
      });

      await logCreate(String(siteId), "design_asset", String(createdNode._id), requester);
      return success({ kind, item: createdNode });
    }

    const assetCode = String(body.assetCode ?? "").trim();
    const assetName = String(body.assetName ?? "").trim();
    const nodeId = String(body.nodeId ?? "").trim();
    const rawFileAssetId = String(body.fileAssetId ?? "").trim();

    if (!assetCode) {
      throw VALIDATION_ERROR("assetCode는 필수입니다.");
    }
    if (!assetName) {
      throw VALIDATION_ERROR("assetName은 필수입니다.");
    }
    if (!nodeId) {
      throw VALIDATION_ERROR("nodeId는 필수입니다.");
    }
    if (!mongoose.Types.ObjectId.isValid(nodeId)) {
      throw VALIDATION_ERROR("nodeId 형식이 올바르지 않습니다.");
    }
    if (rawFileAssetId && !mongoose.Types.ObjectId.isValid(rawFileAssetId)) {
      throw VALIDATION_ERROR("fileAssetId 형식이 올바르지 않습니다.");
    }

    const node = await DesignTreeNode.findOne({ _id: nodeId, siteId }).lean();
    if (!node) {
      throw NOT_FOUND("설계 트리 노드");
    }

    const createdAsset = await DesignAsset.create({
      siteId,
      nodeId,
      assetCode,
      assetName,
      revision: String(body.revision ?? "0").trim(),
      fileAssetId: rawFileAssetId || undefined,
      notes: String(body.notes ?? "").trim(),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(String(siteId), "design_asset", String(createdAsset._id), requester);
    return success({ kind, item: createdAsset });
  } catch (err) {
    return handleApiError(err);
  }
}
