# PMIS

건설 현장 운영을 위한 `Next.js + MongoDB` 기반 PMIS(Project Management Information System)입니다.  
현재 저장소는 단순 프로토타입이 아니라, 대시보드·현장정보·공정·자원조달·QA·QC·안전·설계문서·시스템 관리까지 실제 업무 흐름을 갖춘 단일 웹 애플리케이션을 목표로 유지되고 있습니다.

이 프로젝트는 `Codex`, `Claude`, `Openclaw`를 활용해 개발되었습니다.

이 문서는 `main` 기준 현재 코드 상태를 빠르게 파악하기 위한 요약 가이드입니다.  
세부 운영 절차와 사용자 흐름은 [`docs/operations-manual.md`](./docs/operations-manual.md)를 기준 문서로 봐야 합니다.

## 1. 프로젝트 개요

- 패키지명: `pmis-init`
- 기본 포트: `3070`
- 인증: `Auth.js(NextAuth v5 beta) + Google OAuth`
- 데이터 저장소: `MongoDB + Mongoose`
- 라우팅: `Next.js App Router`
- 현장 컨텍스트: 사용자-현장 매핑 기반 멀티 사이트 지원
- 권한 모델: `super_admin`, `site_admin`, `manager`, `viewer`
- 개발 편의: 비운영 환경에서는 `PMIS_REQUIRE_LOGIN != true`일 때 인증 우회 가능

## 2. 현재 구현 범위

현재 기준 주요 업무 영역은 다음과 같습니다.

- 대시보드: 결재 대기 문서, 도면 검토 대기, 금일 회의, 오픈 이슈, 공지, QA/QC 운영 경고
- 현장 정보: 개요, 관계자, 기술 문서, 방문자
- 공정 관리: 리포트, 공정표, 진도 비교, 일정 캘린더, 날씨
- 자원·조달: 자재/장비 계획대비, 공급원 승인, 출역, 하도급, 손익
- QA: 품질 정책·목표, QAP, 절차서, 내부 심사, CAPA, 협력사 품질보증, KPI
- QC: ITP, 자재 검사, 공정 검사, 시험 성적서, NCR, 인수·준공 검사, 품질 대시보드
- 안전: 정책, 규정, 법령, 교육, 점검, 운영 관리, 무재해/마일리지, 시설
- 설계·문서: 도면, 도면검토, 설계변경, 설계자료 트리, 문서 작성/대장/검색/분류
- 시스템 관리: 회의, 이슈, 자료실, 외부사이트, 코드관리, 현장/권한 매핑, Support

`/qa/[topic]`, `/qc/[topic]` 같은 placeholder 브리지 라우트는 남아 있지만, 실제 핵심 QA/QC 화면은 개별 경로로 구현돼 있습니다.

## 3. 기술 스택

### Application

- `Next.js 16.1.6`
- `React 19.2.3`
- `TypeScript 5`
- `Tailwind CSS v4`
- `React Hook Form + Zod`
- `TanStack Table`
- `Recharts`
- `date-fns`

### Backend / Data

- `Next.js Route Handlers`
- `MongoDB`
- `Mongoose 9.2.1`
- `Auth.js / NextAuth 5 beta`

### Tooling

- `ESLint 9`
- `Prettier`
- `prettier-plugin-tailwindcss`

## 4. 빠른 시작

### 4.1 의존성 설치

```bash
npm install
```

### 4.2 개발 서버

```bash
npm run dev
```

- 접속 URL: `http://localhost:3070`

### 4.3 프로덕션 빌드/실행

```bash
npm run build
npm start
```

## 5. 환경 변수

코드에서 실제 사용하는 핵심 환경 변수는 아래 기준으로 정리합니다.

| 변수명 | 필수 | 설명 |
|---|---|---|
| `MONGODB_URI` | 예 | MongoDB 연결 문자열 |
| `AUTH_GOOGLE_ID` | 권장 | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | 권장 | Google OAuth Client Secret |
| `GOOGLE_CLIENT_ID` | 대체 | `AUTH_GOOGLE_ID` 대신 사용할 수 있는 키 |
| `GOOGLE_CLIENT_SECRET` | 대체 | `AUTH_GOOGLE_SECRET` 대신 사용할 수 있는 키 |
| `NEXTAUTH_SECRET` | 운영 권장 | Auth.js 세션 암호화 키 |
| `NEXTAUTH_URL` | 운영 권장 | 서비스 기본 URL |
| `PMIS_REQUIRE_LOGIN` | 조건부 | `true`면 로그인 강제, 그 외 값이면 개발 환경에서 인증 우회 가능 |

예시:

```env
MONGODB_URI=mongodb+srv://...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3070
PMIS_REQUIRE_LOGIN=false
```

주의:

- `.env.local`은 Git에 커밋하지 않습니다.
- 운영에서는 `PMIS_REQUIRE_LOGIN=true`를 권장합니다.
- Google OAuth 키는 `AUTH_GOOGLE_*` 또는 `GOOGLE_CLIENT_*` 한 쌍이 필요합니다.

## 6. NPM 스크립트

현재 `package.json` 기준 스크립트는 다음과 같습니다.

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 (`3070`) |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 실행 (`3070`) |
| `npm run lint` | ESLint 실행 |
| `npm run backfill:site-coordinates` | 현장 좌표 백필 |
| `npm run phase6:team1:e2e` | E2E smoke 점검 스크립트 |
| `npm run phase6:team1:perf` | 성능 점검 스크립트 |
| `npm run phase6:team1:index` | 인덱스 점검 스크립트 |
| `npm run phase6:team1:security` | 보안 점검 스크립트 |
| `npm run phase6:team2:audit` | 감사 범위 점검 스크립트 |

참고:

- `scripts/` 아래에는 유지보수용 일회성 스크립트가 일부 남아 있을 수 있지만, 현재 `package.json`에는 seed 실행 스크립트를 노출하지 않습니다.

## 7. 폴더 구조

```text
src/
  app/
    (auth)/                  # 로그인/권한 없음
    (main)/                  # 실제 업무 화면
    api/                     # Route Handlers
  components/
    layout/                  # 상단/사이드/알림/위젯
    qa/                      # QA 공통 UI
    ui/                      # Modal, Table, Banner 등 공통 컴포넌트
  hooks/                     # 사용자/현장/멤버 조회 훅
  lib/                       # auth, db, permissions, payload, summary, helpers
  models/                    # Mongoose 모델
  types/                     # 공통 타입, next-auth 확장

docs/
  operations-manual.md       # 통합 운영 매뉴얼
  runbook.md                 # 장애 대응 및 배포 Runbook
  roadmap.md                 # 로드맵

scripts/
  backfill-site-coordinates.ts
  seed-qa-module.ts
  seed-qc-module.ts
  seed-workforce-codes.ts
```

## 8. 대표 메뉴와 경로

상세 라우트 전체를 README에 고정하지 않고, 운영상 자주 보는 대표 경로만 정리합니다.

| 영역 | 대표 경로 |
|---|---|
| 대시보드 | `/dashboard`, `/dashboard/notices`, `/dashboard/pending-docs`, `/dashboard/meetings` |
| 현장 정보 | `/site-info/overview`, `/site-info/people`, `/site-info/technical-docs`, `/site-info/visitors` |
| 공정 관리 | `/progress`, `/progress/reports`, `/progress/master-schedule`, `/progress/calendar`, `/progress/weather` |
| 자원·조달 | `/resource-procurement/materials/plan-actual`, `/resource-procurement/equipment/plan-actual`, `/resource-procurement/supplier-approvals`, `/resource-procurement/workforce/daily` |
| QA | `/qa/policy-goals`, `/qa/assurance-plan`, `/qa/procedures`, `/qa/audits`, `/qa/capa`, `/qa/partner-assurance`, `/qa/kpi` |
| QC | `/qc/itp`, `/qc/material-inspection`, `/qc/process-inspection`, `/qc/test-reports`, `/qc/nonconformance`, `/qc/handover-inspection`, `/qc/quality-dashboard` |
| 안전 | `/quality-safety/safety/policies`, `/quality-safety/safety/management/daily-log`, `/quality-safety/safety/education/training` |
| 설계·문서 | `/design-docs/design/reviews`, `/design-docs/design/drawings`, `/design-docs/design/changes`, `/design-docs/design/assets`, `/design-docs/documents/wizard/[step]` |
| 시스템 관리 | `/system-admin/common/meetings`, `/system-admin/common/issues`, `/system-admin/common/library`, `/system-admin/sites`, `/system-admin/site-memberships`, `/system-admin/support` |

## 9. 코드베이스 스냅샷

2026-03-13 기준 소스 스캔 수치입니다.

- `src/app/(main)/**/page.tsx`: `100`개
- `src/app/api/**/route.ts`: `147`개
- `src/models/*.ts`: `69`개

이 수치는 개발 진행에 따라 계속 바뀌므로, README에는 전체 인벤토리 대신 규모와 범위만 기록합니다.

## 10. 운영 문서

상세 업무 절차와 운영 기준은 아래 문서를 우선 봐야 합니다.

| 문서 | 용도 |
|---|---|
| [`docs/operations-manual.md`](./docs/operations-manual.md) | 전체 사용자/관리자 운영 매뉴얼 |
| [`docs/runbook.md`](./docs/runbook.md) | 배포, 롤백, 장애 대응 |
| [`docs/roadmap.md`](./docs/roadmap.md) | 로드맵 및 후속 과제 |

## 11. 운영 메모

- 모든 업무 데이터는 선택된 `siteId` 기준으로 동작합니다.
- 현장 권한은 사용자-현장 매핑(`SiteMembership`)으로 제한됩니다.
- 파일 업로드는 공통 업로드 API와 `FileAsset` 모델을 통해 관리됩니다.
- 문서, 설계, QA/QC, 시스템 관리 일부 흐름에는 감사 로그가 연결돼 있습니다.
- 우측 위젯, 알림 벨, 대시보드 요약은 일부 QA/QC 운영 경고와 연동됩니다.

## 12. README 유지 원칙

- 이 문서는 전체 라우트/API/모델의 완전한 인벤토리를 유지하지 않습니다.
- 자주 바뀌는 상세 목록은 소스코드와 `docs/` 문서를 기준으로 확인합니다.
- README는 신규 개발자가 프로젝트 구조와 현재 구현 범위를 빠르게 이해할 수 있을 정도로만 유지합니다.
