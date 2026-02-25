# PMIS 장애 대응 Runbook

## 목차

1. [배포 절차](#1-배포-절차)
2. [롤백 절차](#2-롤백-절차)
3. [장애 대응](#3-장애-대응)
4. [모니터링](#4-모니터링)
5. [점검 절차](#5-점검-절차)

---

## 1. 배포 절차

### 1.1 빌드

```bash
# 의존성 설치
npm install

# 프로덕션 빌드
npm run build
```

빌드 결과물은 `.next/` 디렉토리에 생성된다.

### 1.2 실행

```bash
# 프로덕션 서버 실행 (기본 포트 3070)
npm start

# 개발 서버 실행 (핫리로드)
npm run dev
```

### 1.3 환경 변수 설정

`.env.local` 파일에 다음 항목을 설정한다.

| 변수 | 필수 | 설명 | 예시 |
|------|------|------|------|
| `MONGODB_URI` | O | MongoDB Atlas 연결 문자열 | `mongodb+srv://user:pass@cluster.mongodb.net/pmis?retryWrites=true&w=majority` |
| `NEXTAUTH_SECRET` | O | NextAuth JWT 암호화 키 (랜덤 문자열) | `openssl rand -base64 32` 로 생성 |
| `NEXTAUTH_URL` | O | 서비스 기본 URL | `https://pmis.example.com` |
| `AUTH_GOOGLE_ID` | O* | Google OAuth 클라이언트 ID (권장 키) | Google Cloud Console에서 발급 |
| `AUTH_GOOGLE_SECRET` | O* | Google OAuth 클라이언트 시크릿 (권장 키) | Google Cloud Console에서 발급 |
| `GOOGLE_CLIENT_ID` | O* | Google OAuth 클라이언트 ID (대체 키) | Google Cloud Console에서 발급 |
| `GOOGLE_CLIENT_SECRET` | O* | Google OAuth 클라이언트 시크릿 (대체 키) | Google Cloud Console에서 발급 |
| `PMIS_REQUIRE_LOGIN` | - | 로그인 필수 여부 (`true`/`false`) | 프로덕션은 `true`, 개발은 `false` |
| `S3_ENDPOINT` | - | S3 호환 스토리지 엔드포인트 (추후) | - |
| `S3_ACCESS_KEY` | - | S3 접근 키 (추후) | - |
| `S3_SECRET_KEY` | - | S3 비밀 키 (추후) | - |
| `S3_BUCKET` | - | S3 버킷명 (추후) | - |

**주의사항**:
- `NEXTAUTH_SECRET`는 프로덕션에서 반드시 안전한 랜덤 값으로 설정한다. `your-secret-key-here` 같은 기본값을 사용하지 않는다.
- Google OAuth 키는 `AUTH_GOOGLE_*` 또는 `GOOGLE_CLIENT_*` 중 한 쌍이 반드시 필요하다. (권장: `AUTH_GOOGLE_*`)
- `PMIS_REQUIRE_LOGIN`을 `false`로 설정하면 인증 없이 시스템에 접근 가능하므로, 프로덕션 환경에서는 반드시 `true`로 설정한다.
- `.env.local` 파일은 절대 git에 커밋하지 않는다.

### 1.4 MongoDB Atlas 연결 설정

1. MongoDB Atlas 콘솔에서 클러스터를 생성한다.
2. Database Access에서 사용자를 생성한다 (readWrite 권한).
3. Network Access에서 접속 IP를 허용한다 (서비스 서버 IP 또는 `0.0.0.0/0`).
4. 클러스터의 Connect 메뉴에서 연결 문자열을 복사한다.
5. `.env.local`의 `MONGODB_URI`에 연결 문자열을 설정한다.
6. 연결 문자열에 데이터베이스명(`pmis`)이 포함되어 있는지 확인한다.

**연결 문자열 형식**:
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/pmis?retryWrites=true&w=majority&appName=<appName>
```

### 1.5 초기 데이터 적재

- 운영 전환 브랜치에서는 더미/시드 주입 스크립트를 사용하지 않는다.
- 초기 데이터는 관리자 기능으로 직접 등록한다.
  - 필수: 현장 1건 이상
  - 권장: 관리자/권한, 코드 마스터 기본값

---

## 2. 롤백 절차

### 2.1 Git 기반 롤백

```bash
# 현재 배포 커밋 확인
git log --oneline -5

# 이전 안정 버전으로 되돌리기
git checkout <안정_커밋_해시>

# 빌드 및 재시작
npm run build && npm start
```

**프로세스 매니저(PM2 등) 사용 시**:
```bash
git checkout <안정_커밋_해시>
npm run build
pm2 restart pmis
```

**롤백 후 확인사항**:
1. 서버가 정상 기동되었는지 확인 (헬스체크 또는 대시보드 접속)
2. MongoDB 연결이 정상인지 확인
3. 주요 API 응답 정상 여부 확인

### 2.2 DB 롤백 고려사항

MongoDB는 트랜잭션 기반 롤백이 제한적이므로 다음을 고려한다.

**스키마 변경이 포함된 배포의 경우**:
- 배포 전 MongoDB Atlas에서 백업 스냅샷을 생성한다.
- 롤백 필요 시 Atlas 콘솔에서 스냅샷 복원을 수행한다.
- 복원 시 복원 시점 이후의 데이터 유실에 주의한다.

**데이터 마이그레이션이 포함된 경우**:
- 마이그레이션 스크립트에 역방향(rollback) 로직을 반드시 작성한다.
- 마이그레이션 전 컬렉션 단위 `mongoexport`로 백업한다.

```bash
# 컬렉션 백업 예시
mongoexport --uri="$MONGODB_URI" --collection=documents --out=backup_documents.json

# 복원 예시
mongoimport --uri="$MONGODB_URI" --collection=documents --drop --file=backup_documents.json
```

**인덱스 변경이 포함된 경우**:
- 인덱스 추가는 비교적 안전하나, 인덱스 삭제 후 롤백 시 재생성이 필요하다.
- 대용량 컬렉션의 인덱스 재생성은 시간이 소요되므로 피크 시간을 피한다.

---

## 3. 장애 대응

### 3.1 MongoDB 연결 실패

**증상**: API 호출 시 500 에러, 서버 로그에 `MongooseServerSelectionError` 또는 `MONGODB_URI 환경변수를 설정해주세요` 메시지

**진단**:
```bash
# 환경 변수 확인
echo $MONGODB_URI

# MongoDB Atlas 콘솔에서 확인
# - 클러스터 상태: Active 여부
# - Network Access: 현재 서버 IP가 허용 목록에 있는지
# - Database Users: 계정 비밀번호가 올바른지
```

**조치**:
1. `.env.local`에 `MONGODB_URI`가 올바르게 설정되어 있는지 확인한다.
2. MongoDB Atlas Network Access에서 서버 IP가 허용되어 있는지 확인한다.
3. Atlas 클러스터가 정상 동작 중인지 확인한다 (Atlas 콘솔의 Cluster 상태).
4. DB 사용자 비밀번호에 특수문자가 있다면 URL 인코딩 되었는지 확인한다.
5. DNS 해석이 가능한지 확인한다 (`nslookup <cluster>.mongodb.net`).
6. 연결 문자열의 `retryWrites=true` 옵션이 포함되어 있는지 확인한다.
7. 문제가 지속되면 서버를 재시작한다 (`npm start` 또는 `pm2 restart pmis`).

### 3.2 API 서버 무응답

**증상**: 브라우저에서 페이지 로딩 안 됨, API 호출 타임아웃

**진단**:
```bash
# 프로세스 확인
ps aux | grep node

# 포트 점유 확인
lsof -i :3070

# 서버 로그 확인
# PM2 사용 시
pm2 logs pmis --lines 100
```

**조치**:
1. Node.js 프로세스가 살아 있는지 확인한다.
2. 프로세스가 없다면 재시작한다.
   ```bash
   npm start
   # 또는
   pm2 restart pmis
   ```
3. 포트 충돌이 있다면 기존 프로세스를 종료한다.
   ```bash
   kill -9 $(lsof -t -i:3070)
   npm start
   ```
4. 서버 로그에서 에러 원인을 파악한다.
5. OOM(메모리 부족)으로 프로세스가 종료된 경우 메모리 할당량을 늘린다.
   ```bash
   NODE_OPTIONS="--max-old-space-size=2048" npm start
   ```

### 3.3 파일 업로드 실패

**증상**: 파일 첨부 시 에러 메시지 표시, API 응답 400 또는 500

**진단**:
- API 에러 메시지 확인: `파일이 필요합니다.` / `유효한 siteId를 찾을 수 없습니다.`
- 서버 디스크 용량 확인: `df -h`
- 업로드 디렉토리 권한 확인: `ls -la public/uploads/`

**조치**:

| 원인 | 조치 |
|------|------|
| 파일 미첨부 | 클라이언트에서 FormData에 `file` 필드가 포함되었는지 확인 |
| siteId 없음 | 현장이 하나 이상 존재하는지 확인. 없다면 관리자 기능으로 최초 현장을 등록 |
| 디스크 부족 | `public/uploads/` 하위 오래된 파일 정리 또는 디스크 증설 |
| 권한 오류 | `chmod -R 755 public/uploads/` 실행 |
| 파일 크기 초과 | Next.js의 body size limit 설정 확인 (`next.config.js`) |

### 3.4 외부 연계 실패

#### 도면 열람 시스템 연계 실패

**증상**: `/design-docs/design/drawing-viewer`에서 외부 열람 링크가 열리지 않거나 잘못된 URL로 이동

**조치**:
1. 외부 링크 설정 API 확인: `GET /api/system/external-links?category=general`
2. `name="도면 열람 시스템"` 항목의 `url` 값이 정확한지 확인한다.
3. 대상 URL이 사내망/방화벽 정책에 의해 차단되지 않았는지 확인한다.
4. 브라우저 팝업 차단 여부를 확인한다. (새 창 열기 기능)
5. 필요 시 관리자 화면에서 외부 링크 항목을 수정한 뒤 재시도한다.

#### Open-Meteo (기상정보) 연동 실패

**증상**: 날씨 정보가 표시되지 않음, 기상 데이터 누락

**조치**:
1. Open-Meteo API 상태 확인: `curl https://api.open-meteo.com/v1/forecast?latitude=37.5&longitude=127.0&daily=temperature_2m_max`
2. 현장 주소(`Site.address`)가 비어있지 않고 지오코딩 가능한 형식인지 확인한다.
3. 실패 건 재처리: `/api/integrations/open-meteo/retry-failed` 호출.
4. Open-Meteo는 무료 API이므로 Rate Limit(분당 요청 수)에 걸릴 수 있다. 잠시 대기 후 재시도한다.
5. `WeatherSnapshot` 컬렉션에서 최근 데이터 존재 여부를 확인한다.

### 3.5 메모리/CPU 과부하

**증상**: 응답 지연, 서버 무응답, OOM 에러

**진단**:
```bash
# 시스템 리소스 확인
top -l 1 | head -20

# Node.js 프로세스 메모리 확인
ps aux | grep node | grep -v grep

# PM2 사용 시
pm2 monit
```

**조치**:
1. **즉시 조치**: 서버 재시작으로 메모리 확보
   ```bash
   pm2 restart pmis
   ```
2. **메모리 누수 의심 시**:
   - `NODE_OPTIONS="--max-old-space-size=2048"` 설정으로 힙 메모리 상한 증가
   - 장시간 운용 후 메모리가 지속적으로 증가하면 메모리 누수 조사 필요
3. **CPU 과부하 시**:
   - MongoDB 쿼리가 인덱스를 활용하고 있는지 확인 (`phase6:*` 스크립트 사용 가능 시 `npm run phase6:team1:index`)
   - 대량 데이터 조회 시 pagination이 적용되어 있는지 확인
   - 동시 접속자가 많은 경우 인스턴스 스케일링 고려
4. **MongoDB 부하 시**:
   - Atlas 콘솔에서 Performance Advisor 확인
   - 느린 쿼리 확인 및 인덱스 추가
   - Atlas 클러스터 티어 업그레이드 고려

---

## 4. 모니터링

### 4.1 감사 로그 모니터링

감사 로그를 주기적으로 확인하여 비정상 활동을 탐지한다.

```bash
# 최근 감사 로그 조회 (site_admin 권한 필요)
curl -s "https://pmis.example.com/api/audit-logs?limit=20" \
  -H "Cookie: next-auth.session-token=<token>" | jq .

# 특정 기간 삭제 이력 조회
curl -s "https://pmis.example.com/api/audit-logs?action=document_deleted&dateFrom=2026-02-01&dateTo=2026-02-24" \
  -H "Cookie: next-auth.session-token=<token>" | jq .
```

**감시 포인트**:
- 비업무 시간대의 데이터 삭제(`*_deleted`) 이력
- 짧은 시간 내 대량의 생성/수정 이력 (자동화 공격 의심)
- 알 수 없는 사용자(`actorName`)의 활동
- 상태 변경(`*_status_changed`)의 비정상 패턴

### 4.2 API 응답 시간 모니터링

**수동 확인**:
```bash
# 주요 API 응답 시간 측정
time curl -s -o /dev/null -w "%{http_code} %{time_total}s" \
  "https://pmis.example.com/api/dashboard/summary"

# 통합검색 성능 확인
time curl -s -o /dev/null -w "%{http_code} %{time_total}s" \
  "https://pmis.example.com/api/search/unified?q=test"
```

**정상 기준치**:
| API | 응답 시간 기준 | 비고 |
|-----|---------------|------|
| `/api/dashboard/summary` | < 500ms | 5개 컬렉션 동시 조회 |
| `/api/search/unified` | < 1000ms | 4개 컬렉션 병렬 검색 |
| `/api/documents` | < 300ms | 페이지네이션 적용 |
| `/api/audit-logs` | < 300ms | 페이지네이션 적용 |
| `/api/files/upload` | < 5000ms | 파일 크기에 따라 다름 |

**기준 초과 시 조치**:
1. MongoDB Atlas Performance Advisor에서 느린 쿼리 확인
2. `phase6:*` 스크립트가 사용 가능하면 `npm run phase6:team1:index`로 인덱스 상태 점검
3. `phase6:*` 스크립트가 사용 가능하면 `npm run phase6:team1:perf`로 성능 점검 실행

### 4.3 에러 로그 확인

**서버 로그 확인**:
```bash
# 직접 실행 시
# stdout/stderr에 출력되는 로그를 확인한다.

# PM2 사용 시
pm2 logs pmis --err --lines 200

# 감사 로그 기록 실패 확인
pm2 logs pmis --lines 500 | grep "\[audit-logger\]"
```

**주요 에러 패턴**:

| 로그 패턴 | 의미 | 조치 |
|----------|------|------|
| `[audit-logger] Failed to write audit log` | 감사 로그 기록 실패 | MongoDB 연결 상태 확인 |
| `MongooseServerSelectionError` | MongoDB 연결 불가 | 3.1절 참고 |
| `CSRF_BLOCKED` | CSRF 공격 차단 | 정상 동작이나, 반복 시 공격 시도 의심 |
| `VALIDATION_ERROR` | 입력값 검증 실패 | 클라이언트 요청 데이터 확인 |
| `UNAUTHORIZED` / `FORBIDDEN` | 인증/인가 실패 | 사용자 세션 및 권한 확인 |
| `JavaScript heap out of memory` | OOM | 3.5절 참고 |

---

## 5. 점검 절차

### 5.1 자동 점검 스크립트 상태 확인

`package.json`에는 `phase6:*` 점검 스크립트가 정의되어 있으나, 현재 저장소에는 `scripts/` 디렉토리가 없을 수 있다.

```bash
test -d scripts && echo "scripts present" || echo "scripts missing"
```

- `scripts present`: 자동 점검 스크립트 실행
- `scripts missing`: 아래 수동 점검 절차로 대체

### 5.2 수동 스모크 테스트

```bash
# 앱 기동 확인
curl -I http://localhost:3070

# 인증/사용자 컨텍스트
curl -s http://localhost:3070/api/me | jq .

# 대시보드 요약
curl -s http://localhost:3070/api/dashboard/summary | jq .

# 통합검색
curl -s "http://localhost:3070/api/search/unified?q=test" | jq .

# 날씨 연동
curl -s "http://localhost:3070/api/progress/weather?days=3" | jq .
```

### 5.3 수동 기능 점검 체크리스트

1. 로그인/권한
- 미인증 접근 시 `/login` 리다이렉트 확인 (`PMIS_REQUIRE_LOGIN=true`)
- `viewer/manager/site_admin/super_admin` 권한별 메뉴/쓰기 권한 확인

2. 현장 컨텍스트
- `/system-admin/sites`에서 현장 생성 (`super_admin`)
- `/system-admin/site-memberships`에서 사용자-현장 배정
- TopBar 현장 전환 후 데이터가 현장 기준으로 변경되는지 확인

3. 핵심 CRUD
- 문서: `/design-docs/documents/wizard/1`, `/design-docs/documents/search`
- 도면: `/design-docs/design/drawings`, `/design-docs/design/reviews`
- 안전: `/quality-safety/safety/management/daily-log`
- 자원: `/resource-procurement/materials/plan-actual`

4. 외부 연계
- 날씨(Open-Meteo): `/progress/weather`
- 도면 열람 시스템: `/design-docs/design/drawing-viewer`

### 5.4 배포 후 권장 점검 순서

1. 서버/DB 연결 확인
2. 인증/권한 확인
3. 현장 생성 및 사용자-현장 매핑 확인
4. 핵심 CRUD 스모크 테스트
5. 외부 연계(Open-Meteo/도면 열람) 동작 확인
6. 감사 로그/에러 로그 확인
