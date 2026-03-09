# 자동 채번 / 자동 증가 검토 목록

기준:
- [ ] 식별자 성격의 값은 프론트에서 직접 입력받기보다 서버에서 생성하는 쪽이 안전함
- [ ] 정렬/순번 성격의 값은 생성 시 `max + 1` 기본값을 넣고, 필요할 때만 수정 가능하게 두는 편이 맞음
- [ ] 외부 기준번호를 따라야 하는 값은 무조건 새 번호를 만드는 것보다 기존 데이터 선택/연동이 우선임

## 1. 바로 자동화하는 게 맞는 항목

- [x] **1-1. 현장 코드 (`siteCode`)**
  현재 위치:
  - [x] `src/app/(main)/system-admin/sites/page.tsx`
  - [x] `src/app/api/sites/route.ts`
  현재 상태:
  - [x] 등록 화면에서 `siteCode` 직접 입력 제거, 다음 코드 읽기전용 미리보기로 변경
  - [x] API는 `siteCode` 없이 저장 가능하고 서버가 자동 생성
  문제:
  - [x] 사용자 입력 형식 편차, 중복, 오타 위험 제거
  - [x] 현장 등록 시 자동으로 다음 번호가 붙도록 구조 변경 완료
  권장:
  - [x] 서버에서 마지막 현장 코드를 기준으로 다음 코드 자동 생성
  - [x] 현재 형식: `PMIS-SITE-001`, `PMIS-SITE-002`, `PMIS-SITE-003`
  - [x] 프론트 입력칸은 읽기전용 미리보기로 변경
  우선순위: 최상, 완료

- [ ] **1-2. 설계변경 번호 (`changeNo`)**
  현재 위치:
  - [ ] `src/app/(main)/design-docs/design/changes/page.tsx`
  - [ ] `src/app/api/design/changes/route.ts`
  현재 상태:
  - [ ] 변경번호 직접 입력 필수
  문제:
  - [ ] 현장 내 연속성 보장이 없음
  - [ ] 검색/정렬 기준번호인데 사용자 입력 의존도가 높음
  권장:
  - [ ] 현장 기준 자동 채번
  - [ ] 예시: `CHG-0001` 또는 `CHG-20260307-0001`
  - [ ] 수정 화면에서는 번호 변경 제한 권장
  우선순위: 높음

- [ ] **1-3. 정렬 순번 (`sortOrder`) 계열**
  현재 위치:
  - [ ] `src/components/features/code-items-manager.tsx`
  - [ ] `src/app/(main)/design-docs/documents/categories/page.tsx`
  - [ ] `src/app/(main)/design-docs/documents/system/page.tsx`
  - [ ] `src/app/api/design/assets/route.ts`
  - [ ] `src/app/api/progress/schedule/route.ts`
  현재 상태:
  - [ ] 대부분 기본값 `0`
  - [ ] 사용자가 직접 숫자를 넣어야 함
  문제:
  - [ ] 신규 데이터가 계속 `0`으로 쌓일 수 있음
  - [ ] 목록 정렬이 등록 순서와 어긋남
  권장:
  - [ ] 생성 시 같은 그룹/같은 부모 기준 `max(sortOrder) + 1` 자동 적용
  - [ ] 수정 화면에서는 필요 시만 수동 조정
  우선 적용 대상:
  - [ ] 시스템 코드 `sortOrder`
  - [ ] 문서 분류 `sortOrder`
  - [ ] Document System `sortOrder`
  - [ ] 설계 자료 트리 노드 `sortOrder`
  - [ ] 공정표 `sortOrder`
  우선순위: 높음

## 2. 이미 자동이지만 방식 보완이 필요한 항목

- [ ] **2-1. 지원 티켓 번호 (`ticketNo`)**
  현재 위치:
  - [ ] `src/app/api/system/support/tickets/route.ts`
  현재 상태:
  - [ ] 이미 자동 생성
  - [ ] 형식: `SUP-YYYYMMDD-0001`
  - [ ] 날짜별 `count + 1` 방식
  판단:
  - [ ] 방향은 맞음
  - [ ] 다만 동시 등록이 많아지면 같은 번호가 겹칠 가능성 있음
  권장:
  - [ ] 카운터 컬렉션 또는 원자적 증가 방식으로 변경 검토
  우선순위: 중간

- [ ] **2-2. 문서번호 (`docNo`)**
  현재 위치:
  - [ ] `src/app/api/documents/route.ts`
  - [ ] `src/app/(main)/design-docs/documents/wizard/[step]/page.tsx`
  현재 상태:
  - [ ] 입력값이 비어 있으면 자동 생성
  - [ ] 형식: `DOC-YYYYMMDD-랜덤4자리`
  판단:
  - [ ] 자동생성 자체는 이미 동작함
  - [ ] 다만 질문처럼 `1씩 증가`하는 번호 체계는 아님
  권장:
  - [ ] 문서번호도 연속 번호가 필요하면 `siteId + 날짜 + 순번` 기반으로 변경
  - [ ] 예시: `DOC-20260307-0001`
  우선순위: 중간

- [ ] **2-3. 설계 자료 노드 코드 (`nodeCode`)**
  현재 위치:
  - [ ] `src/app/api/design/assets/route.ts`
  - [ ] `src/app/(main)/design-docs/design/assets/page.tsx`
  현재 상태:
  - [ ] 미입력 시 `NODE-${Date.now()}` 자동 생성
  판단:
  - [ ] 자동생성은 이미 있음
  - [ ] 다만 사람이 읽기 좋은 연속 코드나 계층 코드라고 보기 어려움
  권장:
  - [ ] 필요하면 부모 노드 기준 연속값 또는 계층형 코드로 변경
  - [ ] 예시: `NODE-001`, `NODE-001-001`
  우선순위: 중간

## 3. 자동 증가보다 자동 연결이 맞는 항목

- [ ] **3-1. 도면검토의 문서번호 / 도면번호 (`docNo`, `drawingNo`)**
  현재 위치:
  - [ ] `src/app/(main)/design-docs/design/reviews/page.tsx`
  - [ ] `src/app/api/drawing-reviews/route.ts`
  현재 상태:
  - [ ] 간편 등록에서도 문서번호와 도면번호를 직접 입력
  판단:
  - [ ] 여기서는 새 번호를 발급하는 것보다 기존 문서/도면을 선택해서 자동 채우는 방식이 맞음
  권장:
  - [ ] 문서 선택 시 `docNo` 자동 세팅
  - [ ] 도면 선택 시 `drawingNo`, `drawingName` 자동 세팅
  - [ ] 즉, "자동 증가"가 아니라 "자동 참조"
  우선순위: 높음

- [ ] **3-2. 도면번호 (`drawingNo`)**
  현재 위치:
  - [ ] `src/app/(main)/design-docs/design/drawings/page.tsx`
  - [ ] `src/app/api/drawings/route.ts`
  현재 상태:
  - [ ] 직접 입력 필수
  판단:
  - [ ] 도면번호는 외부 설계사/도면 표준번호를 따라갈 가능성이 높아서 단순 `+1` 자동증가는 위험함
  권장:
  - [ ] 무조건 자동 채번하지 말고 외부 기준번호 유지
  - [ ] 대신 도면 등록을 기존 기준서/템플릿과 연결해 자동 추천하는 수준이 적절
  우선순위: 낮음

- [ ] **3-3. 공정표 작업코드 (`taskCode`)**
  현재 위치:
  - [ ] `src/app/(main)/progress/master-schedule/page.tsx`
  - [ ] `src/app/api/progress/schedule/route.ts`
  현재 상태:
  - [ ] 직접 입력 필수
  판단:
  - [ ] WBS/ERP/현장 표준코드가 따로 있으면 임의 자동증가가 오히려 혼선
  권장:
  - [ ] 표준이 없다면 자동 생성 가능
  - [ ] 표준이 있으면 템플릿 선택 또는 코드 추천만 제공
  우선순위: 낮음

## 4. 구현 우선순위 제안

- [x] `siteCode` 서버 자동 채번
- [ ] `changeNo` 서버 자동 채번
- [ ] 각 관리 화면의 `sortOrder` 기본값을 `max + 1`로 변경
- [ ] 도면검토 화면을 번호 직접 입력 방식에서 문서/도면 선택 방식으로 변경
- [ ] `docNo`, `ticketNo`, `nodeCode`는 현재 자동 방식 유지 후 필요 시 고도화
려
## 5. 인허가 신고 상수 후보 정리

- [ ] **5-1. 인허가 신고 유형 상수 (`reportType`)**
  현재 위치:
  - [ ] `src/app/(main)/quality-safety/safety/management/setup/page.tsx`
  - [ ] `src/app/api/safety/management/setup/route.ts`
  - [ ] `src/models/GovernmentReport.ts`
  판단:
  - [ ] `유형`은 자유입력보다 고정값 `select`가 맞음
  - [ ] 법규 원문 전체를 다 담기보다, 착수 준비 단계에서 반복되는 신고/허가 업무 중심으로 최소 세트 구성 권장
  1차 권장 목록:
  - [ ] `착공신고`
  - [ ] `도로점용허가`
  - [ ] `굴착허가`
  - [ ] `비산먼지 발생사업 신고`
  - [ ] `특정공사 사전신고`
  - [ ] `유해위험방지계획서 제출`
  - [ ] `안전관리계획서 제출`
  - [ ] `건설폐기물 배출자 신고`
  - [ ] `가설건축물 축조신고`
  - [ ] `기타`

- [ ] **5-2. 인허가 신고 기관 상수 (`agency`)**
  현재 위치:
  - [ ] `src/app/(main)/quality-safety/safety/management/setup/page.tsx`
  - [ ] `src/app/api/safety/management/setup/route.ts`
  - [ ] `src/models/GovernmentReport.ts`
  판단:
  - [ ] `기관`은 정확한 실기관명까지 고정하기보다 대표 기관 분류 수준으로 시작하는 편이 안전함
  - [ ] 현장/지역에 따라 세부 기관명이 달라질 수 있으므로, 상수는 1차 분류용으로만 두는 것이 적절함
  1차 권장 목록:
  - [ ] `관할 시청/구청`
  - [ ] `고용노동부`
  - [ ] `한국산업안전보건공단`
  - [ ] `관할 소방서`
  - [ ] `관할 경찰서`
  - [ ] `도로관리청`
  - [ ] `환경청/환경과`
  - [ ] `발주처`
  - [ ] `기타`

- [ ] **5-3. 상수로 갈 범위 / DB가 필요한 범위**
  판단:
  - [ ] `reportType`은 상수만으로 시작 가능
  - [ ] `agency`도 대표 기관명 수준이면 상수로 시작 가능
  - [ ] 다만 `강남구청`, `서울중부고용노동지청`, `OO도로사업소`처럼 정확한 관할 기관명까지 관리하려면 DB 또는 공통 코드관리 필요
  권장:
  - [ ] 1차는 `src/lib/government-report-constants.ts` 같은 공용 상수로 구현
  - [ ] 화면은 `select`, API는 허용값 검증 추가
  - [ ] 실제 현장 운영 중 기관명이 자주 추가되면 그때 코드관리/DB 마스터로 승격
