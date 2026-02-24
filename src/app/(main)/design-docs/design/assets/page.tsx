"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FileUpload, FormInput } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type TreeNodeItem = {
  _id: string;
  nodeCode: string;
  nodeName: string;
  sortOrder: number;
  depth: number;
  path: string;
};

type DesignAssetItem = {
  _id: string;
  nodeId: string;
  assetCode: string;
  assetName: string;
  revision: string;
  notes: string;
  fileAssetId?: string | null;
};

type AssetsResponse = {
  ok: boolean;
  data: {
    nodes: TreeNodeItem[];
    assets: DesignAssetItem[];
    parentNode: TreeNodeItem | null;
  };
  error?: string;
};

type UploadResponse = {
  ok: boolean;
  data?: {
    fileAssetId: string;
    originalName: string;
  };
  error?: string;
};

export default function DesignAssetsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [parentNodeId, setParentNodeId] = useState<string | null>(null);
  const [parentNode, setParentNode] = useState<TreeNodeItem | null>(null);
  const [nodes, setNodes] = useState<TreeNodeItem[]>([]);
  const [assets, setAssets] = useState<DesignAssetItem[]>([]);
  const [keyword, setKeyword] = useState("");

  const [nodeCode, setNodeCode] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [revision, setRevision] = useState("0");
  const [notes, setNotes] = useState("");
  const [fileAssetId, setFileAssetId] = useState("");
  const [fileName, setFileName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: keyword });
      if (parentNodeId) {
        params.set("parentNodeId", parentNodeId);
      }
      const response = await fetch(`/api/design/assets?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as AssetsResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "설계자료 조회 실패");
      }
      setNodes(result.data.nodes);
      setAssets(result.data.assets);
      setParentNode(result.data.parentNode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "설계자료 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [keyword, parentNodeId]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  async function handleCreateNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/design/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "node",
          parentNodeId,
          nodeCode,
          nodeName,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "노드 생성 실패");
      }
      setNodeCode("");
      setNodeName("");
      setMessage("노드가 생성되었습니다.");
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "노드 생성 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !parentNodeId) {
      return;
    }
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/design/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "asset",
          nodeId: parentNodeId,
          assetCode,
          assetName,
          revision,
          notes,
          fileAssetId,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "설계자료 등록 실패");
      }
      setAssetCode("");
      setAssetName("");
      setRevision("0");
      setNotes("");
      setFileAssetId("");
      setFileName("");
      setMessage("설계자료가 등록되었습니다.");
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "설계자료 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpload(files: File[]) {
    const file = files[0];
    if (!file) {
      setFileAssetId("");
      setFileName("");
      return;
    }

    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module", "design-assets");
      if (user.userId) {
        formData.append("uploadedBy", user.userId);
      }
      const response = await fetch("/api/files/upload", { method: "POST", body: formData });
      const result = (await response.json()) as UploadResponse;
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "파일 업로드 실패");
      }
      setFileAssetId(result.data.fileAssetId);
      setFileName(result.data.originalName);
      setMessage("파일이 업로드되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 업로드 실패");
    }
  }

  async function handleDeleteNode(nodeId: string) {
    if (!canManage || !confirm("노드를 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/design/assets/${nodeId}?kind=node`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "노드 삭제 실패");
      }
      setMessage("노드가 삭제되었습니다.");
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "노드 삭제 실패");
    }
  }

  async function handleDeleteAsset(assetId: string) {
    if (!canManage || !confirm("설계자료를 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/design/assets/${assetId}?kind=asset`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "설계자료 삭제 실패");
      }
      setMessage("설계자료가 삭제되었습니다.");
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "설계자료 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">설계자료관리(트리)</h1>
        <p className="mt-1 text-sm text-foreground-muted">폴더(트리 노드)와 설계자료를 관리합니다.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <FormInput label="검색어" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="노드코드/노드명/자료코드/자료명" wrapperClassName="min-w-[280px]" />
        <button type="button" onClick={() => void loadAssets()} className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card">
          조회
        </button>
        {parentNodeId ? (
          <button
            type="button"
            onClick={() => {
              setParentNodeId(null);
            }}
            className="mt-6 rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            루트로 이동
          </button>
        ) : null}
      </div>

      {parentNode ? (
        <p className="text-sm text-foreground-muted">
          현재 경로: <span className="font-medium text-foreground">{parentNode.path}</span>
        </p>
      ) : (
        <p className="text-sm text-foreground-muted">현재 경로: / (루트)</p>
      )}

      {canManage ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form onSubmit={handleCreateNode} className="space-y-3 rounded-lg border border-border bg-background-soft p-4">
            <h2 className="text-sm font-semibold text-foreground">노드 생성</h2>
            <FormInput label="노드코드" value={nodeCode} onChange={(event) => setNodeCode(event.target.value.toUpperCase())} placeholder="미입력 시 자동생성" />
            <FormInput label="노드명" value={nodeName} onChange={(event) => setNodeName(event.target.value)} required />
            <button type="submit" disabled={isSubmitting} className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60">
              노드 생성
            </button>
          </form>

          <form onSubmit={handleCreateAsset} className="space-y-3 rounded-lg border border-border bg-background-soft p-4">
            <h2 className="text-sm font-semibold text-foreground">설계자료 등록</h2>
            <p className="text-xs text-foreground-muted">자료 등록은 선택된 부모 노드가 있을 때 가능합니다.</p>
            <FormInput label="자료코드" value={assetCode} onChange={(event) => setAssetCode(event.target.value.toUpperCase())} required />
            <FormInput label="자료명" value={assetName} onChange={(event) => setAssetName(event.target.value)} required />
            <FormInput label="Rev" value={revision} onChange={(event) => setRevision(event.target.value)} />
            <FormInput label="비고" value={notes} onChange={(event) => setNotes(event.target.value)} />
            <FileUpload label="첨부파일" multiple={false} onFilesChange={(files) => void handleUpload(files)} />
            {fileName ? <p className="text-xs text-foreground-muted">첨부: {fileName} ({fileAssetId})</p> : null}
            <button type="submit" disabled={isSubmitting || !parentNodeId} className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60">
              자료 등록
            </button>
          </form>
        </div>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">설계자료 관리는 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<TreeNodeItem>
        columns={[
          { key: "nodeCode", header: "노드코드", className: "w-28" },
          { key: "nodeName", header: "노드명" },
          { key: "path", header: "경로" },
          {
            key: "_id",
            header: "작업",
            className: "w-36",
            render: (_, row) => (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setParentNodeId(row._id)}
                  className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                >
                  열기
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteNode(row._id)}
                    className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                  >
                    삭제
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
        data={nodes}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "하위 노드가 없습니다."}
      />

      <DataTable<DesignAssetItem>
        columns={[
          { key: "assetCode", header: "자료코드", className: "w-28" },
          { key: "assetName", header: "자료명" },
          { key: "revision", header: "Rev", className: "w-16" },
          { key: "notes", header: "비고" },
          { key: "fileAssetId", header: "첨부", className: "w-32", render: (value) => (value ? "있음" : "-") },
          {
            key: "_id",
            header: "관리",
            className: "w-20",
            render: (_, row) =>
              canManage ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteAsset(row._id)}
                  className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  삭제
                </button>
              ) : (
                "-"
              ),
          },
        ]}
        data={assets}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 설계자료가 없습니다."}
      />
    </section>
  );
}
