# QC 모델 설계 메모

## 1. 설계 목적

- QC 모듈 전 화면이 같은 데이터 규칙으로 움직이도록 공통 모델 기준을 정의한다.
- `ITP -> 검사 -> 시험 -> NCR -> 인수·준공 -> 대시보드` 흐름을 같은 사이트 기준으로 연결한다.
- 이후 화면 구현 시 스키마 재설계 없이 참조 관계만 재사용할 수 있도록 핵심 필드와 관계를 고정한다.

## 2. 공통 설계 원칙

- 모든 QC 모델은 `siteId`를 기준으로 현장 데이터를 분리한다.
- 모든 QC 모델은 `baseFieldsPlugin`을 사용해 `createdBy`, `updatedBy`, `isDeleted`, `deletedAt`, `softDelete`를 공통으로 가진다.
- 첨부는 `fileAssetId`, `fileName`, `category`, `sortOrder` 구조를 따른다.
- 조회 권한은 `viewer`, 변경 권한은 `manager`로 통일한다.
- 변경 API는 생성/수정/삭제 시 감사 로그를 남긴다.

## 3. 사이트 공통 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `siteId` | `ObjectId` | 모든 QC 데이터의 현장 기준 키 |
| `createdBy` | `ObjectId` | 생성자 |
| `updatedBy` | `ObjectId` | 최종 수정자 |
| `createdAt` | `Date` | 생성일시 |
| `updatedAt` | `Date` | 수정일시 |
| `isDeleted` | `boolean` | 소프트 삭제 여부 |
| `deletedAt` | `Date \| null` | 삭제 시각 |

## 4. 모델 목록

### 4.1 `QcInspectionTestPlan`

- 역할: 현장별 ITP 버전 관리
- 핵심 필드: `year`, `versionNo`, `status`, `planTitle`, `workType`, `processStep`, `checkpoints`
- 하위 구조: checkpoint 배열 안에 `checkpointId`, `checkpointTitle`, `holdPoint`, `acceptanceCriteria`, `ownerName` 저장

### 4.2 `MaterialInspection`

- 역할: 반입 자재 검사 기록
- 핵심 필드: `materialCategory`, `materialName`, `specification`, `supplier`, `lotNo`, `inspectionDate`, `result`, `disposition`
- ITP 참조: `linkedItpPlanId`, `linkedItpPlanTitle`, `linkedItpCheckpointId`, `linkedItpCheckpointTitle`
- 후속 연계: `ncrStatus`, `ncrReference`

### 4.3 `QcProcessInspection`

- 역할: 공정 단계별 검사 및 시정조치 추적
- 핵심 필드: `workType`, `location`, `processStep`, `plannedInspectionDate`, `status`, `result`
- ITP 참조: `linkedItpPlanId`, `linkedItpPlanTitle`, `linkedItpCheckpointId`, `linkedItpCheckpointTitle`
- 후속 연계: `correctiveActionStatus`, `issueStatus`, `issueReference`

### 4.4 `QcTestReport`

- 역할: 시험 성적서 및 기준치 판정 관리
- 핵심 필드: `testType`, `sourceType`, `sampleName`, `samplingDate`, `testDate`, `standardValue`, `measuredValue`, `result`
- 참조 필드: `linkedMaterialInspectionId`, `linkedProcessInspectionId`
- 후속 연계: `ncrStatus`, `ncrReference`

### 4.5 `QcNonconformance`

- 역할: 부적합 등록, 원인분석, 조치, 검증
- 핵심 필드: `ncrNo`, `occurrenceType`, `sourceType`, `severity`, `status`, `dueDate`
- 참조 필드: `linkedMaterialInspectionId`, `linkedProcessInspectionId`, `linkedTestReportId`
- 후속 연계: 인수·준공 검사에서 `linkedNcrId`, `linkedNcrNo`로 참조

### 4.6 `QcHandoverInspection`

- 역할: 인수 및 준공 검사
- 핵심 필드: `inspectionNo`, `inspectionType`, `inspectionTitle`, `workType`, `plannedInspectionDate`, `status`, `result`
- 참조 필드: `linkedProcessInspectionId`, `linkedNcrId`, `linkedNcrNo`
- 운영 포인트: `openFindingCount`, `approvalStatus`

## 5. 의존 관계 정리

### 5.1 ITP에서 검사로

- `QcInspectionTestPlan`은 `MaterialInspection`, `QcProcessInspection`에서 직접 참조된다.
- 자재/공정 검사 등록 시 ITP 체크포인트를 연결해 기준과 허용값의 출처를 남긴다.

### 5.2 검사에서 시험/NCR로

- `QcTestReport`는 자재 검사 또는 공정 검사 결과를 참조할 수 있다.
- `QcNonconformance`는 자재 검사, 공정 검사, 시험 성적서 중 하나 이상을 원인 데이터로 연결할 수 있다.

### 5.3 NCR에서 인수·준공으로

- `QcHandoverInspection`은 공정 검사와 NCR을 함께 참조할 수 있다.
- 인수·준공 검사에서 미조치 finding과 NCR 상태를 같이 봄으로써 운영 리스크를 한 화면에서 확인한다.

### 5.4 운영 집계

- `qc-ops-summary`는 자재 검사, 공정 검사, 시험 성적서, NCR, 인수·준공 검사 데이터를 함께 읽어 대시보드와 알림을 만든다.
- 따라서 `품질 대시보드`는 앞 단계에서 생성된 QC 데이터의 최종 집계 계층이다.

## 6. 결론

- QC 모델 목록, 사이트 공통 필드, 참조 관계는 현재 구현 코드 기준으로 확정 가능한 상태다.
- 이후 QC 화면 확장은 기존 모델 재사용과 옵션/API 확장 중심으로 진행하면 된다.
