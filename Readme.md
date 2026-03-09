# PMIS (Project Management Information System)

건설 현장 운영을 위한 Next.js + MongoDB 기반 PMIS 프로젝트입니다.

이 문서는 현재 코드베이스(`main`) 기준으로 사용자/개발자가 확인해야 할 내용을 한 곳에 정리한 통합 가이드입니다.

## 1. 프로젝트 개요

- 프로젝트명: `pmis-init`
- 기본 포트: `3070`
- 인증 방식: Google OAuth (Auth.js / NextAuth v5)
- 권한 모델: `super_admin`, `site_admin`, `manager`, `viewer` (+ 개발 우회 `dev_bypass`)
- 다중 현장 지원: 사용자-현장 매핑(`SiteMembership`) 기반
- 핵심 도메인: 대시보드, 현장정보, 공정, 자원·조달, QA/QC/안전, 설계·문서, 시스템관리, Support

---

## 2. 기술 스택

### 2.1 Frontend / App

- Next.js `16.1.6` (App Router)
- React `19.2.3`
- TypeScript `^5` (`strict: true`)
- Tailwind CSS `v4`
- Recharts `^3.7.0` (차트)
- TanStack Table `^8.21.3` (테이블)
- React Hook Form + Zod
- date-fns

### 2.2 Backend / Data

- Next.js Route Handlers (`src/app/api/**`)
- MongoDB + Mongoose `^9.2.1`
- Auth.js(NextAuth) `5.0.0-beta.30` + Google Provider
- 공통 API 응답 유틸: `src/lib/api-response.ts`
- 공통 에러 처리: `src/lib/api-error.ts`

### 2.3 운영/품질 도구

- ESLint 9 + `eslint-config-next`
- Prettier + `prettier-plugin-tailwindcss`

---

## 3. 폴더 구조

```text
src/
  app/
    (auth)/login, unauthorized
    (main)/...                 # 실제 업무 화면
    api/...                    # 서버 API
  components/
    layout/                    # TopBar/TopNav/Sidebar/Widget
    ui/                        # DataTable, Modal, Pagination 등
    features/                  # 도메인별 화면 컴포넌트
  hooks/                       # useCurrentUser
  lib/                         # auth, db, permissions, site-context, open-meteo 등
  models/                      # Mongoose 모델
  types/                       # 공통 타입 + next-auth 확장

docs/
  operations-manual.md         # 운영 매뉴얼
  runbook.md                   # 장애 대응/배포 Runbook

Readme.md                      # 본 문서
```

---

## 4. 실행 방법

### 4.1 의존성 설치

```bash
npm install
```

### 4.2 개발 서버

```bash
npm run dev
# http://localhost:3070
```

### 4.3 빌드/운영 실행

```bash
npm run build
npm start
```

### 4.4 기타 스크립트

`package.json`에 다음 스크립트가 정의되어 있습니다.

- `npm run lint`
- `npm run phase6:team1:e2e`
- `npm run phase6:team1:perf`
- `npm run phase6:team1:index`
- `npm run phase6:team1:security`
- `npm run phase6:team2:audit`

주의:

- 현재 저장소에는 `scripts/` 디렉토리가 없어, `phase6:*` 스크립트는 실행 시 실패할 수 있습니다.

---

## 5. 환경 변수

코드에서 직접 사용하는 환경 변수 기준입니다.

| 변수명 | 필수 | 설명 |
|---|---|---|
| `MONGODB_URI` | 예 | MongoDB 연결 문자열 (`src/lib/db.ts`) |
| `AUTH_GOOGLE_ID` 또는 `GOOGLE_CLIENT_ID` | 예 | Google OAuth Client ID (`src/lib/auth.ts`) |
| `AUTH_GOOGLE_SECRET` 또는 `GOOGLE_CLIENT_SECRET` | 예 | Google OAuth Client Secret (`src/lib/auth.ts`) |
| `PMIS_REQUIRE_LOGIN` | 조건부 | `true`면 로그인 강제, 개발에서 `true`가 아니면 인증 우회 가능 (`src/lib/runtime-flags.ts`) |
| `NEXTAUTH_SECRET` | 예(운영) | Auth.js 세션 암호화 키 (운영 필수) |
| `NEXTAUTH_URL` | 예(운영) | 서비스 기본 URL |

`.gitignore`에 `.env`, `.env.local`, `.env.*`가 포함되어 있어 Git에 커밋되지 않습니다.

---

## 6. 인증/권한/현장 컨텍스트

### 6.1 인증

- 라우트: `/api/auth/[...nextauth]`
- 로그인 페이지: `/login`
- 세션 전략: JWT
- 미인증 접근 시 미들웨어에서 `/login` 리다이렉트

### 6.2 권한 계층

`viewer < manager < site_admin < super_admin` (`src/lib/permissions.ts`)

- `super_admin`: 전체 시스템/현장/매핑 관리
- `site_admin`: 현장 관리자 수준
- `manager`: 일반 업무 CRUD
- `viewer`: 조회

개발 우회(`PMIS_REQUIRE_LOGIN != true` and non-production) 시 `dev_bypass`로 동작하며 대부분의 권한을 통과합니다.

### 6.3 최초 사용자 부트스트랩

- DB에 사용자(`users`)가 한 명도 없으면 첫 로그인 사용자를 `super_admin`으로 자동 생성합니다.
- 이후 신규 로그인 사용자는 기본 `viewer` 생성.

### 6.4 현장 선택

- `pmis_site_id` 쿠키 + `localStorage(pmis:siteId)` 사용
- 사용자에게 허용된 `siteIds` 내에서만 유효
- `super_admin`은 전체 현장 접근

---

## 7. 사용자 메뉴 구조 (실제 코드 기준)

### 7.1 Top Navigation

- `/dashboard` 대시보드
- `/site-info` 현장 정보
- `/progress` 공정 관리
- `/resource-procurement` 자원·조달
- `/qa` QA
- `/qc` QC
- `/quality-safety` 안전
- `/design-docs` 설계·문서
- `/system-admin` 시스템 관리

### 7.2 현장 정보 (`/site-info`)

- 현장 개요: `/site-info/overview`
- 관계자 현황: `/site-info/people`
- 기술 문서: `/site-info/technical-docs`
- 방문자 관리: `/site-info/visitors`

### 7.3 공정 관리 (`/progress`)

- 진행 개요: `/progress`
- 현장 리포트: `/progress/reports`
- 공정 추적: `/progress/master-schedule`
- 일정 캘린더: `/progress/calendar`
- 현장 날씨(Open-Meteo): `/progress/weather`

기타 구현 라우트:

- `/progress/comparison`
- `/progress/photos`
- `/progress/daily-safety-log` (안전 일지 API 프록시 경로)

### 7.4 자원·조달 (`/resource-procurement`)

- 자재 현황: `/resource-procurement/materials/plan-actual`
- 장비 현황: `/resource-procurement/equipment/plan-actual`
- 업체 승인: `/resource-procurement/supplier-approvals`
- 일일 근태: `/resource-procurement/workforce/daily`
- 근태 통계: `/resource-procurement/workforce/statistics`
- 협력사 관리: `/resource-procurement/subcontract`
- 원가 분석: `/resource-procurement/profit-loss`

### 7.5 안전 (`/quality-safety`)

정책·규정

- `/quality-safety/safety/policies`
- `/quality-safety/safety/regulations`
- `/quality-safety/safety/laws`

계획·점검

- `/quality-safety/safety/standards/hazard`
- `/quality-safety/safety/standards/plan`
- `/quality-safety/safety/standards/partner`
- `/quality-safety/safety/rewards/checklist`

운영 관리

- `/quality-safety/safety/management/daily-log`
- `/quality-safety/safety/management/setup`
- `/quality-safety/safety/management/ongoing`
- `/quality-safety/safety/management/completion`

교육·보건

- `/quality-safety/safety/education/training`
- `/quality-safety/safety/education/new-worker`
- `/quality-safety/safety/education/equipment`
- `/quality-safety/safety/education/health`
- `/quality-safety/safety/education/accident-free`

성과·시설

- `/quality-safety/safety/rewards/accident-free`
- `/quality-safety/safety/rewards/mileage`
- `/quality-safety/safety/facilities`

### 7.6 QA (`/qa`)

현재는 `coming soon` 구조로 메뉴/로드맵 중심 페이지입니다.

- 품질 정책·목표
- 품질보증계획 (QAP)
- 표준 절차·템플릿
- 내부 심사
- 개선조치 (CAPA)
- 협력사 품질보증
- 품질 KPI

### 7.7 QC (`/qc`)

현재는 `coming soon` 구조 + 일부 구현(자재 검사 API 연동) 상태입니다.

- 검사·시험 계획 (ITP)
- 자재 검사
- 공정 검사
- 시험 성적서
- NCR 관리
- 인수·준공 검사
- 품질 대시보드

### 7.8 설계·문서 (`/design-docs`)

설계

- 도면검토현황: `/design-docs/design/reviews`
- 도면목록: `/design-docs/design/drawings`
- 도면 열람 시스템: `/design-docs/design/drawing-viewer`
- 설계변경현황: `/design-docs/design/changes`
- 설계자료관리(트리): `/design-docs/design/assets`

문서

- 문서 작성 플로우: `/design-docs/documents/wizard/[step]`
- 업무지시: `/design-docs/documents/ledgers/instruction`
- 문서 수신/발신: `/design-docs/documents/ledgers/correspondence`
- 문서검색: `/design-docs/documents/search`
- 문서분류체계: `/design-docs/documents/categories`
- Document System: `/design-docs/documents/system`

### 7.9 시스템 관리 (`/system-admin`)

- 회의/회의록: `/system-admin/common/meetings`
- ISSUE: `/system-admin/common/issues`
- 자료실: `/system-admin/common/library`
- 외부사이트: `/system-admin/common/external-sites`
- 관련사 코드관리: `/system-admin/codes/partners`
- 자재 코드관리: `/system-admin/codes/materials`
- 장비 코드관리: `/system-admin/codes/equipment`
- 현장 등록/관리: `/system-admin/sites`
- 사용자-현장 매핑: `/system-admin/site-memberships`
- Support(FAQ+문의/문제신고 통합): `/system-admin/support`

참고:

- `/system-admin/integrations/drawing-viewer`는 레거시 경로이며 `/design-docs/design/drawing-viewer`로 리다이렉트됩니다.

---

## 8. 전체 페이지 라우트 인벤토리 (85)

다음 목록은 `src/app/**/page.tsx`를 기준으로 자동 추출한 전체 페이지입니다.

- `/login`
- `/unauthorized`
- `/dashboard/meetings`
- `/dashboard/notices`
- `/dashboard`
- `/dashboard/pending-docs`
- `/dashboard/search`
- `/dashboard/ui-lab`
- `/design-docs/design/assets`
- `/design-docs/design/changes`
- `/design-docs/design/drawing-viewer`
- `/design-docs/design/drawings`
- `/design-docs/design/reviews/[id]/request`
- `/design-docs/design/reviews/[id]/result`
- `/design-docs/design/reviews`
- `/design-docs/documents/categories`
- `/design-docs/documents/ledgers/correspondence`
- `/design-docs/documents/ledgers/instruction`
- `/design-docs/documents/search`
- `/design-docs/documents/system`
- `/design-docs/documents/wizard/[step]`
- `/design-docs`
- `/progress/calendar`
- `/progress/comparison`
- `/progress/daily-safety-log`
- `/progress/master-schedule`
- `/progress`
- `/progress/photos`
- `/progress/reports`
- `/progress/weather`
- `/qa/[topic]`
- `/qa`
- `/qc/[topic]`
- `/qc/material-inspection`
- `/qc`
- `/quality-safety`
- `/quality-safety/safety/education/accident-free`
- `/quality-safety/safety/education/equipment`
- `/quality-safety/safety/education/health`
- `/quality-safety/safety/education/new-worker`
- `/quality-safety/safety/education/training`
- `/quality-safety/safety/facilities`
- `/quality-safety/safety/laws`
- `/quality-safety/safety/management/completion`
- `/quality-safety/safety/management/daily-log`
- `/quality-safety/safety/management/ongoing`
- `/quality-safety/safety/management/setup`
- `/quality-safety/safety/policies`
- `/quality-safety/safety/regulations`
- `/quality-safety/safety/rewards/accident-free`
- `/quality-safety/safety/rewards/checklist`
- `/quality-safety/safety/rewards/mileage`
- `/quality-safety/safety/standards/hazard`
- `/quality-safety/safety/standards/partner`
- `/quality-safety/safety/standards/plan`
- `/resource-procurement/equipment/plan-actual`
- `/resource-procurement/materials/plan-actual`
- `/resource-procurement`
- `/resource-procurement/profit-loss`
- `/resource-procurement/subcontract`
- `/resource-procurement/supplier-approvals`
- `/resource-procurement/workforce/daily`
- `/resource-procurement/workforce/statistics`
- `/site-info/overview`
- `/site-info`
- `/site-info/people`
- `/site-info/technical-docs`
- `/site-info/visitors`
- `/system-admin/codes/equipment`
- `/system-admin/codes/materials`
- `/system-admin/codes/partners`
- `/system-admin/common/external-sites`
- `/system-admin/common/issues`
- `/system-admin/common/library`
- `/system-admin/common/meetings`
- `/system-admin/common/minutes`
- `/system-admin/integrations/drawing-viewer`
- `/system-admin`
- `/system-admin/site-memberships`
- `/system-admin/sites`
- `/system-admin/support/faq`
- `/system-admin/support`
- `/system-admin/support/tickets`
- `/`

---

## 9. API 인벤토리 (88)

아래는 `src/app/api/**/route.ts` 기준 전체 API 경로와 메서드입니다.

| API 경로 | 메서드 |
|---|---|
| `/api/audit-logs` | `GET` |
| `/api/auth/[...nextauth]` | `GET,POST` |
| `/api/dashboard/notices/[noticeId]` | `PATCH,DELETE` |
| `/api/dashboard/notices` | `GET,POST` |
| `/api/dashboard/summary` | `GET` |
| `/api/design/assets/[itemId]` | `PATCH,DELETE` |
| `/api/design/assets` | `GET,POST` |
| `/api/design/changes/[changeId]` | `PATCH,DELETE` |
| `/api/design/changes` | `GET,POST` |
| `/api/documents/[documentId]` | `GET,PATCH,DELETE` |
| `/api/documents/categories/[categoryId]` | `PATCH,DELETE` |
| `/api/documents/categories` | `GET,POST` |
| `/api/documents/pending` | `GET` |
| `/api/documents` | `GET,POST` |
| `/api/documents/search` | `GET` |
| `/api/documents/system/[itemId]` | `PATCH,DELETE` |
| `/api/documents/system` | `GET,POST` |
| `/api/drawing-reviews/[reviewId]/decision` | `POST` |
| `/api/drawing-reviews/[reviewId]` | `GET,PATCH,DELETE` |
| `/api/drawing-reviews` | `GET,POST` |
| `/api/drawings/[drawingId]` | `PATCH,DELETE` |
| `/api/drawings` | `GET,POST` |
| `/api/files/upload` | `POST` |
| `/api/integrations/open-meteo/retry-failed` | `POST` |
| `/api/integrations/open-meteo/sync` | `POST` |
| `/api/issues/[issueId]` | `PATCH,DELETE` |
| `/api/issues` | `GET,POST` |
| `/api/library/[itemId]` | `PATCH,DELETE` |
| `/api/library` | `GET,POST` |
| `/api/me` | `GET` |
| `/api/meetings/[meetingId]/minutes` | `PATCH` |
| `/api/meetings/[meetingId]` | `GET,PATCH,DELETE` |
| `/api/meetings` | `GET,POST` |
| `/api/notifications` | `GET` |
| `/api/progress/calendar` | `GET,POST` |
| `/api/progress/comparison` | `GET` |
| `/api/progress/daily-safety-log` | `GET,POST` |
| `/api/progress/reports` | `GET,POST` |
| `/api/progress/schedule` | `GET,POST` |
| `/api/progress/summary` | `GET` |
| `/api/progress/weather` | `GET` |
| `/api/qc/material-inspections` | `GET,POST` |
| `/api/resource/equipment` | `GET,POST` |
| `/api/resource/materials` | `GET,POST` |
| `/api/resource/profit-loss` | `GET` |
| `/api/resource/supplier-approvals` | `GET,POST` |
| `/api/resource/workforce/daily` | `GET,POST` |
| `/api/resource/workforce/summary` | `GET` |
| `/api/safety/accident-free-status` | `GET` |
| `/api/safety/checklists` | `GET,POST` |
| `/api/safety/checklists/[itemId]` | `PATCH,DELETE` |
| `/api/safety/completion` | `GET,POST` |
| `/api/safety/completion/[itemId]` | `PATCH,DELETE` |
| `/api/safety/daily-logs` | `GET,POST` |
| `/api/safety/education` | `GET,POST` |
| `/api/safety/facilities` | `GET,POST` |
| `/api/safety/health` | `GET,POST` |
| `/api/safety/management/setup` | `GET,POST` |
| `/api/safety/management/setup/[itemId]` | `PATCH,DELETE` |
| `/api/safety/mileage` | `GET,POST` |
| `/api/safety/new-workers` | `GET` |
| `/api/safety/policies` | `GET,POST` |
| `/api/safety/ppe` | `GET,POST` |
| `/api/safety/regulations` | `GET,POST` |
| `/api/safety/regulations/[itemId]` | `PATCH,DELETE` |
| `/api/safety/reports` | `GET,POST` |
| `/api/safety/rewards` | `GET,POST` |
| `/api/safety/standards` | `GET,POST` |
| `/api/safety/standards/[itemId]` | `PATCH,DELETE` |
| `/api/search/unified` | `GET` |
| `/api/sites/[id]` | `GET,PATCH` |
| `/api/sites/construction-plans` | `GET,POST` |
| `/api/sites/members` | `GET` |
| `/api/sites/history` | `GET,POST` |
| `/api/sites/methods` | `GET,POST` |
| `/api/sites/personnel` | `GET,POST` |
| `/api/sites` | `GET,POST` |
| `/api/sites/specifications` | `GET,POST` |
| `/api/sites/visitors` | `GET,POST` |
| `/api/subcontract-reviews` | `GET,POST` |
| `/api/system/codes/[groupCode]/[itemId]` | `PATCH,DELETE` |
| `/api/system/codes/[groupCode]` | `GET,POST` |
| `/api/system/external-links` | `GET` |
| `/api/system/site-memberships/[membershipId]` | `PATCH,DELETE` |
| `/api/system/site-memberships` | `GET,POST` |
| `/api/system/support/faq` | `GET` |
| `/api/system/support/tickets/[ticketId]` | `PATCH` |
| `/api/system/support/tickets` | `GET,POST` |

---

## 10. 데이터 모델 / 컬렉션 / 주요 필드

아래 목록은 `src/models/*.ts` 기준 전체 모델을 정리한 것입니다.

- `collection`이 `(mongoose default)`인 경우 Mongoose 기본 컬렉션명 규칙(소문자+복수형)이 적용됩니다.
- 공통적으로 `baseFieldsPlugin`이 적용되어 `createdBy`, `updatedBy`, `isDeleted`, `deletedAt`, `softDelete()`를 가집니다.

| 모델 파일 | 모델명 | 컬렉션 | 주요 필드(일부) |
|---|---|---|---|
| `AccidentRecord` | `AccidentRecord` | `accident_records` | `siteId, accidentDate, accidentType, location, description, injuredName, injuredCompany, severity` |
| `AuditLog` | `AuditLog` | `audit_logs` | `siteId, action, entityType, entityId, actorId, actorName, details, metadata` |
| `CodeGroup` | `CodeGroup` | `(mongoose default)` | `siteId, groupCode, groupName, sortOrder, isActive, createdBy, updatedBy, isDeleted` |
| `CodeItem` | `CodeItem` | `(mongoose default)` | `siteId, groupId, itemCode, itemName, description, sortOrder, isActive, createdBy` |
| `ConstructionMethod` | `ConstructionMethod` | `(mongoose default)` | `siteId, title, workType, description, fileAssetId, createdBy, updatedBy, isDeleted` |
| `ConstructionPlan` | `ConstructionPlan` | `(mongoose default)` | `siteId, title, category, description, fileAssetId, version, approvedAt, approvedBy` |
| `DailySafetyLog` | `DailySafetyLog` | `(mongoose default)` | `siteId, logDate, weather, workersCount, hazards, actions, notes, managerName` |
| `DesignAsset` | `DesignAsset` | `(mongoose default)` | `siteId, nodeId, assetCode, assetName, revision, fileAssetId, notes, createdBy` |
| `DesignChange` | `DesignChange` | `(mongoose default)` | `siteId, changeNo, drawingNo, drawingName, location, reason, requestedByName, reviewedByName` |
| `DesignTreeNode` | `DesignTreeNode` | `(mongoose default)` | `siteId, parentNodeId, nodeCode, nodeName, sortOrder, depth, path, createdBy` |
| `Document` | `Document` | `(mongoose default)` | `siteId, docNo, title, content, ledgerType, direction, status, categoryCode` |
| `DocumentApprovalLine` | `DocumentApprovalLine` | `(mongoose default)` | `siteId, documentId, order, approverId, approverName, approverRoleTitle, status, actedAt` |
| `DocumentAttachment` | `DocumentAttachment` | `(mongoose default)` | `siteId, documentId, fileAssetId, fileName, sortOrder, createdBy, updatedBy, isDeleted` |
| `DocumentCategory` | `DocumentCategory` | `(mongoose default)` | `siteId, categoryCode, categoryName, parentCategoryId, sortOrder, isActive, createdBy, updatedBy` |
| `DocumentSystemItem` | `DocumentSystemItem` | `(mongoose default)` | `siteId, itemCode, itemName, description, sortOrder, isActive, createdBy, updatedBy` |
| `Drawing` | `Drawing` | `(mongoose default)` | `siteId, drawingNo, drawingName, discipline, location, revision, status, fileAssetId` |
| `DrawingReview` | `DrawingReview` | `(mongoose default)` | `siteId, docNo, drawingNo, drawingName, discipline, location, requesterName, reviewerName` |
| `EquipmentPlanActual` | `EquipmentPlanActual` | `(mongoose default)` | `siteId, equipmentName, specification, unit, planQty, actualQty, planDate, actualDate` |
| `ExternalLinkItem` | `ExternalLinkItem` | `(mongoose default)` | `siteId, category, name, url, description, sortOrder, isActive, createdBy` |
| `FileAsset` | `FileAsset` | `(mongoose default)` | `siteId, module, originalName, storagePath, mimeType, size, uploadedBy, createdBy` |
| `GovernmentReport` | `GovernmentReport` | `government_reports` | `siteId, reportType, title, reportDate, agency, status, remarks` |
| `HealthCheckRecord` | `HealthCheckRecord` | `health_check_records` | `siteId, workerName, company, checkType, checkDate, result, hospital, remarks` |
| `IntegrationSyncLog` | `IntegrationSyncLog` | `integration_sync_logs` | `siteId, sourceSystem, syncType, status, startedAt, completedAt, recordsProcessed, recordsFailed` |
| `Issue` | `Issue` | `(mongoose default)` | `siteId, title, content, authorName, viewCount, status, createdBy, updatedBy` |
| `MaterialInspection` | `MaterialInspection` | `(mongoose default)` | `siteId, materialName, specification, supplier, quantity, unit, inspectionDate, result` |
| `MaterialPlanActual` | `MaterialPlanActual` | `(mongoose default)` | `siteId, materialName, specification, unit, planQty, actualQty, planDate, actualDate` |
| `Meeting` | `Meeting` | `(mongoose default)` | `siteId, category, agenda, meetingDate, startTime, endTime, location, host` |
| `MeetingAttendee` | `MeetingAttendee` | `(mongoose default)` | `meetingId, company, department, position, name, notifySent, createdBy, updatedBy` |
| `Notice` | `Notice` | `(mongoose default)` | `siteId, title, content, authorName, isPinned, postedAt, createdBy, updatedBy` |
| `PPEDistributionRecord` | `PPEDistributionRecord` | `ppe_distribution_records` | `siteId, itemName, specification, quantity, unit, recipientName, recipientCompany, distributionDate` |
| `ProjectCalendarEvent` | `ProjectCalendarEvent` | `(mongoose default)` | `siteId, title, category, startDate, endDate, isAllDay, description, color` |
| `Report` | `Report` | `(mongoose default)` | `siteId, reportType, title, reportDate, authorName, content, progressRate, attachments` |
| `ResourceLibraryItem` | `ResourceLibraryItem` | `(mongoose default)` | `siteId, categoryCode, title, description, authorName, fileAssetId, createdBy, updatedBy` |
| `SafetyChecklist` | `SafetyChecklist` | `safety_checklists` | `siteId, title, checkDate, inspector, category, items, overallResult, remarks` |
| `SafetyDocument` | `SafetyDocument` | `safety_documents` | `siteId, docType, title, description, fileAssetId, version, status, approvedAt` |
| `SafetyEducationRecord` | `SafetyEducationRecord` | `safety_education_records` | `siteId, educationType, title, educationDate, instructor, duration, attendeeCount, content` |
| `SafetyFacility` | `SafetyFacility` | `safety_facilities` | `siteId, facilityType, name, location, installDate, inspectionDate, condition, description` |
| `SafetyManagerAssignment` | `SafetyManagerAssignment` | `safety_manager_assignments` | `siteId, managerName, position, certificationNo, assignedDate, expiryDate, role, isActive` |
| `SafetyMileageRecord` | `SafetyMileageRecord` | `safety_mileage_records` | `siteId, managerName, category, points, recordDate, description, remarks` |
| `SafetyPolicy` | `SafetyPolicy` | `safety_policies` | `siteId, policyType, title, content, effectiveDate, version` |
| `SafetyRegulationItem` | `SafetyRegulationItem` | `safety_regulation_items` | `siteId, category, title, content, reference, sortOrder, isActive` |
| `SafetyReport` | `SafetyReport` | `safety_reports` | `siteId, reportType, title, reportDate, content, amount, remarks` |
| `SafetyReward` | `SafetyReward` | `safety_rewards` | `siteId, rewardType, title, targetDays, achievedDays, startDate, endDate, status` |
| `ScheduleItem` | `ScheduleItem` | `(mongoose default)` | `siteId, taskCode, taskName, category, plannedStart, plannedEnd, actualStart, actualEnd` |
| `Site` | `Site` | `(mongoose default)` | `siteCode, siteName, address, status, startDate, endDate, description, projectManager` |
| `SiteHistory` | `SiteHistory` | `(mongoose default)` | `siteId, eventDate, title, description, category, createdBy, updatedBy, isDeleted` |
| `SiteMembership` | `SiteMembership` | `(mongoose default)` | `siteId, userId, role, assignedAt, revokedAt, isActive, createdBy, updatedBy` |
| `SitePersonnel` | `SitePersonnel` | `(mongoose default)` | `siteId, category, name, company, position, role, phone, email` |
| `Specification` | `Specification` | `(mongoose default)` | `siteId, title, category, description, fileAssetId, version, effectiveDate, createdBy` |
| `SubcontractReview` | `SubcontractReview` | `(mongoose default)` | `siteId, title, contractorName, workType, contractAmount, requestDate, requestedBy, status` |
| `SubcontractReviewItem` | `SubcontractReviewItem` | `(mongoose default)` | `siteId, reviewId, itemNo, checkItem, result, remarks, createdBy, updatedBy` |
| `SupplierApprovalRequest` | `SupplierApprovalRequest` | `(mongoose default)` | `siteId, supplierName, materialName, specification, manufacturer, requestDate, requestedBy, status` |
| `SupportTicket` | `SupportTicket` | `support_tickets` | `siteId, ticketNo, category, priority, status, title, content, reporterName` |
| `User` | `User` | `(mongoose default)` | `name, email, image, provider, providerId, role, isActive, lastLoginAt` |
| `VisitorLog` | `VisitorLog` | `(mongoose default)` | `siteId, visitorName, company, purpose, visitDate, checkInTime, checkOutTime, contactPerson` |
| `WeatherSnapshot` | `WeatherSnapshot` | `(mongoose default)` | `siteId, observedDate, condition, temperatureMin, temperatureMax, precipitationChance, windSpeed, warning` |
| `WorkforceAttendance` | `WorkforceAttendance` | `(mongoose default)` | `siteId, attendanceDate, workerName, company, jobType, workType, isPresent, hoursWorked` |

---

## 11. 핵심 운영 정책

### 11.1 더미 데이터 정책

- 운영 전환 기준에서 더미/샘플 주입 경로는 제거된 상태를 유지합니다.
- 데이터는 관리자 UI/API를 통해 직접 생성합니다.

### 11.2 현장 개설부터 시작 (부트스트랩 절차)

- 현장 생성 API: `POST /api/sites` (`super_admin`)
- 현장 수정 API: `PATCH /api/sites/[id]`
- 사용자-현장 배정 API: `POST /api/system/site-memberships`

사전 체크:

- 운영 URL/포트 확인: `http://localhost:3070`
- 인증 변수 확인: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- MongoDB 연결 확인: `MONGODB_URI`
- 운영 전환 전 DB 백업(스냅샷/덤프) 확보

실행 순서:

1. 로그인 강제 모드 확인
- 운영 기준 `PMIS_REQUIRE_LOGIN=true`
- 개발 편의 모드(`false`)에서는 `dev_bypass`로 동작할 수 있으므로 운영 전환 시 반드시 `true`

2. 최초 최고관리자(super_admin) 확인
- DB에 사용자가 없으면 첫 로그인 사용자가 자동 `super_admin`
- 이미 사용자가 존재하면 `super_admin` 계정 여부를 먼저 확인

3. 현장 생성
- 메뉴: `/system-admin/sites`
- 필수 입력: `siteCode`, `siteName`
- 권장 입력: `address`, `status`, `startDate`, `endDate`, `description`
- 생성 직후 생성자는 해당 현장 `site_admin`으로 멤버십 자동 반영

4. 사용자-현장 매핑
- 메뉴: `/system-admin/site-memberships`
- 대상: 가입된 활성 사용자(`users`)만 배정 가능
- 역할: `site_admin | manager | viewer`
- 비활성화(`isActive=false`) 시 해당 매핑은 해제 상태로 운영

5. 코드/기준정보 초기 세팅
- 관련사 코드: `/system-admin/codes/partners`
- 자재 코드: `/system-admin/codes/materials`
- 장비 코드: `/system-admin/codes/equipment`
- 외부 링크/지원/회의 등 공통 운영 메뉴 점검

6. 업무 데이터 입력 시작
- 설계/문서, 공정, 자원·조달, 안전 모듈에 실제 데이터 입력
- 더미 주입 없이 운영 데이터만 등록

7. 오픈 전 스모크 테스트
- 로그인/권한(역할별 접근), 현장 전환, 핵심 CRUD, 첨부 업로드, 알림/검색, 날씨 연동 확인

### 11.3 더미 데이터 정리 범위 가이드

운영 전환 시 더미 정리는 아래 2안 중 선택합니다.

- A안(전체 초기화)
  - 사용자/현장/멤버십/업무 데이터 전부 재구축
  - 장점: 가장 깔끔한 상태
  - 단점: 초기 세팅 비용이 큼
- B안(업무 데이터만 정리)
  - 사용자/현장/권한 유지, 업무 컬렉션만 정리
  - 장점: 전환 속도가 빠름
  - 단점: 기존 기준 데이터 품질 영향 가능

권장:
- 오픈 전 초기 구축 단계면 A안
- 이미 사용자 운영 중이면 B안

### 11.4 운영 전환 완료 기준 (DoD)

- 사이트 0개 상태에서 현장 등록 화면 진입 가능
- 첫 현장 생성 후 전 모듈이 선택 현장 기준으로 정상 동작
- 사이트 전환이 DB 기반으로 동작 (`SiteSwitcher`)
- 사용자-현장 매핑/권한 검증 완료
- 더미 데이터 정리 완료 로그 또는 정리 결과 기록 보관
- 운영 매뉴얼/Runbook과 실제 동작이 일치

### 11.5 외부 연계

- 기상: Open-Meteo (`/api/progress/weather`, `/api/integrations/open-meteo/*`)
- 도면 열람 시스템: `/design-docs/design/drawing-viewer`
- 연계 실패/재시도 로그: `integration_sync_logs`

---

## 12. 보안 정책 요약

- 미들웨어에서 인증/권한 체크
- Mutation API에서 Origin 기반 CSRF 검증 (`assertSafeMutationRequest`)
- 입력값의 위험 HTML/XSS 패턴 차단 (`assertNoUnsafeHtml`)
- 보안 헤더 적용:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Content-Security-Policy`

---

## 13. 참고 문서

- 운영 매뉴얼: `docs/operations-manual.md`
- 장애 대응/배포 Runbook: `docs/runbook.md`

---

## 14. Version 로드맵

Version 별 계획과 개선 백로그는 별도 문서를 참고하세요.

- 로드맵 및 백로그: `docs/roadmap.md`
