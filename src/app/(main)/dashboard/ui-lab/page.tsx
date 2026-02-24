"use client";

import { useState } from "react";
import {
  Badge,
  DataTable,
  DatePicker,
  FileUpload,
  FormInput,
  Modal,
  Pagination,
  StatusBadge,
} from "@/components/ui";

type NoticeRow = {
  id: string;
  title: string;
  owner: string;
  status: "in_review" | "approved" | "rejected";
};

const sampleRows: NoticeRow[] = [
  { id: "n-1", title: "공사일보 검토", owner: "김성철", status: "in_review" },
  { id: "n-2", title: "회의록 등록", owner: "오세용", status: "approved" },
  { id: "n-3", title: "자재 승인요청", owner: "한준오", status: "rejected" },
];

export default function UiLabPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  return (
    <section className="space-y-6 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">UI 컴포넌트 테스트</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Phase 1 완료 기준용 테스트 페이지입니다.
        </p>
      </header>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Badge / StatusBadge</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>기본</Badge>
          <Badge tone="info">정보</Badge>
          <Badge tone="success">성공</Badge>
          <Badge tone="warning">주의</Badge>
          <Badge tone="danger">위험</Badge>
          <StatusBadge status="in_review" />
          <StatusBadge status="approved" />
          <StatusBadge status="rejected" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">DataTable</h2>
        <DataTable<NoticeRow>
          columns={[
            { key: "title", header: "제목" },
            { key: "owner", header: "작성자" },
            {
              key: "status",
              header: "상태",
              render: (value) => <StatusBadge status={value as NoticeRow["status"]} />,
            },
          ]}
          data={sampleRows}
          rowKey={(row) => row.id}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormInput label="문서 제목" name="title" placeholder="제목 입력" />
        <DatePicker label="작성일" name="date" defaultValue="2026-02-23" />
      </div>

      <div className="space-y-3">
        <FileUpload label="첨부파일" multiple />
        <Pagination page={page} totalPages={5} onPageChange={setPage} />
      </div>

      <div className="space-y-2">
        <button
          type="button"
          className="rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
          onClick={() => setIsModalOpen(true)}
        >
          모달 열기
        </button>
        <Modal open={isModalOpen} title="결재자 선택" onClose={() => setIsModalOpen(false)}>
          <p className="text-sm text-foreground-muted">
            샘플 모달입니다. 실제 결재선 선택 UI는 Phase 3에서 구현합니다.
          </p>
        </Modal>
      </div>
    </section>
  );
}
