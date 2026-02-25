export type QcMenuItem = {
  slug: string;
  href: string;
  label: string;
  description: string;
  roadmap: string[];
};

export type QcMenuGroup = {
  id: string;
  label: string;
  items: QcMenuItem[];
};

export const qcMenuGroups: QcMenuGroup[] = [
  {
    id: "planning",
    label: "검사 계획",
    items: [
      {
        slug: "itp",
        href: "/qc/itp",
        label: "검사·시험 계획 (ITP)",
        description: "공종별 검사 포인트와 시험 항목 계획 관리",
        roadmap: [
          "공종별 ITP 템플릿 관리",
          "검사 항목, 기준, 담당자 매핑",
          "진행 단계별 검사 일정 연동",
        ],
      },
      {
        slug: "material-inspection",
        href: "/qc/material-inspection",
        label: "자재 검사",
        description: "반입 자재 품질 검사 및 합격/불합격 관리",
        roadmap: [
          "자재 검사 체크리스트 및 판정 기록",
          "불합격 자재 반출/재검 이력",
          "자재별 시험성적서 첨부 관리",
        ],
      },
      {
        slug: "process-inspection",
        href: "/qc/process-inspection",
        label: "공정 검사",
        description: "시공 단계별 공정 품질 점검과 시정 요청 관리",
        roadmap: [
          "공정별 검사 일정 및 담당자 지정",
          "검사 결과와 사진 증빙 첨부",
          "시정 요청/조치 완료 추적",
        ],
      },
    ],
  },
  {
    id: "records",
    label: "결과·이슈",
    items: [
      {
        slug: "test-reports",
        href: "/qc/test-reports",
        label: "시험 성적서",
        description: "현장 시험 결과 및 성적서 보관/조회",
        roadmap: [
          "시험 결과 입력 및 승인 프로세스",
          "성적서 파일 버전 이력 관리",
          "기준치 이탈 항목 자동 표시",
        ],
      },
      {
        slug: "nonconformance",
        href: "/qc/nonconformance",
        label: "NCR 관리",
        description: "부적합(NCR) 등록, 원인분석, 조치 완료 추적",
        roadmap: [
          "NCR 등록 및 상태 워크플로",
          "원인분석/재발방지 대책 기록",
          "미종결 NCR 알림 및 리마인드",
        ],
      },
      {
        slug: "handover-inspection",
        href: "/qc/handover-inspection",
        label: "인수·준공 검사",
        description: "인수검사 및 준공검사 결과 통합 관리",
        roadmap: [
          "인수/준공 검사 체크시트 표준화",
          "검사 결과 판정 및 보완 요청",
          "완료 승인 이력 및 증빙 파일 연동",
        ],
      },
    ],
  },
  {
    id: "insights",
    label: "분석",
    items: [
      {
        slug: "quality-dashboard",
        href: "/qc/quality-dashboard",
        label: "품질 대시보드",
        description: "검사 합격률, NCR 추이, 공종별 품질 리스크 시각화",
        roadmap: [
          "현장/공종별 합격률 추이 차트",
          "NCR 발생 원인 분포 분석",
          "리스크 높은 구간 우선순위 추천",
        ],
      },
    ],
  },
];

export const qcMenuItems = qcMenuGroups.flatMap((group) => group.items);
export const qcMenuBySlug = new Map(qcMenuItems.map((item) => [item.slug, item]));
