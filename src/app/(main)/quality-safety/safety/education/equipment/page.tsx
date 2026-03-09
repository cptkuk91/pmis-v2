"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  DEFAULT_PPE_ITEM,
  DEFAULT_PPE_UNIT_BY_ITEM,
  PPE_ITEM_OPTIONS,
  PPE_SPECIFICATION_OPTIONS,
  PPE_UNIT_OPTIONS,
  type PPEItemName,
  type PPEUnit,
} from "@/lib/ppe-options";

type PPERow = {
  _id: string;
  itemName: PPEItemName;
  specification: string;
  quantity: number;
  unit: PPEUnit;
  recipientName: string;
  recipientCompany: string;
  distributionDate: string;
};

type PPEItemForm = {
  id: string;
  itemName: PPEItemName;
  specification: string;
  quantity: string;
  unit: PPEUnit;
};

type PPEFormState = {
  recipientName: string;
  recipientCompany: string;
  distributionDate: string;
  items: PPEItemForm[];
};

const SITE_ID_KEY = "pmis:siteId";
const columns: DataTableColumn<PPERow>[] = [
  { key: "itemName", header: "품목" },
  { key: "specification", header: "규격" },
  {
    key: "quantity",
    header: "수량",
    className: "w-16 text-right",
    render: (_value, row) => row.quantity?.toLocaleString(),
  },
  { key: "unit", header: "단위", className: "w-16" },
  { key: "recipientName", header: "수령자" },
  { key: "recipientCompany", header: "소속" },
  {
    key: "distributionDate",
    header: "지급일",
    className: "w-28",
    render: (_value, row) => row.distributionDate?.slice(0, 10),
  },
];

function createItem(id: string): PPEItemForm {
  return {
    id,
    itemName: DEFAULT_PPE_ITEM,
    specification: "",
    quantity: "",
    unit: DEFAULT_PPE_UNIT_BY_ITEM[DEFAULT_PPE_ITEM],
  };
}

function createEmptyForm(): PPEFormState {
  return {
    recipientName: "",
    recipientCompany: "",
    distributionDate: "",
    items: [createItem("item-1")],
  };
}

export default function SafetyEquipmentPage() {
  const [data, setData] = useState<PPERow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PPEFormState>(createEmptyForm);
  const [nextItemKey, setNextItemKey] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback((nextPage: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }
    fetch(`/api/safety/ppe?siteId=${siteId}&page=${nextPage}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) {
          setData(Array.isArray(result.data) ? result.data : []);
          setTotalPages(result.meta?.totalPages ?? 1);
        }
      })
      .catch(() => {
        setError("보호구 지급 내역 조회 실패");
      });
  }, []);

  useEffect(() => {
    setError(null);
    fetchData(page);
  }, [page, fetchData]);

  function resetForm() {
    setForm(createEmptyForm());
    setNextItemKey(2);
  }

  function updateItem(itemId: string, updater: (item: PPEItemForm) => PPEItemForm) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }));
  }

  function handleAddItem() {
    const nextId = `item-${nextItemKey}`;
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, createItem(nextId)],
    }));
    setNextItemKey((prev) => prev + 1);
  }

  function handleRemoveItem(itemId: string) {
    setForm((prev) => {
      if (prev.items.length === 1) {
        return prev;
      }
      return {
        ...prev,
        items: prev.items.filter((item) => item.id !== itemId),
      };
    });
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);

    if (!form.recipientName.trim()) {
      setError("수령자를 입력해 주세요.");
      return;
    }
    if (!form.distributionDate) {
      setError("지급일을 입력해 주세요.");
      return;
    }

    const invalidItem = form.items.find((item) => Number(item.quantity) <= 0);
    if (invalidItem) {
      setError("모든 지급 품목의 수량을 1 이상 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/safety/ppe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          recipientName: form.recipientName.trim(),
          recipientCompany: form.recipientCompany.trim(),
          distributionDate: form.distributionDate,
          items: form.items.map((item) => ({
            itemName: item.itemName,
            specification: item.specification.trim(),
            quantity: Number(item.quantity),
            unit: item.unit,
          })),
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string; data?: { insertedCount?: number } };
      if (!result.ok) {
        throw new Error(result.error ?? "보호구 지급 등록 실패");
      }

      setShowForm(false);
      resetForm();
      setMessage(
        `${result.data?.insertedCount ?? form.items.length}건의 보호구 지급 내역이 등록되었습니다.`,
      );
      fetchData(1);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "보호구 지급 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">보호구 지급</h1>
        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setError(null);
            setMessage(null);
          }}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <form
          className="space-y-4 rounded-lg border border-border bg-background-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">수령자 *</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.recipientName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, recipientName: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">소속</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.recipientCompany}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, recipientCompany: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">지급일 *</span>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.distributionDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, distributionDate: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">지급 품목</h2>
                <p className="text-xs text-foreground-muted">
                  동일 수령자에게 지급한 보호구를 한 번에 등록합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                + 품목 추가
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-border bg-background-card p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">품목 {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={form.items.length === 1}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground-muted hover:bg-background-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">품목 *</span>
                      <select
                        className="h-9 w-full rounded-md border border-border px-3 text-sm"
                        value={item.itemName}
                        onChange={(event) => {
                          const nextItemName = event.target.value as PPEItemName;
                          updateItem(item.id, (current) => ({
                            ...current,
                            itemName: nextItemName,
                            unit:
                              current.unit === DEFAULT_PPE_UNIT_BY_ITEM[current.itemName]
                                ? DEFAULT_PPE_UNIT_BY_ITEM[nextItemName]
                                : current.unit,
                            specification: "",
                          }));
                        }}
                      >
                        {PPE_ITEM_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">규격</span>
                      <input
                        list={`ppe-specification-${item.id}`}
                        className="h-9 w-full rounded-md border border-border px-3 text-sm"
                        value={item.specification}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            specification: event.target.value,
                          }))
                        }
                        placeholder="추천 규격 선택 또는 직접 입력"
                      />
                      <datalist id={`ppe-specification-${item.id}`}>
                        {PPE_SPECIFICATION_OPTIONS[item.itemName].map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">수량 *</span>
                      <input
                        type="number"
                        min={1}
                        className="h-9 w-full rounded-md border border-border px-3 text-sm"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            quantity: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">단위</span>
                      <select
                        className="h-9 w-full rounded-md border border-border px-3 text-sm"
                        value={item.unit}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            unit: event.target.value as PPEUnit,
                          }))
                        }
                      >
                        {PPE_UNIT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      ) : null}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}
    </section>
  );
}
