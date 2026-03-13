# PMIS 운영 매뉴얼

## 목차

1. [사용자 가이드](#사용자-가이드)
2. [관리자 가이드](#관리자-가이드)

---

# 사용자 가이드

## 1. 시스템 접속

### 1.1 로그인

- 브라우저에서 시스템 URL에 접속하면 로그인 페이지(`/login`)로 이동한다.
- **Google OAuth** 인증 방식을 사용한다. "Google로 로그인" 버튼을 클릭하여 Google 계정으로 인증한다.
- 인증 성공 시 대시보드(`/dashboard`)로 자동 이동한다.
- 세션은 JWT 기반으로 관리되며, 토큰 만료 시 재로그인이 필요하다.

> **참고**: 개발 환경에서는 `PMIS_REQUIRE_LOGIN=false` 설정으로 인증 없이 접속할 수 있다. 이 경우 "개발 게스트" 계정으로 자동 로그인된다.

### 1.2 현장 선택

- 로그인 후 시스템은 사용자에게 할당된 현장(Site) 목록을 제공한다.
- 현장 선택 시 쿠키(`pmis_site_id`)에 현장 ID가 저장된다.
- 모든 데이터 조회/입력은 선택된 현장 기준으로 동작한다.
- 로그인 사용자에게 배정된 현장이 없으면 "현장 없음" 상태가 표시되며 업무 데이터가 조회되지 않는다.
- 현장 전환 시 메뉴의 현장 선택 드롭다운을 사용한다.

---

## 2. 주요 기능별 사용법

### 2.1 대시보드 (`/dashboard`)

대시보드는 현장의 핵심 현황을 한눈에 파악할 수 있는 메인 화면이다.

#### 요약 위젯 카드

| 위젯 | 설명 | 상태 표시 |
|------|------|----------|
| 결재 대기 문서 | in_review 상태 문서 건수 | warning (주황) |
| 도면 검토 대기 | pending 상태 도면검토 건수 | warning (주황) |
| 금일 회의 | 오늘 날짜 회의 건수 | info (파랑) |
| 오픈 이슈 | open 상태 이슈 건수 | danger (빨강) |
| 공지사항 | 전체 공지사항 건수 | success (초록) |
| 운영중 품질 목표 | active 상태 품질 목표 건수 | info (파랑) |

#### QA 운영 경고 카드

| 위젯 | 설명 | 이동 |
|------|------|------|
| 미완료 내부 심사 | 오늘까지 완료되지 않은 QA 심사 건수 | `/qa/audits` |
| 기한 경과 CAPA | 기한을 넘긴 CAPA 건수 | `/qa/capa?overdueOnly=true` |
| 경고 KPI | 임계치를 벗어난 KPI 건수 | `/qa/kpi?alertOnly=true&year=현재연도` |

#### 하위 페이지

- **공지사항** (`/dashboard/notices`): 현장 공지사항 목록 조회 및 등록
- **미결문서** (`/dashboard/pending-docs`): 결재 대기 중인 문서 목록
- **회의관리** (`/dashboard/meetings`): 회의 일정 및 회의록 관리
- **통합검색** (`/dashboard/search`): 문서, 도면, 이슈, 자료실을 한 번에 검색

---

### 2.2 문서관리 (`/design-docs/documents`)

#### 문서 작성 플로우 4단계 (`/design-docs/documents/wizard/[step]`)

| 단계 | 내용 |
|------|------|
| **Step 1** | 문서 기본정보 입력 (문서번호, 제목, 문서종류, 발신/수신처) |
| **Step 2** | 문서 본문 작성 및 편집 |
| **Step 3** | 첨부파일 업로드 (파일 선택 후 `/api/files/upload` 호출) |
| **Step 4** | 결재선 지정 및 최종 확인 후 제출 |

#### 결재 플로우

문서 상태 흐름:

```
draft (작성중) --> in_review (검토중) --> approved (승인) 또는 rejected (반려)
```

- **작성자**: 문서를 작성하고 결재 요청(제출)
- **검토자**: 문서 검토 후 승인 또는 반려 처리
- 결재선은 `DocumentApprovalLine` 모델로 관리된다
- 상태 변경 시 감사 로그가 자동 기록된다

#### 대장 조회

- **문서 수신/발신** (`/design-docs/documents/ledgers/correspondence`): 외부 수신/발신 문서 통합 목록
- **업무지시** (`/design-docs/documents/ledgers/instruction`): 업무 지시 문서 목록
- **문서검색** (`/design-docs/documents/search`): 문서번호, 제목, 내용, 발신처, 수신처, 분류코드 검색 가능

#### 문서 부가 기능

- **분류관리** (`/design-docs/documents/categories`): 문서 분류 체계 생성/수정
- **시스템항목** (`/design-docs/documents/system`): 문서 관련 시스템 코드 설정

---

### 2.3 설계관리 (`/design-docs/design`)

#### 도면목록 (`/design-docs/design/drawings`)

- 현장의 전체 도면 목록을 조회한다.
- 도면번호, 도면명, 분야(discipline), 위치(location) 기준으로 필터링 가능하다.
- 도면 등록 시 파일 업로드와 함께 기본정보를 입력한다.

#### 도면 열람 시스템 (`/design-docs/design/drawing-viewer`)

- PMIS 도면 목록을 조회하고 외부 도면 열람 시스템으로 바로 이동한다.
- 외부 연동 URL은 `ExternalLinkItem(category=general)`에서 "도면 열람 시스템" 항목을 사용한다.
- 기존 `/system-admin/integrations/drawing-viewer` 경로는 호환용 리다이렉트다.

#### 도면검토 (`/design-docs/design/reviews`)

- 도면에 대한 검토 요청 및 결과를 관리한다.
- **검토 요청** (`/design-docs/design/reviews/[id]/request`): 검토 대상 도면 선택 후 검토자에게 요청
- **검토 결과** (`/design-docs/design/reviews/[id]/result`): 승인(approved), 조건부승인, 반려(rejected) 처리
- 검토 상태: `pending` --> `approved` / `rejected` (`/api/drawing-reviews/[reviewId]/decision`)

#### 설계변경 (`/design-docs/design/changes`)

- 설계변경 이력을 등록하고 관리한다.
- 변경 사유, 변경 전/후 내용, 관련 도면 정보를 기록한다.
- 변경 이력은 `DesignChange` 모델로 관리된다.

#### 설계자료 트리 (`/design-docs/design/assets`)

- 설계 관련 자료를 트리 구조로 분류하여 관리한다.
- `DesignTreeNode` 모델로 폴더 구조를 구현한다.
- `DesignAsset` 모델로 개별 자료(파일)를 관리한다.
- 자료 등록, 수정, 삭제 및 폴더 이동이 가능하다.

---

### 2.4 공정관리 (`/progress`)

#### 진행 개요 (`/progress`)

- 공정관리 핵심 지표(리포트, 일정, 지연 작업)를 통합 조회한다.

#### 현장 리포트 (`/progress/reports`)

- 보고서에는 금일/금주 실적, 차기 계획, 문제점 및 조치사항을 포함한다.
- 현장 사진은 별도 메뉴가 아닌 보고서 첨부로 업로드/관리한다.

#### 안전 일지 (`/quality-safety/safety/management/daily-log`)

- 안전팀이 안전 일지를 작성하고 현장소장 확인용으로 관리한다.

#### 공정 추적 (`/progress/master-schedule`, `/progress/comparison`)

- 전체 공사 공정표를 관리한다.
- 공종별 시작일/종료일, 진행률을 입력하고 추적한다.
- 공정 추적 화면에서 `공정표`와 `진도 분석`을 탭으로 전환해 사용한다.
- `ScheduleItem` 모델 기반으로 공정 데이터를 관리한다.

#### 일정 캘린더 (`/progress/calendar`)

- 현장 일정을 캘린더 뷰로 확인한다.
- `ProjectCalendarEvent` 모델로 이벤트를 관리한다.
- 일정 등록, 수정, 삭제가 가능하다.

#### 현장 날씨 (`/progress/weather`)

- Open-Meteo API 연동으로 현장 위치의 기상 데이터를 조회한다.
- `WeatherSnapshot` 모델에 동기화된 기상 데이터가 저장된다.

---

### 2.5 자원조달 (`/resource-procurement`)

#### 자재관리 (`/resource-procurement/materials/plan-actual`)

- 자재 투입 계획 대비 실적을 관리한다.
- `MaterialPlanActual` 모델 기반.

#### 장비관리 (`/resource-procurement/equipment/plan-actual`)

- 장비 투입 계획 대비 실적을 관리한다.
- `EquipmentPlanActual` 모델 기반.

#### 공급원승인 (`/resource-procurement/supplier-approvals`)

- 공급원 승인 요청/진행 상태를 단일 화면에서 관리한다.

#### 자재검수 (`/qc/material-inspection`)

- 자재 검수는 QC 메뉴에서 운영한다.
- API는 `/api/qc/material-inspections`를 사용한다.

#### 출역관리 (`/resource-procurement/workforce`)

- **일일출역** (`/resource-procurement/workforce/daily`): 일일 인원 출역 기록 등록
- **근태 통계** (`/resource-procurement/workforce/statistics`): 기간별 출역 요약 통계 조회

#### 하도급 (`/resource-procurement/subcontract`)

- 하도급 심사 등록/조회는 단일 화면에서 관리한다.

#### 손익현황 (`/resource-procurement/profit-loss`)

- 현장 손익 현황을 조회한다.

---

### 2.6 QA/QC/안전 (`/qa`, `/qc`, `/quality-safety`)

#### QA (`/qa`)

- QA 메뉴는 실제 운영 화면으로 연결되어 있다.
- **품질 정책·목표** (`/qa/policy-goals`): 품질방침, 연간 목표, 측정주기, 담당자 관리
- **품질보증계획(QAP)** (`/qa/assurance-plan`): 계획 버전, 체크포인트, 실행률 관리
- **표준 절차·템플릿** (`/qa/procedures`): 절차서 버전, 적용범위, 첨부/링크 관리
- **내부 심사** (`/qa/audits`): 심사 계획, 체크리스트, 결과, CAPA 연계
- **개선조치(CAPA)** (`/qa/capa`): 원인분석, 책임자, 기한, 검증 관리
- **협력사 품질보증** (`/qa/partner-assurance`): 협력사 평가, 후속조치, 리스크 관리
- **품질 KPI** (`/qa/kpi`): 목표 대비 실적, 월/분기/연간 추이, 경고 임계치 관리

#### QC (`/qc`)

- QC 메뉴는 실제 운영 화면으로 연결되어 있다.
- **검사·시험 계획 (ITP)** (`/qc/itp`): 공종별 검사 기준, 체크포인트, 버전 관리
- **자재 검사** (`/qc/material-inspection`): 반입 자재 검사, 판정 사유, 보류/반출, NCR 연계
- **공정 검사** (`/qc/process-inspection`): 공정별 검사, 시정조치 요청, 첨부 증빙 관리
- **시험 성적서** (`/qc/test-reports`): 기준치 대비 자동 판정, 참조 검사 연결, NCR 검토
- **NCR** (`/qc/nonconformance`): 부적합 등록, 원인분석, 조치 계획, 검증 관리
- **인수·준공 검사** (`/qc/handover-inspection`): 인수/준공 checklist, 보완 요청, 승인 요청 관리
- **품질 대시보드** (`/qc/quality-dashboard`): 자재 합격률, 시험 기준치 이탈, NCR, 인수·준공 리스크 요약

#### 안전 (`/quality-safety`)

#### 안전방침 (`/quality-safety/safety/policies`)

- 현장 안전방침 문서를 등록하고 관리한다.

#### 교육/보건

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 정기 교육 | `/quality-safety/safety/education/training` | 안전교육 실시 기록 관리 |
| 신규교육 대상자 | `/quality-safety/safety/education/new-worker` | 최근 30일 이내 최초 출역 기준 신규교육 대상자 조회 |
| 보호구 지급 | `/quality-safety/safety/education/equipment` | 중장비 교육 기록 |
| 건강 관리 | `/quality-safety/safety/education/health` | 보건 관련 교육 기록 |
| 무재해 현황 | `/quality-safety/safety/education/accident-free` | 무재해 달성 현황 |

#### 운영 관리

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 착수 준비 | `/quality-safety/safety/management/setup` | 인허가 신고 및 안전관리자 지정 |
| 운영 리포트 | `/quality-safety/safety/management/ongoing` | 진행 중인 상황 보고/운영비 기록 |
| 사고/조치 이력 | `/quality-safety/safety/management/completion` | 사고 및 조치 이력 관리 |

#### 계획/점검

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 위험성 평가 | `/quality-safety/safety/standards/hazard` | 위험성 평가 기록 |
| 안전 실행계획 | `/quality-safety/safety/standards/plan` | 안전관리 계획서 |
| 협력사 안전계획 | `/quality-safety/safety/standards/partner` | 협력업체 안전 관리 |
| 점검 체크리스트 | `/quality-safety/safety/rewards/checklist` | 안전 점검 체크리스트 |

#### 성과/시설

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 안전 포인트 | `/quality-safety/safety/rewards/mileage` | 안전 마일리지 적립 현황 |
| 안전시설물 | `/quality-safety/safety/facilities` | 표준 시설과 우수 사례 통합 관리 |

#### 정책/규정

- **안전 정책** (`/quality-safety/safety/policies`)
- **안전 규정** (`/quality-safety/safety/regulations`)
- **법령/가이드** (`/quality-safety/safety/laws`)

---

### 2.7 현장정보 (`/site-info`)

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 현장 개요 | `/site-info/overview` | 현장 기본 정보 (코드/명칭/주소/기간/상태) |
| 관계자 현황 | `/site-info/people` | 현장 인력/연락처 정보 |
| 기술 문서 | `/site-info/technical-docs` | 기술 문서/기준 정보 |
| 방문자관리 | `/site-info/visitors` | 현장 방문자 기록 |

---

### 2.8 파일 업로드/다운로드

현재 구현 상태

- 파일 저장소는 `S3`가 아니라 애플리케이션 서버의 로컬 파일시스템이다.
- 업로드 파일은 `public/uploads/**` 아래에 저장된다.
- `S3` 또는 외부 오브젝트 스토리지 연동은 아직 구현되지 않았다.
- Runbook에 있는 `S3_*` 환경 변수는 추후 확장용 예약 항목으로 봐야 한다.

#### 업로드

1. 파일 업로드가 필요한 화면에서 파일 선택 버튼을 클릭한다.
2. 파일을 선택하면 `/api/files/upload` API로 multipart/form-data 형태로 전송된다.
3. 업로드된 파일은 `public/uploads/{module}/{yyyy}/{mm}/{uuid}.{ext}` 경로에 저장된다.
4. 파일 메타데이터는 `FileAsset` 모델에 기록된다 (원본 파일명, MIME 타입, 용량, 업로더).

#### 다운로드

- 업로드된 파일은 `storagePath`를 기준으로 `/uploads/{storagePath}` 형태의 URL로 제공된다.
- 파일명은 원본 파일명(`originalName`)으로 제공된다.
- 따라서 현재 배포 구조는 앱 서버 로컬 디스크를 유지하는 단일 스토리지 전제를 가진다.

---

### 2.9 통합검색 (`/dashboard/search`)

통합검색은 여러 데이터 소스를 한 번에 검색하는 기능이다.

**검색 대상**:

| 소스 | 검색 필드 |
|------|----------|
| 문서 (document) | 문서번호, 제목, 내용, 발신처, 수신처, 분류코드 |
| 도면 (drawing) | 도면번호, 도면명, 분야, 위치, 비고 |
| 이슈 (issue) | 제목, 내용, 작성자명 |
| 자료실 (library) | 제목, 설명, 작성자명, 분류코드 |

**사용 방법**:

1. 검색창에 키워드를 입력한다.
2. 검색 결과는 소스별로 그룹화되어 표시된다.
3. 각 결과의 건수가 소스별로 표시된다 (예: 문서 3건, 도면 2건).
4. 결과 클릭 시 해당 상세 페이지로 이동한다.
5. 결과는 최신 수정일 기준으로 정렬된다.

---

# 관리자 가이드

## 1. 권한 체계

시스템은 4단계 역할 기반 접근 제어(RBAC)를 사용한다.

| 역할 | 권한 수준 | 설명 |
|------|----------|------|
| `super_admin` | 4 | 시스템 전체 관리자. 모든 현장 및 기능 접근 가능 |
| `site_admin` | 3 | 현장 관리자. 담당 현장의 모든 기능 접근, 감사로그 조회 가능 |
| `manager` | 2 | 현장 관리 담당. 데이터 생성/수정 가능 |
| `viewer` | 1 | 조회 전용. 데이터 열람만 가능 |

**권한 확인 방식**:
- 각 API 엔드포인트에서 `requireRole(최소역할)` 함수로 권한을 검증한다.
- 사용자 역할이 요구 역할보다 같거나 높은 수준이면 접근이 허용된다.
- 권한 부족 시 403 Forbidden 응답이 반환된다.
- 미인증 시 401 Unauthorized 응답이 반환된다.

**역할 할당**:
- 사용자의 역할은 `User` 모델의 `role` 필드에 저장된다.
- 기본 역할은 `viewer`이다.
- `super_admin`만 다른 사용자의 역할을 변경할 수 있다.
- 사용자별로 접근 가능한 현장 목록(`siteIds`)이 지정된다.

---

## 2. 코드 관리 (`/system-admin/codes`)

공통 코드는 `CodeGroup`과 `CodeItem` 모델로 관리된다. API: `/api/system/codes/[groupCode]/[itemId]`

### 관리 가능 코드 목록

| 코드 그룹 | 경로 | 설명 |
|----------|------|------|
| 협력업체 | `/system-admin/codes/partners` | 협력업체 코드 등록/수정/삭제 |
| 자재 | `/system-admin/codes/materials` | 자재 분류 코드 관리 |
| 장비 | `/system-admin/codes/equipment` | 장비 분류 코드 관리 |

### 코드 관리 방법

1. 해당 코드 관리 페이지로 이동한다.
2. 목록에서 기존 코드를 조회하거나 "신규 등록" 버튼으로 새 코드를 추가한다.
3. 코드 수정 시 기존 데이터와의 연관 관계에 주의한다.
4. 코드 삭제는 해당 코드를 참조하는 데이터가 없는 경우에만 권장한다.

---

## 3. 감사 로그 조회

감사 로그는 시스템 내 모든 데이터 변경 이력을 기록한다.

**접근 권한**: `site_admin` 이상

**API 엔드포인트**: `GET /api/audit-logs`

**필터 파라미터**:

| 파라미터 | 설명 | 예시 |
|---------|------|------|
| `siteId` | 현장 ID 필터 | `siteId=6789...` |
| `action` | 작업 유형 필터 | `action=document_created` |
| `entityType` | 엔티티 유형 필터 | `entityType=document` |
| `actorId` | 수행자 ID 필터 | `actorId=1234...` |
| `dateFrom` | 시작 일시 | `dateFrom=2026-01-01` |
| `dateTo` | 종료 일시 | `dateTo=2026-01-31` |
| `page` | 페이지 번호 (기본: 1) | `page=2` |
| `limit` | 페이지당 건수 (기본: 20, 최대: 100) | `limit=50` |

**기록되는 작업 유형**:
- `{entityType}_created`: 데이터 생성
- `{entityType}_updated`: 데이터 수정
- `{entityType}_deleted`: 데이터 삭제
- `{entityType}_status_changed`: 상태 변경 (이전/이후 상태 기록)
- `file_upload`: 파일 업로드

**감사 로그 레코드 필드**:
- `siteId`: 현장 ID
- `action`: 수행된 작업
- `entityType`: 대상 엔티티 종류
- `entityId`: 대상 엔티티 ID
- `actorId`: 수행자 사용자 ID
- `actorName`: 수행자 이름
- `details`: 상세 내용 (선택)
- `metadata`: 추가 메타데이터 (변경 전/후 값, 상태 변경 정보 등)
- `createdAt`: 기록 시간

---

## 4. 사용자/현장 관리

### 사용자 관리

- 사용자 정보는 `User` 모델에 저장된다.
- Google OAuth로 최초 인증 시 사용자 레코드가 자동 생성된다.
- 첫 로그인 사용자는 자동으로 `super_admin`이 된다.
- 사용자-현장 배정과 현장 내 역할은 `SiteMembership`에서 관리한다.
- 사용자 역할(`User.role`) 변경 전용 UI/API는 현재 별도 제공하지 않는다.

### 현장 관리

- 현장 정보는 `Site` 모델에 저장된다.
- `super_admin`은 현장 생성/수정이 가능하다.
- 현장 기본 정보: `siteCode`, `siteName`, `address`, `status`, `startDate`, `endDate`, `description`
- API: `GET/POST /api/sites`, `GET/PATCH /api/sites/[id]`

### 현장 회원 관리

- `SiteMembership` 모델로 사용자-현장 매핑을 관리한다.
- 현장별로 참여 인원과 역할을 지정할 수 있다.

---

## 5. 시스템 설정 (`/system-admin`)

### 공통 관리 메뉴

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 외부사이트 | `/system-admin/common/external-sites` | 법령정보/KS/전문사이트 외부 링크 통합 조회 |
| 이슈관리 | `/system-admin/common/issues` | 현장 이슈 등록 및 추적 |
| 자료실 | `/system-admin/common/library` | 공용 자료실 관리 |
| 회의/회의록 | `/system-admin/common/meetings?tab=meetings|minutes` | 회의 개최/회의록 통합 관리 |
| 사용자-현장 매핑 | `/system-admin/site-memberships` | 가입 사용자(`users`)를 현장(`sites`)에 권한과 함께 배정/해제 |

### 외부 연계

| 연계 | 경로 | 설명 |
|------|------|------|
| 도면 열람 시스템 | `/design-docs/design/drawing-viewer` | 설계도면 검색/열람 연동 관리 |

### 고객지원 (`/system-admin/support`)

| 메뉴 | 경로 | 설명 |
|------|------|------|
| Support (탭 통합) | `/system-admin/support?tab=faq|tickets` | FAQ 조회 + 사용자 문의/지원 요청 관리 |

### 보안 설정

시스템은 다음의 보안 기능을 기본 적용한다:

- **CSRF 보호**: 변경 요청(POST/PUT/DELETE)에 대해 Origin 헤더 검증
- **XSS 방어**: 입력값에 `<script>`, `javascript:`, `<iframe>` 등 위험 패턴 차단
- **입력값 검증**: Zod 스키마 기반 서버사이드 유효성 검사
- **인증/인가**: NextAuth.js JWT 기반 세션 관리 + 역할 기반 접근 제어
