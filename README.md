# ⚾ 야구 이야기 게시판 (JWT 인증 게시판)

웹서비스설계 개인 과제 "JWT 인증을 적용한 나만의 게시판 만들기" 제출 저장소입니다.
누구나 글을 읽을 수 있고, 로그인한 사용자만 글을 쓰며, 자신의 글만 수정·삭제할 수 있는 야구 이야기 게시판입니다.

## 작성자와 서비스 소개

- 학번 / 이름: [학번] / [이름]
- 서비스 목적과 대상 사용자: 야구를 좋아하는 사람들이 직관 후기, 오늘 경기 감상, 응원하는 팀 이야기를 자유롭게 남기는 게시판입니다. 비로그인 방문자도 모든 글을 읽을 수 있고, 테스트 계정(Alice, Bob)으로 로그인하면 글을 쓸 수 있습니다. 글의 수정과 삭제는 작성자 본인만 할 수 있으며, 서버가 JWT를 검증해 작성자를 결정하므로 다른 사람의 이름으로 글을 쓰거나 남의 글을 고칠 수 없습니다.
- 선택한 기술: React 19 (Vite 8) + Node.js Express 5
- 주요 기능: 공개 목록·상세 조회, 로그인(JWT 발급), 내 정보 조회, 글 작성·수정·삭제(본인만), 토큰 만료·로그아웃 처리, SQLite 파일 DB 저장

## 보고서와 테스트 증거

- [구현 보고서 PDF](docs/report.pdf) (원본 Markdown: [docs/report.md](docs/report.md))
- [테스트 증거](docs/evidence/) — curl 로그(토큰 가림), 자동 검사 로그, 빌드 로그, 화면 캡처
- [AI 활용 기록](docs/ai-log.md)

## 프로젝트 구조

```text
.
├── README.md
├── .gitignore
├── frontend/                 # React + Vite (교수님 제공 frontend-react 템플릿 기반)
│   └── src/api.js, main.jsx  # FE-01~04 구현 파일
├── backend/                  # Node.js Express (교수님 제공 backend-express 템플릿 기반)
│   ├── src/auth.js           # BE-01~03 구현 파일
│   ├── .env.example          # 환경설정 예시 (실제 .env는 커밋하지 않음)
│   └── scripts/check_claims.mjs  # 잘못된 클레임 토큰 거부 확인 스크립트(추가)
├── tools/
│   ├── check_api.py          # 교수님 제공 자동 검사 스크립트
│   └── manual_tests.sh       # T01~T17 curl 수동 테스트 스크립트(추가)
└── docs/
    ├── report.pdf / report.md
    ├── ai-log.md
    └── evidence/
```

제공 템플릿의 `frontend-react/`, `backend-express/` 폴더를 각각 `frontend/`, `backend/`로 이름만 바꿔 사용했습니다.

## 실행 환경

| 항목 | 사용 버전 |
|---|---|
| 운영체제 | Windows 11 (10.0.26300) |
| 프론트 런타임 Node.js | v22.18.0 (npm 10.9.3) |
| 백엔드 런타임 | Node.js v22.18.0 |
| 프레임워크 | React 19.3.0, Vite 8.3.4 / Express 5.3.0, jsonwebtoken 9.0.3, sql.js 1.14.2, dotenv 18.0.7 |
| 데이터 저장 | SQLite 파일 DB (`backend/data/board.sqlite`, sql.js) |
| 검사 스크립트 | Python 3.14 (표준 라이브러리만 사용), curl, Git Bash |

## 설치와 실행

### 1 저장소 복제

```sh
git clone [저장소 URL]
cd baseball-board
```

### 2 백엔드 준비와 실행

```sh
cd backend
npm ci
copy .env.example .env        # macOS/Linux: cp .env.example .env
```

`.env`의 `JWT_SECRET`을 새 난수로 바꿉니다. 예시 키 그대로, 빈 값, 64자리 16진수가 아닌 값이면 서버가 시작을 거부합니다.

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

출력된 64자리 문자열을 `.env`의 `JWT_SECRET=` 뒤에 붙여 넣은 뒤 실행합니다.

```sh
npm start
```

- 환경설정 예시 파일: `backend/.env.example`
- JWT_SECRET 설정 방법: 위 명령으로 생성한 64자리 hex를 `.env`에 기록. 서버는 `dotenv`로 `.env`를 읽고 `Buffer.from(hex, "hex")`로 32바이트 키로 변환합니다. 실제 키는 저장소·보고서에 기록하지 않습니다.
- TOKEN_TTL: 기본 90초. 만료 테스트는 `.env`의 `TOKEN_TTL=3`으로 바꾸거나 `TOKEN_TTL=3 npm start`처럼 환경변수로 덮어쓴 뒤 재시작합니다. 테스트 후 90으로 되돌립니다.
- 백엔드 주소: http://127.0.0.1:8000
- 정상 실행 확인: 콘솔에 `야구 이야기 게시판 API http://127.0.0.1:8000 (JWT 인증 적용)` 출력, 브라우저나 curl로 `http://127.0.0.1:8000/api/health` → `{"status":"ok","stack":"express"}`

### 3 프론트 빌드와 로컬 실행

백엔드를 켜 둔 상태에서 새 터미널을 엽니다.

```sh
cd frontend
npm ci
npm run build
npm run preview
```

- 최종 확인 주소: http://127.0.0.1:4173
- 개발 중 실행: `npm run dev`, http://127.0.0.1:5173
- API 연결 방식: `frontend/vite.config.js`의 proxy 설정으로 4173(또는 5173)의 `/api/*` 요청을 `http://127.0.0.1:8000`으로 전달합니다. 백엔드 포트를 바꾸면 `backend/.env`의 `PORT`와 `vite.config.js`의 proxy 대상을 함께 수정합니다.
- 종료: 프론트와 백엔드를 실행한 각 터미널에서 `Ctrl+C`
- 코드 변경 후 재실행: 프론트는 `npm run build` 후 `npm run preview` 다시 실행, 백엔드는 `Ctrl+C` 후 `npm start` (개발 중에는 `npm run dev`가 파일 변경을 감지해 자동 재시작)

### 4 테스트 계정과 DB

| 사용자 | 이메일 | 실습용 비밀번호 |
|---|---|---|
| Alice (id 1) | alice@class.test | Classroom!2026 |
| Bob (id 2) | bob@class.test | Classroom!2026 |

- 계정은 `backend/src/users.js`에서 서버 시작 시 메모리에 자동 준비됩니다(비밀번호는 scrypt 해시로 보관).
- SQLite 파일: `backend/data/board.sqlite`. 서버 첫 실행 시 폴더와 `posts` 테이블이 자동 생성되며, 글을 쓸 때마다 파일에 저장합니다. 경로는 `.env`의 `DB_FILE`로 바꿀 수 있습니다.
- DB 초기화: 백엔드를 종료한 뒤 `backend/data/board.sqlite`를 삭제하고 다시 시작하면 빈 게시판이 됩니다.
- 서버 재시작 후 데이터 유지 확인 결과: 글 작성 → 서버 프로세스 종료 → 재실행 → 목록 재조회에서 id·제목·내용·작성자·createdAt이 모두 동일함을 확인했습니다. `docs/evidence/manual_tests_T15_restart.log`

위 계정은 과제 전용 테스트 계정입니다. 실제 `.env`와 DB 파일은 `.gitignore`로 제외되어 커밋하지 않습니다.

## 구현 완료 범위

| 기능 | 완료 여부 | 주요 파일 또는 함수 |
|---|---|---|
| 공개 목록과 상세 | 완료 (제공 코드 유지) | `backend/src/app.js` GET /api/posts, /api/posts/:id · `backend/src/store.js` |
| 로그인과 JWT 발급 | 완료 | `backend/src/auth.js` `loadSecret`, `issueToken` · `app.js` POST /api/auth/login |
| JWT 검증과 내 정보 조회 | 완료 | `backend/src/auth.js` `currentUserId` · `app.js` GET /api/me |
| 글 작성과 작성자 저장 | 완료 | `app.js` POST /api/posts → `currentUserId`로 결정한 ID를 `store.create`에 전달 |
| 본인 글 수정·삭제 | 완료 | `backend/src/auth.js` `assertOwner` · `app.js` PUT/DELETE /api/posts/:id |
| 토큰 만료와 로그아웃 | 완료 | 서버: `currentUserId`의 TOKEN_EXPIRED 분기 · 프론트: `frontend/src/api.js` `request`(401 시 `clearSession`), `main.jsx` 로그아웃 버튼 |
| 입력 오류와 권한 오류 처리 | 완료 | 서버: `app.js` `fields`(제공 코드), `assertOwner` · 프론트: `api.js` `MESSAGES`, `main.jsx` `run` |

알려진 문제와 미완성 기능: 없음. (설계상 의도된 동작: 토큰은 브라우저 메모리에만 두므로 새로고침하면 로그인이 해제됩니다. 로그아웃은 이미 복사된 토큰을 서버에서 무효화하지 않으며, 만료(기본 90초)까지는 유효합니다.)

## 테스트 방법과 결과 요약

- 실행한 검사 명령과 실행 위치 (저장소 루트, 백엔드 실행 중):
  - 자동 검사: `py -I tools/check_api.py --mode final` → 40/40 PASS (`docs/evidence/check_api_final.log`)
  - 만료 검사: `TOKEN_TTL=3`으로 백엔드 재시작 후 `py -I tools/check_api.py --mode final --expiry` → 48/48 PASS (`docs/evidence/manual_tests_T10_expiry.log`)
  - 수동 curl: `bash tools/manual_tests.sh` → T01~T17 (`docs/evidence/manual_tests_T01-T17.log`)
  - 클레임 검사: `cd backend && node scripts/check_claims.mjs` → 10/10 PASS (`docs/evidence/check_claims.log`)
- Alice/Bob 권한 구분 확인 결과: Bob의 정상 토큰으로 Alice 글 수정·삭제 → 403 FORBIDDEN, 재조회 시 원문 유지. Bob 본인 글 작성·수정·삭제는 201/200/204 (T07, T08, T17).
- HTTP 상태와 오류 code 확인: 200(조회·로그인·수정), 201(등록), 204(삭제) / 400 BAD_INPUT, 401 INVALID_CREDENTIALS·TOKEN_REQUIRED·INVALID_TOKEN·TOKEN_EXPIRED, 403 FORBIDDEN, 404 NOT_FOUND 모두 명세와 일치. 상세는 보고서 4장.
- 응답 헤더와 본문 확인: 201에 `Location: /api/posts/{id}`, 보호 API 401 전부에 `WWW-Authenticate: Bearer`, 204는 본문 없음.
- 토큰 없음·변조·만료 확인 결과: 없음 → 401 TOKEN_REQUIRED, 서명 첫 글자 변조 → 401 INVALID_TOKEN, TTL 3초 만료 → 401 TOKEN_EXPIRED. 각각 /me와 POST·PUT·DELETE 모두 확인, 데이터 불변 확인.
- 전체 T01~T17 결과와 증거: 보고서 4장 표와 `docs/evidence/`.

## 핵심 구현 설명

1. **로그인** — 화면의 이메일·비밀번호를 `frontend/src/api.js`의 `login`이 JSON으로 `POST /api/auth/login`에 보냅니다. 서버 `app.js`가 제공된 `verifyCredentials`로 계정을 확인한 뒤 `auth.js`의 `issueToken`이 HS256 JWT(sub·exp·iss·aud)를 발급합니다.
2. **토큰 보관·전송** — 응답의 `accessToken`과 `user`를 `api.js`의 모듈 변수 `session`(메모리)에만 저장하고, `authorizationHeaders`가 보호 요청마다 `Authorization: Bearer <JWT>`를 붙입니다.
3. **서버 검증** — 보호 API는 `auth.js`의 `currentUserId`가 헤더 형식 → `jwt.verify`(알고리즘 고정, 서명, 만료, iss, aud) → exp·sub 형식 → 실제 계정 존재 순으로 검사해 사용자 ID만 넘깁니다. 실패는 TOKEN_REQUIRED / INVALID_TOKEN / TOKEN_EXPIRED로 구분한 401입니다.
4. **작성자 권한** — 등록 시 작성자는 검증된 ID로 서버가 저장하고, 수정·삭제는 `assertOwner`가 DB의 `authorId`와 비교해 다르면 403으로 거부합니다. 프론트의 `canEdit`는 버튼 표시용일 뿐 권한 판단은 서버가 합니다.

## AI 활용 요약과 참고 자료

- AI 사용 여부: 사용
- 도구와 사용 목적: Claude Code (모델: Claude Fable 5.1). 과제 문서 분석과 작업 순서 설계, BE-01~03·FE-01~04 코드 초안 작성, 테스트 스크립트 작성, 보고서·README 초안 정리
- 반영 위치와 직접 수정·검증한 내용: `backend/src/auth.js`, `frontend/src/api.js`, `frontend/src/main.jsx`의 코드는 AI 초안을 검토 후 반영했으며, 각 단계마다 curl과 자동 검사로 실제 응답을 확인했습니다. 라이브러리가 exp 없는 토큰을 통과시키는 점은 별도 스크립트로 직접 검증했습니다.
- 상세 활용 기록: `docs/ai-log.md`, 보고서 5장
- 참고한 수업 자료·외부 코드·공식 문서:
  - 교수님 제공 시작 템플릿과 문서(`02_시작템플릿_및_제출양식`: 과제공지, API명세, 구현체크리스트, 테스트시나리오, 로컬실행안내) — 전체 구조와 완료 기준
  - node-jsonwebtoken README https://github.com/auth0/node-jsonwebtoken — `jwt.sign`/`jwt.verify` 옵션(`algorithms`, `issuer`, `audience`, `expiresIn`), `TokenExpiredError`
  - Express 5 문서 https://expressjs.com/ — 에러 핸들러 미들웨어(제공 코드 이해)
  - Vite 문서 https://vite.dev/guide/ — preview 서버와 proxy 설정 이해

## 제출 확인

- [x] README의 안내 문구를 실제 내용으로 교체했다.
- [ ] 새 폴더에 clone하여 README만으로 설치·환경설정·빌드·로컬 실행했다.
- [ ] 4173번 빌드 화면에서 API 연결과 전체 필수 기능을 확인했다.
- [ ] GitHub에서 보고서와 증거 링크가 열린다.
- [ ] 교수자가 저장소를 열람·복제할 수 있다.
- [x] 비밀 키·실제 토큰·DB·node_modules·.venv·target을 커밋하지 않았다.
- [ ] 최종 push 후 저장소 URL과 제출 기준 커밋 SHA를 LMS에 제출했다.
