"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FileUpload } from "@/components/ui";
import { useCurrentUser } from "@/hooks/use-current-user";

type MeetingItem = {
  _id: string;
  category: string;
  agenda: string;
  meetingDate: string;
  minutes?: string;
  minutesFileAssetId?: string | null;
};

type UploadResponse = {
  ok: boolean;
  data?: {
    fileAssetId: string;
    originalName: string;
    storagePath: string;
  };
  error?: string;
};

function stringifyObjectId(value: unknown): string {
  if (!value) {
    return "";
  }
  return String(value);
}

export default function SystemMinutesPage() {
  const { user } = useCurrentUser();
  const [items, setItems] = useState<MeetingItem[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [minutes, setMinutes] = useState("");
  const [minutesFileAssetId, setMinutesFileAssetId] = useState("");
  const [minutesFileName, setMinutesFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedMeeting = useMemo(
    () => items.find((item) => item._id === selectedMeetingId),
    [items, selectedMeetingId],
  );

  const loadMeetings = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/meetings?limit=50", { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data: MeetingItem[];
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "회의록 조회 실패");
      }
      setItems(result.data);

      if (result.data.length > 0) {
        setSelectedMeetingId((previous) => previous || result.data[0]._id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의록 조회 실패");
    }
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    setMinutes(selectedMeeting?.minutes ?? "");
    const selectedFileAssetId = stringifyObjectId(selectedMeeting?.minutesFileAssetId);
    setMinutesFileAssetId(selectedFileAssetId);
    setMinutesFileName(selectedFileAssetId ? `첨부 ID: ${selectedFileAssetId}` : "");
  }, [selectedMeeting]);

  async function handleUpload(files: File[]) {
    const first = files[0];
    if (!first) {
      setMinutesFileAssetId("");
      setMinutesFileName("");
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", first);
      formData.append("module", "meeting-minutes");
      if (user.userId) {
        formData.append("uploadedBy", user.userId);
      }

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as UploadResponse;
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "회의록 파일 업로드 실패");
      }
      setMinutesFileAssetId(result.data.fileAssetId);
      setMinutesFileName(result.data.originalName);
      setMessage("회의록 파일이 업로드되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의록 파일 업로드 실패");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave() {
    if (!selectedMeetingId) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/meetings/${selectedMeetingId}/minutes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes, minutesFileAssetId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "회의록 저장 실패");
      }
      setMessage("회의록이 저장되었습니다.");
      await loadMeetings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의록 저장 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">회의록</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          회의를 선택하고 회의록 텍스트/첨부파일을 저장합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <DataTable<MeetingItem>
          columns={[
            { key: "category", header: "구분", className: "w-24" },
            { key: "agenda", header: "안건" },
            {
              key: "meetingDate",
              header: "일자",
              className: "w-28",
              render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
            },
          ]}
          data={items}
          rowKey={(row) => row._id}
          emptyMessage="회의 데이터가 없습니다."
        />

        <div className="space-y-3 rounded-lg border border-border bg-background-soft p-4">
          <label className="block text-sm font-medium text-foreground" htmlFor="meetingId">
            대상 회의
          </label>
          <select
            id="meetingId"
            value={selectedMeetingId}
            onChange={(event) => setSelectedMeetingId(event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            {items.map((item) => (
              <option key={item._id} value={item._id}>
                {item.category} - {item.agenda}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium text-foreground" htmlFor="minutes">
            회의록
          </label>
          <textarea
            id="minutes"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            placeholder="회의록 내용을 입력하세요"
            className="min-h-32 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
          />

          <FileUpload label="회의록 첨부파일" multiple={false} onFilesChange={(files) => void handleUpload(files)} />
          {minutesFileName ? (
            <p className="text-xs text-foreground-muted">
              첨부: {minutesFileName} ({minutesFileAssetId})
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isUploading}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setMinutesFileAssetId("");
                setMinutesFileName("");
              }}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
            >
              첨부 해제
            </button>
          </div>
          {message ? <p className="text-sm text-success">{message}</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
