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
- 현장이 지정되지 않은 경우 가장 먼저 생성된 현장이 자동 선택된다.
- 현장 전환 시 메뉴의 현장 선택 드롭다운을 사용한다.

---

## 2. 주요 기능별 사용법

### 2.1 대시보드 (`/dashboard`)

대시보드는 현장의 핵심 현황을 한눈에 파악할 수 있는 메인 화면이다.

#### 요약 위젯 카드

| 위젯 | 설명 | 상태 표시 |
|------|------|----------|
| 미결 문서 | draft, in_review 상태 문서 건수 | warning (주황) |
| 검토 대기 | pending 상태 도면검토 건수 | warning (주황) |
| 금일 회의 | 오늘 날짜 회의 건수 | info (파랑) |
| 신규 이슈 | open 상태 이슈 건수 | danger (빨강) |
| 공지사항 | 전체 공지사항 건수 | success (초록) |

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
- **양식관리** (`/design-docs/documents/templates`): 재사용 가능한 문서 양식 등록
- **시스템항목** (`/design-docs/documents/system`): 문서 관련 시스템 코드 설정

---

### 2.3 설계관리 (`/design-docs/design`)

#### 도면목록 (`/design-docs/design/drawings`)

- 현장의 전체 도면 목록을 조회한다.
- 도면번호, 도면명, 분야(discipline), 위치(location) 기준으로 필터링 가능하다.
- 도면 등록 시 파일 업로드와 함께 기본정보를 입력한다.

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

#### 공정 보고서 (`/progress/reports`)

- 일간/주간/월간 공정 보고서를 작성하고 조회한다.
- 보고서에는 금일/금주 실적, 차기 계획, 문제점 및 조치사항을 포함한다.

#### 공정표 (마스터 스케줄) (`/progress/master-schedule`)

- 전체 공사 공정표를 관리한다.
- 공종별 시작일/종료일, 진행률을 입력하고 추적한다.
- `ScheduleItem` 모델 기반으로 공정 데이터를 관리한다.

#### S-Curve (계획 대 실적 비교) (`/progress/comparison`)

- 계획 공정률과 실적 공정률을 S-Curve 그래프로 비교 표시한다.
- 월별 누적 데이터를 기반으로 차트를 렌더링한다 (Recharts 사용).

#### 캘린더 (`/progress/calendar`)

- 현장 일정을 캘린더 뷰로 확인한다.
- `ProjectCalendarEvent` 모델로 이벤트를 관리한다.
- 일정 등록, 수정, 삭제가 가능하다.

#### 공사사진 (`/progress/photos`)

- 공종별/일자별 현장 사진을 등록하고 관리한다.
- 사진 업로드 시 촬영일자, 공종, 설명을 입력한다.
- `ProgressPhoto` 모델로 사진 메타데이터를 관리한다.

#### 일일 안전일지 (`/progress/daily-safety-log`)

- 일일 안전 관련 기록을 등록하고 조회한다.

#### 날씨 정보 (`/progress/weather`)

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

- **승인요청** (`/resource-procurement/supplier-approvals/requests`): 자재/장비 공급업체 승인 요청서 작성
- **승인현황** (`/resource-procurement/supplier-approvals/status`): 승인 진행 상태 조회

#### 자재검수 (`/resource-procurement/material-inspections`)

- **검수등록** (`/resource-procurement/material-inspections/register`): 입고 자재 검수 기록 등록
- **검수요청** (`/resource-procurement/material-inspections/requests`): 검수 요청 목록
- **검수대장** (`/resource-procurement/material-inspections/ledger`): 전체 검수 이력 조회

#### 출역관리 (`/resource-procurement/workforce`)

- **일일출역** (`/resource-procurement/workforce/daily`): 일일 인원 출역 기록 등록
- **출역현황** (`/resource-procurement/workforce/roster`): 인원별 출역 현황 조회
- **출역분석** (`/resource-procurement/workforce/analysis`): 공종별/업체별 출역 분석
- **출역요약** (`/resource-procurement/workforce/summary`): 기간별 출역 요약 통계

#### 하도급 (`/resource-procurement/subcontract`)

- **심사등록** (`/resource-procurement/subcontract/reviews/new`): 하도급 심사 요청서 신규 작성
- **심사대장** (`/resource-procurement/subcontract/review-ledger`): 하도급 심사 이력 조회

#### 손익현황 (`/resource-procurement/profit-loss`)

- 현장 손익 현황을 조회한다.

---

### 2.6 품질안전 (`/quality-safety`)

#### 안전방침 (`/quality-safety/safety/policies`)

- 현장 안전방침 문서를 등록하고 관리한다.

#### 안전교육

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 안전교육 이수 | `/quality-safety/safety/education/training` | 안전교육 실시 기록 관리 |
| 신규근로자 교육 | `/quality-safety/safety/education/new-worker` | 신규자 교육 이수 현황 |
| 장비교육 | `/quality-safety/safety/education/equipment` | 중장비 교육 기록 |
| 보건교육 | `/quality-safety/safety/education/health` | 보건 관련 교육 기록 |
| 무재해 현황 | `/quality-safety/safety/education/accident-free` | 무재해 달성 현황 |

#### 안전점검

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 안전관리 설정 | `/quality-safety/safety/management/setup` | 안전관리자 지정 |
| 진행중 관리 | `/quality-safety/safety/management/ongoing` | 진행 중인 안전 관리 현황 |
| 완료 관리 | `/quality-safety/safety/management/completion` | 완료된 안전 조치 현황 |
| 위험성 평가 | `/quality-safety/safety/standards/hazard` | 위험성 평가 기록 |
| 안전관리 계획 | `/quality-safety/safety/standards/plan` | 안전관리 계획서 |
| 협력사 관리 | `/quality-safety/safety/standards/partner` | 협력업체 안전 관리 |

#### 무재해 및 포상

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 무재해 포상 | `/quality-safety/safety/rewards/accident-free` | 무재해 달성 포상 관리 |
| 안전 체크리스트 | `/quality-safety/safety/rewards/checklist` | 안전 점검 체크리스트 |
| 마일리지 | `/quality-safety/safety/rewards/mileage` | 안전 마일리지 적립 현황 |

#### 기타

- **안전시설물** (`/quality-safety/safety/facilities/standard`, `/quality-safety/safety/facilities/excellent`)
- **안전규정** (`/quality-safety/safety/regulations`)
- **안전관계법령** (`/quality-safety/safety/laws`)

---

### 2.7 현장정보 (`/site-info`)

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 공사개요 | `/site-info/overview` | 현장 기본 정보 (공사명, 발주처, 공사기간, 위치 등) |
| 공사이력 | `/site-info/history` | 현장 공사 이력 관리 |
| 인원현황 | `/site-info/people` | 현장 인원 현황 (직급별, 부서별) |
| 공사계획 | `/site-info/construction-plans` | 공사 시행 계획서 |
| 시방서 | `/site-info/specifications` | 시방서 등록 및 관리 |
| 시공방법 | `/site-info/methods` | 시공 방법 문서 |
| 방문자관리 | `/site-info/visitors` | 현장 방문자 기록 |

---

### 2.8 파일 업로드/다운로드

#### 업로드

1. 파일 업로드가 필요한 화면에서 파일 선택 버튼을 클릭한다.
2. 파일을 선택하면 `/api/files/upload` API로 multipart/form-data 형태로 전송된다.
3. 업로드된 파일은 `public/uploads/{module}/{yyyy}/{mm}/{uuid}.{ext}` 경로에 저장된다.
4. 파일 메타데이터는 `FileAsset` 모델에 기록된다 (원본 파일명, MIME 타입, 용량, 업로더).

#### 다운로드

- 업로드된 파일은 `storagePath` 경로를 기반으로 다운로드할 수 있다.
- 파일명은 원본 파일명(`originalName`)으로 제공된다.

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
- `super_admin`은 사용자 역할(`role`) 변경 및 현장 할당(`siteIds`) 관리가 가능하다.
- 사용자 비활성화/활성화 처리가 가능하다.

### 현장 관리

- 현장 정보는 `Site` 모델에 저장된다.
- `super_admin`은 현장 생성/수정/삭제가 가능하다.
- 현장별 기본 정보: 현장명, 위치, 발주처, 공사기간, 좌표(위도/경도) 등
- API: `GET/PUT/DELETE /api/sites/[id]`

### 현장 회원 관리

- `SiteMembership` 모델로 사용자-현장 매핑을 관리한다.
- 현장별로 참여 인원과 역할을 지정할 수 있다.

---

## 5. 시스템 설정 (`/system-admin`)

### 공통 관리 메뉴

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 외부사이트 | `/system-admin/common/external-sites` | 법령정보/KS/전문사이트 외부 링크 통합 조회 |
| 회의관리 | `/system-admin/common/meetings` | 전체 회의 관리 |
| 이슈관리 | `/system-admin/common/issues` | 현장 이슈 등록 및 추적 |
| 자료실 | `/system-admin/common/library` | 공용 자료실 관리 |
| 회의록 | `/system-admin/common/minutes` | 회의록 관리 |
| 사용자-현장 매핑 | `/system-admin/site-memberships` | 가입 사용자(`users`)를 현장(`sites`)에 권한과 함께 배정/해제 |

### 외부 연계 (`/system-admin/integrations`)

| 연계 | 경로 | 설명 |
|------|------|------|
| WIS 연동 | `/system-admin/integrations/wis` | 근로자 정보 시스템(WIS) 데이터 동기화 |
| DIS 연동 | `/system-admin/integrations/dis` | 설계정보 시스템(DIS) 연동 관리 |

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
