# PMIS 구현 워크플로우

> **삼성물산 주택부문 PMIS 현대화** | Next.js + MongoDB
> 2개 팀 병렬 진행 기준 | 총 6 Phase, 약 15~19주

---

## 1. 프로젝트 개요

### 1.1 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS |
| Auth | NextAuth.js + Google OAuth, JWT, RBAC 4단계 |
| Database | MongoDB + Mongoose |
| File Storage | S3 호환 오브젝트 스토리지 + `file_assets` 메타 분리 |
| Form/Table | `react-hook-form`, `zod`, `@tanstack/react-table`, `date-fns`, `recharts` |
| API 응답 | `{ ok, data, error, meta }` 통일 |

### 1.2 아키텍처 결정사항 (고정)

| # | 결정 | 상세 |
|---|------|------|
| 1 | 멀티테넌시 | `siteId` 기반, 모든 도메인 컬렉션에 필수 |
| 2 | RBAC | `super_admin` > `site_admin` > `manager` > `viewer` |
| 3 | 파일 저장 | S3 저장 + `fileAssetId` 참조, 경로 `module/yyyy/mm/...` |
| 4 | 공통 필드 | `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `isDeleted`, `deletedAt` |
| 5 | 상태 enum | `draft` → `in_review` → `approved` / `rejected` / `completed` |
| 6 | 삭제 정책 | soft delete (`isDeleted + deletedAt`) |
| 7 | 컬렉션명 | snake_case 복수형 |
| 8 | 라우트 그룹 | `(auth)` 비인증, `(main)` 인증 후 |
| 9 | 탭 규칙 | 폼/승인/URL공유 → 라우트 분리, 필터 전환 → 상태 탭 |

### 1.3 권한 모델

| 역할 | 범위 |
|------|------|
| `super_admin` | 전사 설정, 사용자/권한, 코드관리 전체 |
| `site_admin` | 현장 전체 CRUD, 승인/반려, 결재선 관리 |
| `manager` | 본인 담당 모듈 등록/수정/조회 |
| `viewer` | 조회 전용 |

---

## 2. 팀 구성 & 담당 영역

### 1팀 — Core Platform + 문서/설계/공정

> 핵심 인프라와 복잡한 워크플로우(결재, 위저드, 트리) 담당

| 담당 도메인 | 페이지 수 | 난이도 |
|------------|:---------:|:------:|
| 공통 인프라 (Auth, Layout, Components) | — | ★★★ |
| 대시보드 | 4 | ★★ |
| 공정 관리 | 8 | ★★★ |
| 설계·문서 | 14 | ★★★★ |
| 시스템 관리 | 12 | ★★ |
| **합계** | **38** | |

### 2팀 — DB/API + 현장/자원/안전

> 데이터 모델 설계와 현장 운영 도메인(CRUD 중심) 담당

| 담당 도메인 | 페이지 수 | 난이도 |
|------------|:---------:|:------:|
| DB 모델, API 공통, 파일 업로드 | — | ★★★ |
| 현장 정보 | 10 | ★★ |
| 자원·조달 | 16 | ★★★ |
| 품질·안전 | 20 | ★★ |
| **합계** | **46** | |

> 2팀이 페이지 수 많지만 CRUD 비중이 높아 난이도 균형 맞음

---

## 3. Phase별 병렬 워크플로우

### 타임라인 (총 15~19주)

```
Week  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
      ├──Phase 1──┤
                  ├───Phase 2───┤
                                ├────Phase 3─────┤
                                                 ├────Phase 4─────┤
                                                                  ├──Phase 5──┤
                                                                              ├Phase 6┤

1팀   ██ AUTH/UI ██ DASH+SYS ████ DESIGN·DOCS █████ PROGRESS █████ 연계/검색 ██ 안정화
2팀   ██ DB/API ███ SITE-INFO ███ RESOURCE ████████ SAFETY ████████ WIS/DIS ███ 안정화
```

---

### Phase 1. 기반 구축 `Week 1~2`

> 두 팀이 인프라를 분담하여 동시 구축. Phase 2부터 독립 병렬 진행 가능하도록 기반 완성.

#### 1팀 — 인증/레이아웃/공통 UI

| 작업 | 라우트/파일 | 산출물 | 완료 기준 |
|------|-----------|--------|----------|
| ✅ NextAuth + Google OAuth | `app/api/auth/[...nextauth]` | 로그인/로그아웃 동작 | Google 로그인 성공, JWT 세션 생성 |
| ✅ RBAC 미들웨어 | `lib/auth.ts` | 역할별 접근 제어 | 4단계 권한 체크 동작 (middleware.ts 미구현) |
| ✅ 공통 레이아웃 | `app/(main)/layout.tsx` | TopBar + TopNav + Sidebar + Footer | 7개 메뉴 네비게이션 동작 |
| ✅ 현장 전환 | TopBar 내 모달 | 현장 선택/전환 | `siteId` 세션 저장, 전환 시 데이터 리로드 |
| ✅ 로그인/미인가 페이지 | `app/(auth)/login`, `unauthorized` | 비인증 진입점 | 미인증 시 리다이렉트 |
| ✅ 공통 UI 컴포넌트 | `components/ui/*` | DataTable, Modal, Badge, StatusBadge, Pagination, FileUpload, FormInput, DatePicker | 8종 완료 |

#### 2팀 — DB/API 공통/파일 업로드

| 작업 | 라우트/파일 | 산출물 | 완료 기준 |
|------|-----------|--------|----------|
| ✅ MongoDB 연결 | `lib/db.ts` | 연결 싱글톤 | Atlas 또는 로컬 연결 성공 |
| ✅ Mongoose 공통 모델 | `models/User.ts`, `Site.ts`, `SiteMembership.ts` | 핵심 모델 + 공통 플러그인 | 스키마 검증 통과 |
| ✅ `file_assets` 모델 + 업로드 | `models/FileAsset.ts`, `app/api/files/upload` | 파일 업로드 API | 업로드 → 로컬 저장 → 메타 DB 기록 |
| ✅ API 공통 유틸 | `lib/api-response.ts`, `lib/api-error.ts` | 응답/에러 핸들러 | `{ ok, data, error, meta }` 형식 통일 |
| ✅ 코드 마스터 모델 | `models/CodeGroup.ts`, `CodeItem.ts` | 코드 체계 모델 | 그룹/항목 스키마 완료 |
| ✅ 초기 기준 데이터 구성 | `-` | 개발 기준 데이터 | 현장/사용자/코드 기본값 구성 |

#### Phase 1 공동 완료 기준

- [x] Google 로그인 → 역할 분기 → 현장 선택 → 대시보드 진입 플로우 동작
- [x] 공통 UI 컴포넌트 7종 이상 사용 가능 (8종 완료)
- [x] 파일 업로드 API 동작 (로컬 저장 + `file_assets` 기록)
- [x] API 응답 형식 통일 확인

---

### Phase 2. 대시보드 + 현장정보 `Week 3~5`

> 1팀: 대시보드 위젯 + 시스템 관리 | 2팀: 현장 정보 전체
> 의존성 없음 — 완전 병렬

#### 1팀 — 대시보드 + 시스템 관리

| 하위 메뉴 | 라우트 | API | 컬렉션 | 권한 |
|----------|--------|-----|--------|------|
| ✅ 대시보드 홈 | `/dashboard` | `GET /api/dashboard/summary` | 집계뷰 | `viewer+` |
| ✅ 공지사항 | `/dashboard/notices` | `GET/POST /api/dashboard/notices` | `notices` | 조회 `viewer+`, 등록 `manager+` |
| ✅ 금일회의 | `/dashboard/meetings` | `GET /api/meetings` | `meetings`, `meeting_attendees` | `viewer+` |
| ✅ 미결문서 | `/dashboard/pending-docs` | `GET /api/documents/pending` | `documents`, `document_approval_lines` | `manager+` |
| ✅ 회의개최현황 | `/system-admin/common/meetings` | `GET/POST /api/meetings` | `meetings`, `meeting_attendees` | `manager+` |
| ✅ 회의록 | `/system-admin/common/minutes` | `PATCH /api/meetings/:id/minutes` | `meetings` | `manager+` |
| ✅ ISSUE | `/system-admin/common/issues` | `GET/POST /api/issues` | `issues` | `manager+` |
| ✅ 자료실 | `/system-admin/common/library` | `GET/POST /api/library` | `resource_library_items` | `manager+` |
| ✅ 외부사이트 | `/system-admin/common/external-sites` | `GET /api/system/external-links` | `external_link_items` | `viewer+` |
| ✅ 코드관리(관련사) | `/system-admin/codes/partners` | `GET/POST /api/system/codes/partners` | `code_groups`, `code_items` | `site_admin+` |
| ✅ 코드관리(자재/장비) | `/system-admin/codes/materials`, `equipment` | `GET/POST/PATCH/DELETE /api/system/codes/*` | `code_groups`, `code_items` | `site_admin+` |
| ✅ 사용자-현장 매핑 | `/system-admin/site-memberships` | `GET/POST/PATCH /api/system/site-memberships*` | `site_memberships`, `users`, `sites` | `super_admin` |

**1팀 Phase 2 DB 모델:**
`notices`, `meetings`, `meeting_attendees`, `issues`, `resource_library_items`, `external_link_items`

**외부사이트 통합 상세(법률정보/KS/전문사이트):**
- `model`: `ExternalLinkItem` (`src/models/ExternalLinkItem.ts`)
- `type`: `ExternalLinksView` 내 `ExternalLinkItem` + `category` 유니온(`laws | ks | pro-sites`)
- `action`: 별도 action 레이어 없음(클라이언트 `fetch` 직접 호출)
- `api`: `GET /api/system/external-links` (`category`: `laws | ks | pro-sites`)
- `collection`: `external_link_items` (단일 컬렉션)
- `field`: `siteId`, `category`, `name`, `url`, `description`, `sortOrder`, `isActive`, `createdBy`, `updatedBy`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`
- `route`: `/system-admin/common/external-sites`

#### 2팀 — 현장 정보

| 하위 메뉴 | 라우트 | API | 컬렉션 | 권한 |
|----------|--------|-----|--------|------|
| ✅ 공사개요 | `/site-info/overview` | `GET/PATCH /api/sites/:id` | `sites` | 조회 `viewer+`, 수정 `site_admin+` |
| ✅ 사업연혁 | `/site-info/history` | `GET/POST /api/sites/history` | `site_histories` | `manager+` |
| ✅ 인원정보 | `/site-info/people` | `GET/POST /api/sites/personnel` | `site_personnel` | `manager+` |
| ✅ 시공계획 | `/site-info/construction-plans` | `GET/POST /api/sites/construction-plans` | `construction_plans` | `manager+` |
| ✅ 시방서 | `/site-info/specifications` | `GET/POST /api/sites/specifications` | `specifications` | `manager+` |
| ✅ 주요공법 | `/site-info/methods` | `GET/POST /api/sites/methods` | `construction_methods` | `manager+` |
| ✅ 방문자현황 | `/site-info/visitors` | `GET/POST /api/sites/visitors` | `visitor_logs` | `manager+` |

**2팀 Phase 2 DB 모델:**
`site_histories`, `site_personnel`, `visitor_logs`, `construction_plans`, `specifications`, `construction_methods`

#### Phase 2 공동 완료 기준

- [x] 대시보드 위젯 4종 데이터 표시
- [x] 회의/ISSUE/자료실 CRUD 동작
- [x] 현장 정보 7개 하위 페이지 CRUD 동작
- [x] 인원정보 탭(시공사/관련사/관공서) 필터 전환 동작

---

### Phase 3. 설계·문서 + 자원·조달 `Week 6~9`

> 1팀: 가장 복잡한 설계·문서 모듈 | 2팀: 자원·조달 전체
> 의존성 없음 — 완전 병렬

#### 1팀 — 설계·문서

> 현재상태: ✅ Phase 3 1팀 착수 완료 (핵심 라우트/모델/API/기본 화면 연결)

| 하위 메뉴 | 라우트 | API | 컬렉션 | 권한 |
|----------|--------|-----|--------|------|
| ✅ 도면검토현황 | `/design-docs/design/reviews` | `GET /api/drawing-reviews` | `drawing_reviews` | `viewer+` |
| ✅ 검토요청 작성 | `/design-docs/design/reviews/[id]/request` | `POST /api/drawing-reviews` | `drawing_reviews` | `manager+` |
| ✅ 결과통보/승인 | `/design-docs/design/reviews/[id]/result` | `POST /api/drawing-reviews/:id/decision` | `drawing_reviews` | `site_admin+` |
| ✅ 도면목록 | `/design-docs/design/drawings` | `GET/POST /api/drawings` | `drawings`, `file_assets` | `manager+` |
| ✅ 설계변경현황 | `/design-docs/design/changes` | `GET/POST /api/design/changes` | `design_changes` | `manager+` |
| ✅ 설계자료관리(트리) | `/design-docs/design/assets` | `GET/POST /api/design/assets` | `design_tree_nodes`, `design_assets` | `manager+` |
| ✅ **문서작성 위저드** | `/design-docs/documents/wizard/[step]` | `POST /api/documents` | `documents`, `document_attachments`, `document_approval_lines` | `manager+` |
| ✅ 업무지시서 | `/design-docs/documents/ledgers/instruction` | `GET /api/documents?ledger=instruction` | `documents` | `viewer+` |
| ✅ 발송대장 | `/design-docs/documents/ledgers/outbound` | `GET /api/documents?direction=outbound` | `documents` | `viewer+` |
| ✅ 접수대장 | `/design-docs/documents/ledgers/inbound` | `GET /api/documents?direction=inbound` | `documents` | `viewer+` |
| ✅ 문서검색 | `/design-docs/documents/search` | `GET /api/documents/search` | `documents` | `viewer+` |
| ✅ 문서분류체계 | `/design-docs/documents/categories` | `GET/POST /api/documents/categories` | `document_categories` | `site_admin+` |
| ✅ Document System | `/design-docs/documents/system` | `GET/POST /api/documents/system` | `document_system_items` | `manager+` |
| ✅ 양식함 | `/design-docs/documents/templates` | `GET/POST /api/documents/templates` | `form_templates` | `manager+` |

**1팀 Phase 3 핵심 워크플로우:**
- 문서작성 위저드 4단계: 입력 → 첨부 → 결재선 선택 → 발송
- 도면 검토: 요청 → 검토 → 결과 통보 (승인/반려)
- 설계자료: 트리 구조 네비게이션 + 파일 관리

**1팀 Phase 3 DB 모델:**
`drawings`, `drawing_reviews`, `design_changes`, `design_tree_nodes`, `design_assets`, `documents`, `document_attachments`, `document_approval_lines`, `document_categories`, `document_system_items`, `form_templates`

#### 2팀 — 자원·조달

| 하위 메뉴 | 라우트 | API | 컬렉션 | 권한 |
|----------|--------|-----|--------|------|
| ✅ 자재 계획/실적 | `resource-procurement/materials/plan-actual` | `GET/POST /api/resource/materials` | `material_plan_actuals` | `manager+` |
| ✅ 장비 계획/실적 | `resource-procurement/equipment/plan-actual` | `GET/POST /api/resource/equipment` | `equipment_plan_actuals` | `manager+` |
| ✅ 자재공급원 승인요청 | `resource-procurement/supplier-approvals/requests` | `GET/POST /api/resource/supplier-approvals` | `supplier_approval_requests` | `manager+` |
| ✅ 자재공급원 승인현황 | `resource-procurement/supplier-approvals/status` | `GET /api/resource/supplier-approvals/status` | `supplier_approval_requests` | 승인 `site_admin+` |
| ✅ 반입자재검수 요청 | `resource-procurement/material-inspections/requests` | `GET/POST /api/resource/material-inspections` | `material_inspections` | `manager+` |
| ✅ 반입자재검수 등록 | `resource-procurement/material-inspections/register` | `POST /api/resource/material-inspections` | `material_inspections` | `manager+` |
| ✅ 반입자재검수 대장 | `resource-procurement/material-inspections/ledger` | `GET /api/resource/material-inspections/ledger` | `material_inspections` | `viewer+` |
| ✅ 일일출역집계 | `resource-procurement/workforce/daily` | `GET/POST /api/resource/workforce/daily` | `workforce_attendance` | `manager+` |
| ✅ 연명부/집계/분석 | `resource-procurement/workforce/roster`, `summary`, `analysis` | `GET /api/resource/workforce/*` | `workforce_attendance` | `viewer+` |
| ✅ 하도급 검토요청 | `resource-procurement/subcontract/reviews/new` | `POST /api/subcontract-reviews` | `subcontract_reviews`, `subcontract_review_items` | `manager+` |
| ✅ 하도급 검토대장 | `resource-procurement/subcontract/review-ledger` | `GET /api/subcontract-reviews` | `subcontract_reviews` | 승인 `site_admin+` |
| ✅ 매출손익 | `resource-procurement/profit-loss` | `GET /api/resource/profit-loss` | 집계뷰 | `manager+` |

**2팀 Phase 3 DB 모델:**
`material_plan_actuals`, `equipment_plan_actuals`, `supplier_approval_requests`, `material_inspections`, `workforce_attendance`, `subcontract_reviews`, `subcontract_review_items`

#### Phase 3 공동 완료 기준

- [x] 문서작성 위저드 E2E: 입력 → 첨부 → 결재선 → 발송 → 접수 대장 반영
- [x] 도면 검토요청 → 결과 통보 → 승인/반려 플로우
- [x] 자재공급원 승인요청 → 승인현황 반영
- [x] 하도급 계약검토 → 검토대장 반영
- [x] 설계자료 트리 네비게이션 동작

---

### Phase 4. 공정 관리 + 품질·안전 `Week 10~13`

> 1팀: 공정 관리 (차트/캘린더 포함) | 2팀: 품질·안전 전체
> 의존성 없음 — 완전 병렬

#### 1팀 — 공정 관리

> 현재상태: ✅ Phase 4 1팀 핵심 구현 완료 (공정 라우트 8개 + API 8개 + GANTT/S-Curve + 공사안전일지 인쇄 동작 반영)

| 하위 메뉴 | 라우트 | API | 컬렉션 | 권한 |
|----------|--------|-----|--------|------|
| ✅ 공정 메인 | `/progress` | `GET /api/progress/summary` | 집계뷰 | `viewer+` |
| ✅ 보고서 (감리/일보/주간) | `/progress/reports` | `GET/POST /api/progress/reports` | `reports` | `manager+` |
| ✅ 공사안전일지 | `/progress/daily-safety-log` | `GET/POST /api/progress/daily-safety-log` | `daily_safety_logs` | `manager+` |
| ✅ Master/주간 공정표 | `/progress/master-schedule` | `GET/POST /api/progress/schedule` | `schedule_items` | `manager+` |
| ✅ 실적대비 (S-Curve) | `/progress/comparison` | `GET /api/progress/comparison` | `schedule_items` | `viewer+` |
| ✅ Project Calendar | `/progress/calendar` | `GET/POST /api/progress/calendar` | `project_calendar` | `manager+` |
| ✅ 기상자료 | `/progress/weather` | `GET /api/progress/weather` | `weather_snapshots` | `viewer+` |
| ✅ 공정진행사진 | `/progress/photos` | `GET/POST /api/progress/photos` | `progress_photos` | `manager+` |

**1팀 Phase 4 핵심 구현:**
- GANTT 바차트 (라이브러리 연동: `@neuronicx/gantt` 또는 커스텀)
- S-Curve 차트 (`recharts`)
- 공사안전일지 인쇄 양식
- 공정진행사진 갤러리 뷰어

**1팀 Phase 4 DB 모델:**
`reports`, `daily_safety_logs`, `schedule_items`, `progress_by_tech`, `project_calendar`, `progress_photos`

#### 2팀 — 품질·안전

| 하위 메뉴 | 라우트 | API | 컬렉션 | 권한 |
|----------|--------|-----|--------|------|
| ✅ 본사/현장 안전방침 | `quality-safety/safety/policies` | `GET/POST /api/safety/policies` | `safety_policies` | 수정 `site_admin+` |
| ✅ 유해위험방지계획서 | `quality-safety/safety/standards/hazard` | `GET/POST /api/safety/standards` | `safety_documents` | `manager+` |
| ✅ 안전관리계획서 | `quality-safety/safety/standards/plan` | `GET/POST /api/safety/standards` | `safety_documents` | `manager+` |
| ✅ 협력사안전관리계획 | `quality-safety/safety/standards/partner` | `GET/POST /api/safety/standards` | `safety_documents` | `manager+` |
| ✅ 안전기준 | `quality-safety/safety/regulations` | `GET /api/safety/regulations` | `safety_regulation_items` | `viewer+` |
| ✅ 개설시 (대관신고/선임) | `quality-safety/safety/management/setup` | `GET/POST /api/safety/management/setup` | `government_reports`, `safety_manager_assignments` | `manager+` |
| ✅ 진행중 (상황보고/관리비) | `quality-safety/safety/management/ongoing` | `GET/POST /api/safety/reports` | `safety_reports` | `manager+` |
| ✅ 준공시안전업무 | `quality-safety/safety/management/completion` | `GET/POST /api/safety/completion` | `accident_records` | `manager+` |
| ✅ 무재해목표달성 | `quality-safety/safety/rewards/accident-free` | `GET/POST /api/safety/rewards` | `safety_rewards` | `manager+` |
| ✅ 현장소장마일리지 | `quality-safety/safety/rewards/mileage` | `GET/POST /api/safety/mileage` | `safety_mileage_records` | `manager+` |
| ✅ 점검체크리스트 | `quality-safety/safety/rewards/checklist` | `GET/POST /api/safety/checklists` | `safety_checklists` | `manager+` |
| ✅ 안전법규 | `quality-safety/safety/laws` | `GET /api/safety/laws` | `external_link_items` | `viewer+` |
| ✅ 안전교육 | `quality-safety/safety/education/training` | `GET/POST /api/safety/education` | `safety_education_records` | `manager+` |
| ✅ 보호구지급 | `quality-safety/safety/education/equipment` | `GET/POST /api/safety/ppe` | `ppe_distribution_records` | `manager+` |
| ✅ 건강검진 | `quality-safety/safety/education/health` | `GET/POST /api/safety/health` | `health_check_records` | `manager+` |
| ✅ 무재해현황 | `quality-safety/safety/education/accident-free` | `GET /api/safety/accident-free-status` | `safety_rewards` | `viewer+` |
| ✅ 신규교육대상자 | `quality-safety/safety/education/new-worker` | `GET /api/safety/new-workers` | `workforce_attendance` | `manager+` |
| ✅ 표준안전시설물 | `quality-safety/safety/facilities/standard` | `GET/POST /api/safety/facilities` | `safety_facilities` | `manager+` |
| ✅ 우수안전시설물 | `quality-safety/safety/facilities/excellent` | `GET/POST /api/safety/facilities` | `safety_facilities` | `manager+` |

**2팀 Phase 4 DB 모델:**
`safety_policies`, `safety_documents`, `safety_regulation_items`, `government_reports`, `safety_manager_assignments`, `safety_reports`, `safety_rewards`, `safety_mileage_records`, `safety_checklists`, `safety_education_records`, `ppe_distribution_records`, `health_check_records`, `accident_records`, `safety_facilities`

#### Phase 4 공동 완료 기준

- [x] GANTT 공정표 표시 + 진도율 입력
- [x] S-Curve 실적대비 차트 렌더링
- [x] 공사안전일지 입력 + 인쇄 동작
- [x] 안전교육 CRUD + 집계
- [x] 무재해목표달성 관리 동작
- [x] 품질·안전 20개 하위 페이지 전체 CRUD

---

### Phase 5. 외부 연계 + 고급 기능 `Week 14~16`

> 1팀: Open-Meteo + 검색/알림 | 2팀: WIS/DIS + Support
> 양 팀 각자 담당 연계 시스템 구축, 공통 연계 로그 공유

#### 1팀 — Open-Meteo + 통합 기능

> 현재상태: ✅ Phase 5 1팀 핵심 진행중 (Open-Meteo 주소 기반 예보 + 통합 검색 + 상단 알림 드롭다운 + 동기화 재시도 API 완료)

| 작업 | 상세 | 산출물 |
|------|------|--------|
| ✅ Open-Meteo 연동 | 현장별 좌표 기반 기상 예보 API (무료/오픈소스, API키 불필요) | 날씨 위젯 실시간 데이터, 기상특보 알림 |
| ✅ 통합 문서 검색 | 전문 검색 (문서/도면/ISSUE/자료실) | 통합 검색 페이지 |
| ✅ 알림 시스템 | 미결문서, 기상특보, 결재 요청 | 알림 아이콘 + 목록 |
| 인쇄 양식 | 공사안전일지, 승인요청서, 검수요청서 | 인쇄용 CSS + 출력 |
| 대시보드 고도화 | 공정률 차트, S-Curve 미니, 미결 카운트 | 대시보드 위젯 완성 |

#### 2팀 — WIS/DIS + Support

> 현재상태: ✅ Phase 5 2팀 핵심 완료 (WIS 동기화/재시도 + DIS 연계 화면 + Support FAQ/티켓 + 모바일 반응형 보정)

| 작업 | 상세 | 산출물 |
|------|------|--------|
| ✅ WIS 연동 | 출역현황, 안전교육현황 데이터 | WIS 데이터 표시, 동기화 배치 |
| ✅ DIS 연동 | 설계도면 검색/열람 바로가기 | DIS 연계 화면 |
| ✅ Support | FAQ + 문의/문제신고 (단일화) | `/system-admin/support?tab=faq|tickets` |
| ✅ 배치 동기화 | 연계 실패 재시도 + 로그 | `integration_sync_logs` 기록 + 운영 알림 |
| ✅ 모바일 최적화 | 반응형 레이아웃 정밀 조정 | 모바일 터치 UX |

**Phase 5 공통 DB 모델:**
`weather_snapshots`, `integration_sync_logs`, `support_tickets`

#### Phase 5 공동 완료 기준

- [x] 날씨 위젯 실시간 데이터 표시
- [x] WIS 출역 데이터 동기화 + 화면 표시
- [x] 통합 검색 동작
- [x] 배치 연동 실패 → 재시도 → 운영 알림 동작
- [x] 주요 화면 모바일 반응형 확인

---

### Phase 6. 안정화 + 운영 전환 `Week 17~19`

> 두 팀 공동으로 품질 점검, 성능 최적화, 운영 준비

#### 1팀 — 테스트 + 성능

> 현재상태: ✅ Phase 6 1팀 완료
> 구현 완료: E2E/성능/인덱스/보안 점검 스크립트 + 주요 API 보안 하드닝 + 보안 헤더 적용
> 실측 결과:
> - `npm run phase6:team1:e2e` 통과 (핵심 시나리오 4건)
> - `npm run phase6:team1:perf` 통과 (최대 P95: `/api/dashboard/summary` 121.3ms)
> - `npm run phase6:team1:index` 통과 (권장 인덱스 9개)
> - `npm run phase6:team1:security` 통과

| 작업 | 상세 | 완료 기준 |
|------|------|----------|
| E2E 테스트 | 핵심 시나리오 4건 | 전체 통과 |
| 성능 튜닝 | 주요 목록 조회 1초 이내 | Lighthouse + API 응답 시간 측정 |
| 인덱스 검증 | 권장 인덱스 9개 적용 확인 | `explain()` 검증 |
| 보안 점검 | XSS/CSRF/인젝션 스캔 | 취약점 0건 |

`실행 커맨드`
- `npm run phase6:team1:e2e`
- `npm run phase6:team1:perf`
- `npm run phase6:team1:index`
- `npm run phase6:team1:security`

`사전 조건`
- MongoDB 실행 + `MONGODB_URI` 연결 가능
- PMIS 서버 실행(`npm run dev` 또는 `npm run start`)

#### 2팀 — 마이그레이션 + 운영

> 현재상태: ✅ Phase 6 2팀 완료
> 실측 결과:
> - `npm run phase6:team2:audit` 통과 (mutation handler 감사로그 커버리지 100%)
> - 데이터 이관 점검 완료 (운영 전환 기준으로 더미 주입 스크립트 제거됨)
> - 운영 문서 완료: `docs/operations-manual.md`, `docs/runbook.md`

| 작업 | 상세 | 완료 기준 |
|------|------|----------|
| 데이터 마이그레이션 | 레거시 ASP → MongoDB 이관 스크립트 | 전체 현장 데이터 이관 |
| 감사로그 점검 | 승인/반려/삭제/권한변경 100% 기록 | `audit_logs` 누락 0건 |
| 운영 매뉴얼 | 사용자 가이드 + 관리자 가이드 | 문서 작성 완료 |
| 장애 대응 | Runbook 작성 | 배포/롤백/장애 대응 절차 확정 |

#### Phase 6 핵심 E2E 시나리오

| # | 시나리오 | 검증 포인트 |
|---|---------|-----------|
| 1 | 문서작성 위저드 → 결재 → 발송/접수 | 위저드 4단계 + 결재선 상태 + 대장 반영 |
| 2 | 도면 검토요청 → 검토결과 등록 | 요청/결과 분리 + 승인/반려 |
| 3 | 하도급 계약검토 → 검토대장 반영 | 검토항목 11건 + 대장 자동 반영 |
| 4 | 회의 등록 → 회의록 → 대시보드 반영 | CRUD + 위젯 집계 |

#### Phase 6 공동 완료 기준

- [x] E2E 4건 전체 통과
- [x] 주요 조회 API 응답 1초 이내
- [x] 감사로그 100% 기록
- [x] 레거시 데이터 이관 완료
- [x] 운영 매뉴얼 + Runbook 확정

`최종 점검 일시`: 2026-02-24

---

## 4. 라우트 vs 탭 적용 기준

| 화면 | 방식 | 근거 |
|------|------|------|
| 문서관리대장 4종 (업무지시/발송/접수/검색) | **라우트 분리** | URL 공유, 권한, 쿼리 조건 상이 |
| 도면검토 요청/결과 | **라우트 분리** | 승인 액션 + 상태 전이 독립 |
| 하도급 검토요청/검토대장 | **라우트 분리** | 입력/승인/대장 조회 분리 |
| 인원정보 (시공사/관련사/관공서) | **탭(상태)** | 동일 API, `category` 필터 전환 |
| 공정 차트 (주간/월간/누적) | **탭(상태)** | 동일 데이터 시각화 전환 |
| 안전법규 상세 | **탭(상태)** | 동일 목록 내 문서 전환 |

---

## 5. 화면 유형별 완료 정의 (DoD)

| 화면 유형 | 완료 기준 |
|----------|----------|
| **목록형** | 검색, 정렬, 페이지네이션, 엑셀 출력, 권한별 버튼 제어 |
| **상세형** | 조회/수정 이력, 첨부 다운로드, 감사로그 기록 |
| **등록/수정 폼** | `zod` 유효성 검증, 저장/임시저장, 취소 복귀 경로 |
| **승인 화면** | 승인/반려 사유, 결재선 상태 동기화, 알림 이벤트 |
| **외부 연계** | 최근 동기화 시각, 실패 상태 표시, 재시도 액션 |

---

## 6. 스타일 & 레이아웃 가이드

### 6.1 Tailwind CSS 사용 규칙

| 규칙 | 상세 |
|------|------|
| **유틸리티 우선** | 인라인 Tailwind 클래스 사용, 커스텀 CSS 최소화 |
| **커스텀 테마** | `tailwind.config.ts`에 PMIS 전용 색상/간격/폰트 정의 |
| **다크 모드** | `dark:` 프리픽스 지원, `class` 전략 사용 |
| **반응형** | 모바일 우선 (`sm:` → `md:` → `lg:` → `xl:`) |
| **컴포넌트 추출** | 3회 이상 반복 패턴은 `components/ui/`로 분리 |
| **className 정렬** | 레이아웃 → 간격 → 크기 → 색상 → 타이포 → 상태 순서 |

### 6.2 색상 시스템

#### 시멘틱 색상 (CSS 변수 + Tailwind extend)

| 변수명 | 용도 | Tailwind 클래스 | 값 (Light) |
|--------|------|----------------|-----------|
| `--color-primary` | 브랜드, 네비게이션, 주요 버튼 | `bg-primary`, `text-primary` | `#2563EB` (Blue-600) |
| `--color-primary-hover` | 버튼/링크 호버 | `hover:bg-primary-hover` | `#1D4ED8` (Blue-700) |
| `--color-secondary` | 보조 UI, 비활성 탭 | `bg-secondary` | `#64748B` (Slate-500) |
| `--color-success` | 완료, 승인, 합격 | `bg-success`, `text-success` | `#16A34A` (Green-600) |
| `--color-warning` | 미결, 대기, 주의 | `bg-warning`, `text-warning` | `#F59E0B` (Amber-500) |
| `--color-danger` | 반려, 실패, 불합격, 삭제 | `bg-danger`, `text-danger` | `#DC2626` (Red-600) |
| `--color-info` | 정보, 안내 | `bg-info` | `#0EA5E9` (Sky-500) |

#### 상태 배지 색상 매핑

| 상태 | 배경 | 텍스트 | 사용 화면 |
|------|------|--------|----------|
| 진행중 / `in_review` | `bg-blue-100` | `text-blue-700` | 문서, 도면검토, 승인요청 |
| 완료 / `approved` | `bg-green-100` | `text-green-700` | 결재완료, 승인, 합격 |
| 미결 / `draft` / `pending` | `bg-amber-100` | `text-amber-700` | 미결문서, 대기, 임시저장 |
| 반려 / `rejected` | `bg-red-100` | `text-red-700` | 반려, 불합격, 실패 |
| 종료 / `completed` | `bg-gray-100` | `text-gray-600` | 완료된 현장, 종결 이슈 |

#### 배경 계층

| 계층 | 클래스 | 용도 |
|------|--------|------|
| 전체 배경 | `bg-gray-50` | 페이지 바탕 |
| 카드/패널 | `bg-white` | 콘텐츠 컨테이너 |
| 테이블 헤더 | `bg-gray-100` | 테이블 `<thead>` |
| 테이블 호버 | `hover:bg-gray-50` | 행 호버 |
| 사이드바 | `bg-white` (Light) / `bg-gray-900` (Dark) | 좌측 패널 |
| Top Bar | `bg-white border-b` | 상단바 |

### 6.3 타이포그래피

| 요소 | 클래스 | 비고 |
|------|--------|------|
| 페이지 제목 | `text-xl font-bold text-gray-900` | 각 페이지 최상단 |
| 섹션 제목 | `text-lg font-semibold text-gray-800` | 카드/패널 헤더 |
| 테이블 헤더 | `text-sm font-medium text-gray-600 uppercase` | `<th>` |
| 본문 텍스트 | `text-sm text-gray-700` | 기본 콘텐츠 |
| 보조 텍스트 | `text-xs text-gray-500` | 날짜, 작성자, 힌트 |
| 라벨 | `text-sm font-medium text-gray-700` | 폼 라벨 |
| 링크 | `text-sm text-primary hover:underline` | 클릭 가능 텍스트 |
| 폰트 패밀리 | `font-sans` (Pretendard 또는 Noto Sans KR) | 한글 최적화 |

### 6.4 간격 & 크기 체계

| 요소 | 값 | Tailwind |
|------|:--:|----------|
| 페이지 좌우 패딩 | `24px` | `px-6` |
| 카드 내부 패딩 | `16px` | `p-4` |
| 섹션 간 간격 | `24px` | `space-y-6` |
| 카드 간 간격 | `16px` | `gap-4` |
| 폼 필드 간 간격 | `16px` | `space-y-4` |
| 입력 필드 높이 | `36px` | `h-9` |
| 버튼 높이 | `36px` (기본) / `32px` (소형) | `h-9` / `h-8` |
| 테이블 행 높이 | `40px` | `h-10` |
| 모달 최대 너비 | `640px` (md) / `768px` (lg) | `max-w-2xl` / `max-w-3xl` |
| 사이드바 너비 | `240px` | `w-60` |
| 라운드 (카드) | `8px` | `rounded-lg` |
| 라운드 (버튼/입력) | `6px` | `rounded-md` |
| 라운드 (배지) | `9999px` | `rounded-full` |

### 6.5 반응형 브레이크포인트

| 브레이크포인트 | 너비 | 레이아웃 |
|:------------:|:----:|---------|
| 기본 (모바일) | `< 640px` | 1단 — 사이드바 숨김, 메뉴 햄버거 |
| `sm` | `≥ 640px` | 1단 — 테이블 가로 스크롤 |
| `md` | `≥ 768px` | 2단 — 사이드바 표시, 위젯 숨김 |
| `lg` | `≥ 1024px` | 3단 — 사이드바 + 메인 + 위젯 패널 |
| `xl` | `≥ 1280px` | 3단 — 넓은 메인 콘텐츠 |

```
모바일 (< 768px)          태블릿 (768~1024px)       데스크톱 (≥ 1024px)
┌──────────────┐       ┌────────────────────┐    ┌────────────────────────────┐
│   TopBar     │       │     TopBar         │    │         TopBar              │
│   TopNav     │       │     TopNav         │    │         TopNav              │
│   hamburger  │       ├─────┬──────────────┤    ├─────┬──────────────┬────────┤
├──────────────┤       │Side │   Main       │    │Side │    Main      │Widget  │
│              │       │bar  │   Content    │    │bar  │    Content   │Panel   │
│   Main       │       │     │              │    │     │              │        │
│   Content    │       │     │              │    │     │              │        │
│   (full)     │       └─────┴──────────────┘    └─────┴──────────────┴────────┘
└──────────────┘
```

### 6.6 전체 레이아웃 구조

```
┌──────────────────────────────────────────────────┐
│  Top Bar (h-14)                                  │
│  로고 | 프로젝트명 | 현장선택 | 알림(배지) | 아바타 │
├──────────────────────────────────────────────────┤
│  Top Nav (h-12)                                  │
│  [대시보드][현장정보][공정관리][자원·조달]            │
│  [품질·안전][설계·문서][시스템관리]                   │
├────────┬───────────────────────────┬─────────────┤
│ Left   │     메인 콘텐츠 (flex-1)   │  Right     │
│ Side   │                           │  Widget    │
│ bar    │  페이지 제목 + 액션 버튼     │  Panel     │
│ (w-60) │  ─────────────────        │  (w-72)    │
│        │  데이터 테이블 / 폼         │            │
│ 문서함  │  또는 상세 보기             │  금일회의   │
│ (배지)  │  또는 차트/그래프           │  공지사항   │
│ 검색   │                           │  날씨      │
│ 날씨   │  ─────────────────        │            │
│ WIS    │  페이지네이션               │            │
│ DIS    │                           │            │
├────────┴───────────────────────────┴─────────────┤
│  Footer (h-10): 저작권 | 버전 정보                  │
└──────────────────────────────────────────────────┘
```

#### Top Bar 상세

| 요소 | 위치 | 동작 |
|------|------|------|
| 로고 | 좌측 | 클릭 → `/dashboard` |
| 프로젝트명 + 담당자 | 로고 우측 | 현재 현장명 + 시공 담당자 |
| 현장코드 | 중앙 | 클릭 → 현장 전환 모달 |
| Home | 우측 그룹 | 클릭 → `/dashboard` |
| 알림 아이콘 | 우측 그룹 | 배지(미결 건수), 클릭 → 알림 드롭다운 |
| Google 아바타 + 이름 | 우측 끝 | 클릭 → 프로필 모달 |
| Logout | 프로필 내 | 로그아웃 |

#### Left Sidebar 상세

| 영역 | 구성 | 동작 |
|------|------|------|
| 문서함 | 접수함 / 발송함 바로가기 | 미결 건수 배지 표시 |
| 통합 검색 | 검색 입력 필드 | 문서/도면/ISSUE 전체 검색 |
| 오늘의 날씨 | 기온, 날씨 아이콘 | Open-Meteo 연동 |
| 외부 링크 | WIS / DIS / Support | 새 탭 열기 |

#### Right Widget Panel (대시보드 전용)

| 위젯 | 표시 정보 |
|------|----------|
| 금일회의 | 시간, 안건, 장소, 주관 |
| 공지사항 | 제목, 날짜 (최근 5건) |
| 날씨 | 현재 기온, 예보, 특보 |

### 6.7 공통 UI 패턴 상세

#### A. 데이터 테이블

```
┌─ 페이지 제목 ──────────────────── [등록] [삭제] [엑셀] ─┐
│                                                        │
│  🔍 검색: [         ] [기간: 시작~종료] [상태: 전체 ▾]   │
│                                                        │
│  ┌──┬────┬──────────┬────────┬────────┬──────┐         │
│  │☐ │ No │   제목    │  작성자 │  날짜   │ 상태  │         │
│  ├──┼────┼──────────┼────────┼────────┼──────┤         │
│  │☐ │ 1  │ 문서제목1 │ 홍길동  │ 25.01  │ 🔵진행│         │
│  │☐ │ 2  │ 문서제목2 │ 김철수  │ 25.01  │ 🟢완료│         │
│  └──┴────┴──────────┴────────┴────────┴──────┘         │
│                                                        │
│  ◀ 1 2 3 4 5 ▶            총 123건 / 10건씩            │
└────────────────────────────────────────────────────────┘
```

| 요소 | Tailwind 클래스 | 규칙 |
|------|----------------|------|
| 테이블 컨테이너 | `bg-white rounded-lg shadow-sm border` | 카드 형태 |
| 헤더 행 | `bg-gray-100 text-sm font-medium` | 고정, 정렬 클릭 가능 |
| 데이터 행 | `hover:bg-gray-50 border-b` | 호버 효과, 클릭 → 상세 |
| 체크박스 | `w-4 h-4 rounded` | 전체 선택/해제 |
| 페이지네이션 | `flex gap-1` 버튼 그룹 | 현재 페이지 `bg-primary text-white` |
| 검색 영역 | `flex gap-2 mb-4` | 테이블 상단, 필터 조합 |
| 빈 상태 | `text-center py-12 text-gray-400` | "데이터가 없습니다" |

#### B. 문서 상세

```
┌─ [처리현황] [승인] [회송] [인쇄] [본문보기] ─── [닫기] ─┐
│                                                        │
│  문서번호: 공무-2025-001     시행일: 2025-01-15          │
│  수    신: ○○건설            참  조: △△감리              │
│  제    목: 자재공급원 승인 요청                            │
│  ──────────────────────────────────────                 │
│                                                        │
│  본문 영역 (rich text 또는 plain text)                   │
│                                                        │
│  ──────────────────────────────────────                 │
│  📎 첨부파일                                             │
│  ├ KS허가증.pdf (2.1MB) [다운로드]                       │
│  └ 시험성적서.pdf (1.5MB) [다운로드]                     │
│                                                        │
│  결재선: [기안] 홍길동 ✅ → [검토] 김철수 🔵 → [승인] 대기 │
└────────────────────────────────────────────────────────┘
```

| 요소 | 규칙 |
|------|------|
| 액션바 | 상단 고정, `flex justify-between`, 좌측 액션 버튼, 우측 닫기 |
| 메타 정보 | 2~3단 그리드, 라벨 `text-gray-500` + 값 `text-gray-900` |
| 본문 | `prose` 클래스 또는 `whitespace-pre-wrap` |
| 첨부 | 파일 아이콘 + 파일명 + 용량 + 다운로드 링크 |
| 결재선 | 수평 스텝 바, 상태별 아이콘/색상 (완료 `green`, 진행 `blue`, 대기 `gray`) |

#### C. 폼 입력

```
┌─ 문서 등록 ────────────────────────────────────────────┐
│                                                        │
│  문서번호  [자동생성: 공무-2025-002]                       │
│                                                        │
│  수    신  [             ▾]    참  조  [             ▾]  │
│  제    목  [                                         ]  │
│  시행일자  [📅 2025-01-15  ]    문서종류  [일반 ▾       ]  │
│                                                        │
│  본    문                                               │
│  ┌──────────────────────────────────────────────┐      │
│  │                                              │      │
│  │  (텍스트 입력 영역)                             │      │
│  │                                              │      │
│  └──────────────────────────────────────────────┘      │
│                                                        │
│  📎 첨부파일  [파일 선택] (최대 5개, 각 10MB 이하)         │
│  ├ 도면검토서.pdf ✕                                      │
│                                                        │
│  ───────────────────────────────────────────            │
│              [취소]  [임시저장]  [저장]                    │
└────────────────────────────────────────────────────────┘
```

| 요소 | Tailwind 클래스 | 규칙 |
|------|----------------|------|
| 폼 컨테이너 | `bg-white rounded-lg p-6 shadow-sm` | 카드 형태 |
| 라벨 | `text-sm font-medium text-gray-700 mb-1` | 필수 항목 `*` 빨강 표시 |
| 입력 필드 | `h-9 border rounded-md px-3 text-sm focus:ring-2 focus:ring-primary` | 포커스 시 ring |
| 셀렉트 | `h-9 border rounded-md` | 커스텀 또는 Headless UI |
| 텍스트영역 | `min-h-32 border rounded-md p-3` | 자동 높이 조절 |
| 파일 업로드 | 드래그&드롭 영역 + 파일 목록 | 확장자/크기 제한 표시 |
| 버튼 그룹 | `flex justify-end gap-2 pt-4 border-t` | 우측 정렬 |
| 그리드 | `grid grid-cols-2 gap-4` (2단) | 모바일에서 `grid-cols-1` |
| 에러 메시지 | `text-xs text-red-500 mt-1` | `zod` 검증 실패 시 |

#### D. 위저드 (문서작성)

```
┌─ 문서작성 ─────────────────────────────────────────────┐
│                                                        │
│  ① 입력 ──── ② 첨부 ──── ③ 결재선 ──── ④ 발송          │
│  ●━━━━━━━━━━●━━━━━━━━━━○───────────○                  │
│  완료        현재        미완료      미완료               │
│                                                        │
│  ┌──────────────────────────────────────────────┐      │
│  │  (현재 단계 폼 콘텐츠)                          │      │
│  └──────────────────────────────────────────────┘      │
│                                                        │
│              [이전 단계]              [다음 단계]         │
└────────────────────────────────────────────────────────┘
```

| 요소 | 규칙 |
|------|------|
| 스텝 바 | 완료 `bg-primary`, 현재 `bg-primary ring-2`, 미완료 `bg-gray-300` |
| 스텝 라벨 | 완료 `text-primary font-medium`, 미완료 `text-gray-400` |
| 스텝 커넥터 | 완료 `bg-primary h-0.5`, 미완료 `bg-gray-300 h-0.5` |
| 단계 전환 | 현재 단계 검증 통과 시에만 다음 버튼 활성화 |
| Step 1 (입력) | 문서 기본 정보 폼 |
| Step 2 (첨부) | 파일 업로드 (최대 5개) |
| Step 3 (결재선) | 결재자 선택 모달 → 순서 지정 |
| Step 4 (발송) | 최종 미리보기 → 발송 확인 |

#### E~G. 기타 패턴

| 패턴 | 핵심 규칙 |
|------|----------|
| **E. 위젯 카드** | `bg-white rounded-lg p-4 shadow-sm`, 제목 `font-semibold text-sm`, 콘텐츠 `text-xs`, 최대 5건 표시 + "더보기" 링크 |
| **F. 팝업/모달** | `fixed inset-0 bg-black/50` 배경, 콘텐츠 `bg-white rounded-lg max-w-2xl mx-auto`, 상단 제목 + 닫기(✕), 하단 버튼 그룹 |
| **G. 갤러리 뷰어** | 이미지 `object-cover rounded`, 네비게이션 `[처음][이전][다음][마지막]`, 썸네일 그리드 `grid grid-cols-4 gap-2` |

### 6.8 공통 컴포넌트 스타일 규칙

#### 버튼

| 종류 | 클래스 | 용도 |
|------|--------|------|
| Primary | `bg-primary text-white hover:bg-primary-hover h-9 px-4 rounded-md text-sm font-medium` | 저장, 등록, 발송, 승인 |
| Secondary | `bg-white text-gray-700 border hover:bg-gray-50 h-9 px-4 rounded-md text-sm` | 취소, 닫기, 임시저장 |
| Danger | `bg-danger text-white hover:bg-red-700 h-9 px-4 rounded-md text-sm font-medium` | 삭제, 반려 |
| Ghost | `text-gray-500 hover:text-gray-700 hover:bg-gray-100 h-9 px-3 rounded-md text-sm` | 부가 액션, 아이콘 버튼 |
| Small | 위 각 종류에 `h-8 px-3 text-xs` | 테이블 내 인라인 액션 |
| Disabled | `opacity-50 cursor-not-allowed` 추가 | 비활성 상태 |

#### 입력 필드

| 상태 | 클래스 |
|------|--------|
| 기본 | `border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary` |
| 에러 | `border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500` |
| 비활성 | `bg-gray-100 text-gray-500 cursor-not-allowed` |
| 읽기전용 | `bg-gray-50 text-gray-700` |

#### 배지 (StatusBadge)

```tsx
// 사용 예시
<StatusBadge status="approved" />   // 🟢 승인
<StatusBadge status="in_review" />  // 🔵 검토중
<StatusBadge status="draft" />      // 🟠 임시저장
<StatusBadge status="rejected" />   // 🔴 반려
```

| 상태 | 클래스 |
|------|--------|
| `approved` | `bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium` |
| `in_review` | `bg-blue-100 text-blue-700 ...` |
| `draft` / `pending` | `bg-amber-100 text-amber-700 ...` |
| `rejected` | `bg-red-100 text-red-700 ...` |
| `completed` | `bg-gray-100 text-gray-600 ...` |

### 6.9 데이터 표기 규칙

| 항목 | 형식 | 예시 |
|------|------|------|
| 날짜 | `YYYY-MM-DD` | `2025-01-15` |
| 날짜(테이블 축약) | `YY.MM.DD` | `25.01.15` |
| 시간 | `HH:mm` | `14:30` |
| 금액 | 천단위 콤마 + `원` | `1,234,567원` |
| 비율 | 소수 1자리 + `%` | `85.3%` |
| 면적 | 소수 2자리 + `㎡` | `12,345.67㎡` |
| 현장코드 | `K` + 9자리 | `K199043001` |
| 문서번호 | `접두어-YYYY-NNN` | `공무-2025-001` |
| 직급코드 | 2자리 영문 | `JA`(사원), `A`(대리), `S`(과장), `M`(팀장) |
| 파일 크기 | 자동 단위 | `1.5MB`, `234KB` |
| 빈 값 | `-` (대시) | 데이터 없을 때 |
| 건수 | `총 N건` | `총 123건` |

### 6.10 그림자 & 보더 규칙

| 요소 | 그림자 | 보더 |
|------|--------|------|
| 카드 | `shadow-sm` | `border border-gray-200` |
| 모달 | `shadow-xl` | 없음 |
| 드롭다운 | `shadow-lg` | `border border-gray-200` |
| Top Bar | 없음 | `border-b border-gray-200` |
| 사이드바 | 없음 | `border-r border-gray-200` |
| 입력 필드 | 없음 | `border border-gray-300` |
| 테이블 | `shadow-sm` | `border border-gray-200` |

---

## 7. 권장 인덱스

| Collection | 인덱스 | 비고 |
|---|---|---|
| `documents` | `{ siteId: 1, docNo: 1 }` | unique |
| `drawings` | `{ siteId: 1, drawingNo: 1, revisionNo: -1 }` | |
| `drawing_reviews` | `{ siteId: 1, requestedAt: -1 }` | |
| `subcontract_reviews` | `{ siteId: 1, approvedDate: -1 }` | |
| `meetings` | `{ siteId: 1, meetingDate: -1 }` | |
| `issues` | `{ siteId: 1, createdAt: -1 }` | |
| `notices` | `{ siteId: 1, postedAt: -1 }` | |
| `safety_education_records` | `{ siteId: 1, eduDate: -1 }` | |
| `audit_logs` | `{ siteId: 1, createdAt: -1 }` | |

---

## 8. 외부 연계 시스템

| 시스템 | 담당 팀 | 용도 | PMIS 연동 |
|--------|:-------:|------|----------|
| Open-Meteo | 1팀 | 현장별 좌표 기반 기상 예보 (무료/오픈소스) | 날씨 위젯 + 기상특보 알림 |
| WIS | 2팀 | 근로자 출역/안전교육 | 출역현황 + 안전교육 데이터 |
| DIS | 2팀 | 설계도면/자료 관리 | 도면 검색/열람 바로가기 |
| Support | 2팀 | FAQ/문제신고 | FAQ + 문의 티켓 |
