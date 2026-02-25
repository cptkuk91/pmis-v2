export type QaMenuItem = {
  slug: string;
  href: string;
  label: string;
  description: string;
  roadmap: string[];
};

export type QaMenuGroup = {
  id: string;
  label: string;
  items: QaMenuItem[];
};

export const qaMenuGroups: QaMenuGroup[] = [
  {
    id: "strategy",
    label: "전략·기준",
    items: [
      {
        slug: "policy-goals",
        href: "/qa/policy-goals",
        label: "품질 정책·목표",
        description: "현장 품질 정책, 연간 목표, 핵심 품질 지표 정의",
        roadmap: [
          "현장/본사 공통 품질 정책 템플릿 제공",
          "현장별 품질 목표 및 목표치 관리",
          "분기별 품질 목표 달성률 리포트",
        ],
      },
      {
        slug: "assurance-plan",
        href: "/qa/assurance-plan",
        label: "품질보증계획 (QAP)",
        description: "프로젝트 단위 품질보증계획 수립 및 개정 이력 관리",
        roadmap: [
          "QAP 버전 관리 및 승인 워크플로",
          "공종/공정별 품질보증 체크 포인트 정의",
          "계획 대비 실행률 대시보드",
        ],
      },
      {
        slug: "procedures",
        href: "/qa/procedures",
        label: "표준 절차·템플릿",
        description: "업무 표준 절차서(SOP)와 문서 템플릿 관리",
        roadmap: [
          "표준 절차서 카테고리/버전 관리",
          "문서 작성 템플릿 연동",
          "현장 적용 여부 및 최신본 추적",
        ],
      },
    ],
  },
  {
    id: "governance",
    label: "운영·개선",
    items: [
      {
        slug: "audits",
        href: "/qa/audits",
        label: "내부 심사",
        description: "정기/수시 품질 내부 심사 계획과 결과 관리",
        roadmap: [
          "심사 일정 캘린더 및 체크리스트",
          "심사 결과(적합/부적합) 기록",
          "시정조치와 연동된 후속 추적",
        ],
      },
      {
        slug: "capa",
        href: "/qa/capa",
        label: "개선조치 (CAPA)",
        description: "시정조치/예방조치 등록, 책임자 배정, 기한 관리",
        roadmap: [
          "원인 분석(5Why) 기록",
          "조치 계획-실행-검증 단계 관리",
          "미완료 CAPA 알림 및 에스컬레이션",
        ],
      },
      {
        slug: "partner-assurance",
        href: "/qa/partner-assurance",
        label: "협력사 품질보증",
        description: "협력사 품질 수준 평가와 개선 활동 이력 관리",
        roadmap: [
          "협력사 품질평가 기준/등급 관리",
          "협력사별 개선 요청 및 완료 추적",
          "협력사 품질 리스크 조기 경보",
        ],
      },
    ],
  },
  {
    id: "insights",
    label: "성과",
    items: [
      {
        slug: "kpi",
        href: "/qa/kpi",
        label: "품질 KPI",
        description: "불량률, 재작업률, 심사결과 등 핵심 품질지표 통합 관리",
        roadmap: [
          "KPI 정의 및 지표 산식 설정",
          "월/분기 추이 차트 및 현장 비교",
          "임계치 초과 시 알림 규칙",
        ],
      },
    ],
  },
];

export const qaMenuItems = qaMenuGroups.flatMap((group) => group.items);
export const qaMenuBySlug = new Map(qaMenuItems.map((item) => [item.slug, item]));
