# QA 권한 및 감사 로그 점검

## 점검 목적

- QA 모듈 API의 조회/변경 권한이 일관되게 적용되는지 확인한다.
- 등록/수정/삭제 시 감사 로그 기록이 누락되지 않았는지 확인한다.

## 권한 점검 결과

| 영역 | 조회 권한 | 변경 권한 | 비고 |
|------|----------|----------|------|
| 품질 정책·목표 | `viewer` | `manager` | 목록/상세 조회와 등록/수정/삭제 분리 적용 |
| 품질보증계획 | `viewer` | `manager` | 버전 변경도 `manager` 이상 |
| 표준 절차·템플릿 | `viewer` | `manager` | 첨부/링크 정보 포함 |
| 내부 심사 | `viewer` | `manager` | 심사 결과 입력 포함 |
| CAPA | `viewer` | `manager` | 상태 전이 포함 |
| 협력사 품질보증 | `viewer` | `manager` | 평가 등록/후속조치 포함 |
| 품질 KPI | `viewer` | `manager` | 요약/옵션 API는 조회 권한, 정의 변경은 `manager` 이상 |

## 감사 로그 점검 결과

- `policy-goals`, `assurance-plans`, `procedures`, `audits`, `capa`, `partner-assurance`, `kpi`의 생성 API는 모두 `logCreate`를 호출한다.
- 각 상세 라우트의 수정 API는 모두 `logUpdate`를 호출한다.
- 각 상세 라우트의 삭제 API는 모두 `logDelete`를 호출한다.
- KPI `summary`, `options`와 같은 조회 전용 API는 감사 로그 대상이 아니다.

## 결론

- QA API 권한은 `조회=viewer`, `변경=manager` 패턴으로 정리되어 있다.
- QA 주요 변경 흐름의 감사 로그 누락은 현재 코드 기준으로 확인되지 않았다.
