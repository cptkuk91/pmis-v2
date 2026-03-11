"use client";

import { useEffect, useState, useCallback } from "react";

const SITE_ID_KEY = "pmis:siteId";

type CostData = {
  material: { planTotal: number; actualTotal: number };
  equipment: { planTotal: number; actualTotal: number };
  subcontract: number;
};

export default function ProfitLossPage() {
  const [cost, setCost] = useState<CostData | null>(null);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/resource/profit-loss?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setCost(res.data);
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!cost) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">원가 집계</h1>
        <p className="text-sm text-foreground-muted">데이터를 불러오는 중...</p>
      </section>
    );
  }

  const totalPlan = cost.material.planTotal + cost.equipment.planTotal;
  const totalActual = cost.material.actualTotal + cost.equipment.actualTotal + cost.subcontract;
  const diff = totalPlan - totalActual;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">원가 집계</h1>
        <p className="text-sm text-foreground-muted">
          자재·장비 계획/실적과 승인된 협력사 계약금액을 기준으로 집계합니다. 노무비와 예산
          기준은 아직 포함되지 않습니다.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">자재·장비 계획 합계</p>
          <p className="text-2xl font-bold text-foreground">{totalPlan.toLocaleString()}원</p>
        </div>
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">집계 합계</p>
          <p className="text-2xl font-bold text-foreground">{totalActual.toLocaleString()}원</p>
        </div>
        <div className="rounded-lg border border-border bg-background-card p-4">
          <p className="text-sm text-foreground-muted">계획 대비 참고 차이</p>
          <p className={`text-2xl font-bold ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>{diff >= 0 ? "+" : ""}{diff.toLocaleString()}원</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-background-soft">
            <th className="px-4 py-2 text-left font-medium text-foreground">구분</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">계획 기준</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">집계 금액</th>
            <th className="px-4 py-2 text-right font-medium text-foreground">참고 차이</th>
          </tr></thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-4 py-2 text-foreground">자재비</td>
              <td className="px-4 py-2 text-right text-foreground">{cost.material.planTotal.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-foreground">{cost.material.actualTotal.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-foreground">{(cost.material.planTotal - cost.material.actualTotal).toLocaleString()}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-4 py-2 text-foreground">장비비</td>
              <td className="px-4 py-2 text-right text-foreground">{cost.equipment.planTotal.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-foreground">{cost.equipment.actualTotal.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-foreground">{(cost.equipment.planTotal - cost.equipment.actualTotal).toLocaleString()}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-4 py-2 text-foreground">하도급 계약금액</td>
              <td className="px-4 py-2 text-right text-foreground">-</td>
              <td className="px-4 py-2 text-right text-foreground">{cost.subcontract.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-foreground">-</td>
            </tr>
            <tr className="bg-background-soft font-semibold">
              <td className="px-4 py-2 text-foreground">집계 합계</td>
              <td className="px-4 py-2 text-right text-foreground">{totalPlan.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-foreground">{totalActual.toLocaleString()}</td>
              <td className={`px-4 py-2 text-right ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>{diff >= 0 ? "+" : ""}{diff.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
