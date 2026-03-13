# QC 권한 및 감사 로그 점검

## 점검 목적

- QC 모듈 API의 조회/변경 권한이 일관되게 적용되는지 확인한다.
- 등록/수정/삭제 시 감사 로그 기록이 누락되지 않았는지 확인한다.

## 권한 점검 결과

| 영역 | 조회 권한 | 변경 권한 | 비고 |
|------|----------|----------|------|
| 검사·시험 계획 (ITP) | `viewer` | `manager` | 목록/상세/옵션 조회와 등록/수정/삭제 분리 적용 |
| 자재 검사 | `viewer` | `manager` | 첨부, 보류/반출, NCR 연계 포함 |
| 공정 검사 | `viewer` | `manager` | 시정조치 요청/완료 흐름 포함 |
| 시험 성적서 | `viewer` | `manager` | 판정 계산 및 승인 상태 변경 포함 |
| NCR | `viewer` | `manager` | 상태 전이, 검증, 리마인드 기록 포함 |
| 인수·준공 검사 | `viewer` | `manager` | 보완 요청, 승인 요청 흐름 포함 |
| 품질 대시보드 | `viewer` | 변경 없음 | 요약 집계 API만 제공 |

## 감사 로그 점검 결과

- `itp`, `material-inspections`, `process-inspections`, `test-reports`, `nonconformance`, `handover-inspections`의 생성 API는 모두 `logCreate`를 호출한다.
- 각 상세 라우트의 수정 API는 모두 `logUpdate`를 호출한다.
- 각 상세 라우트의 삭제 API는 모두 `logDelete`를 호출한다.
- `quality-dashboard/summary`, `options`와 같은 조회 전용 API는 감사 로그 대상이 아니다.

## 결론

- QC API 권한은 `조회=viewer`, `변경=manager` 패턴으로 정리되어 있다.
- QC 주요 변경 흐름의 감사 로그 누락은 현재 코드 기준으로 확인되지 않았다.
