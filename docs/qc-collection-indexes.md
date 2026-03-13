# QC 컬렉션 및 인덱스 정의

## 1. 개요

- QC 데이터는 모두 현장 기준으로 분리되며, 대부분의 조회 인덱스는 `siteId`를 선두 컬럼으로 사용한다.
- 고유 번호가 필요한 NCR과 인수·준공 검사는 현장 단위 unique 인덱스를 가진다.

## 2. 컬렉션 목록

| 모델 | 컬렉션 | 용도 |
|------|------|------|
| `QcInspectionTestPlan` | `qc_inspection_test_plans` | ITP 버전 관리 |
| `MaterialInspection` | `material_inspections` | 자재 반입 검사 |
| `QcProcessInspection` | `qc_process_inspections` | 공정 검사 |
| `QcTestReport` | `qc_test_reports` | 시험 성적서 |
| `QcNonconformance` | `qc_nonconformances` | NCR |
| `QcHandoverInspection` | `qc_handover_inspections` | 인수·준공 검사 |

## 3. 인덱스 정의

### 3.1 `qc_inspection_test_plans`

- `{ siteId: 1, year: -1, versionNo: -1, createdAt: -1 }`
- `{ siteId: 1, status: 1, year: -1 }`
- `{ siteId: 1, workType: 1, updatedAt: -1 }`

### 3.2 `material_inspections`

- `{ siteId: 1, inspectionDate: -1 }`
- `{ siteId: 1, result: 1, inspectionDate: -1 }`
- `{ siteId: 1, disposition: 1, inspectionDate: -1 }`
- `{ siteId: 1, materialCategory: 1, supplier: 1 }`
- `{ siteId: 1, materialName: 1, supplier: 1 }`
- `{ siteId: 1, linkedItpPlanId: 1, inspectionDate: -1 }`

### 3.3 `qc_process_inspections`

- `{ siteId: 1, plannedInspectionDate: -1 }`
- `{ siteId: 1, status: 1, plannedInspectionDate: -1 }`
- `{ siteId: 1, correctiveActionStatus: 1, plannedInspectionDate: -1 }`
- `{ siteId: 1, workType: 1, location: 1, plannedInspectionDate: -1 }`
- `{ siteId: 1, linkedItpPlanId: 1, plannedInspectionDate: -1 }`

### 3.4 `qc_test_reports`

- `{ siteId: 1, testDate: -1 }`
- `{ siteId: 1, status: 1, testDate: -1 }`
- `{ siteId: 1, result: 1, testDate: -1 }`
- `{ siteId: 1, sourceType: 1, testDate: -1 }`
- `{ siteId: 1, linkedMaterialInspectionId: 1, testDate: -1 }`
- `{ siteId: 1, linkedProcessInspectionId: 1, testDate: -1 }`

### 3.5 `qc_nonconformances`

- `unique { siteId: 1, ncrNo: 1 }`
- `{ siteId: 1, status: 1, dueDate: 1 }`
- `{ siteId: 1, severityRank: -1, dueDate: 1 }`
- `{ siteId: 1, sourceType: 1, occurrenceDate: -1 }`
- `{ siteId: 1, linkedMaterialInspectionId: 1 }`
- `{ siteId: 1, linkedProcessInspectionId: 1 }`
- `{ siteId: 1, linkedTestReportId: 1 }`

### 3.6 `qc_handover_inspections`

- `unique { siteId: 1, inspectionNo: 1 }`
- `{ siteId: 1, inspectionType: 1, plannedInspectionDate: -1 }`
- `{ siteId: 1, status: 1, plannedInspectionDate: -1 }`
- `{ siteId: 1, approvalStatus: 1, plannedInspectionDate: -1 }`
- `{ siteId: 1, openFindingCount: -1, plannedInspectionDate: -1 }`
- `{ siteId: 1, linkedProcessInspectionId: 1 }`
- `{ siteId: 1, linkedNcrId: 1 }`

## 4. 설계 판단

- `siteId` 선두 인덱스로 현장 전환 시 조회 범위를 빠르게 좁힌다.
- 검사/시험/NCR/인수검사의 참조 필드에도 인덱스를 둬 연결 조회 비용을 줄인다.
- 번호 기반 업무 문서는 현장 단위 unique 인덱스로 운영 충돌을 방지한다.

## 5. 결론

- QC 컬렉션과 인덱스 정의는 현재 스키마 기준으로 문서화 가능한 수준까지 정리되었다.
- 이후 추가 모델이 생겨도 `siteId` 선두 인덱스와 참조 필드 인덱스 패턴을 유지하면 된다.
