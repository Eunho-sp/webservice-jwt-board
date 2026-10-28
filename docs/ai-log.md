# AI 활용 기록

보고서 5장(AI 활용과 참고 자료)과 README의 AI 활용 요약을 작성하기 위한 원본 기록입니다.
작업하면서 바로 기록합니다. 실제 토큰·비밀 키는 적지 않습니다.

도구: Claude Code (모델: Claude Fable 5.1)

| 날짜 | 사용 목적 | 요청 요약 | AI 제안 | 반영 위치 | 내가 확인·수정한 것 | 검증 방법·결과 |
|---|---|---|---|---|---|---|
| 2026-10-28 | 설계/계획 | 과제 공지·체크리스트·보고서 양식을 읽고 시작 전 할 일과 채점 포인트 정리 요청 | 주제·기술 조합(React+Express)·저장소 결정, 체크리스트 1단계 준비 작업, 배점 기준 우선순위 제시 | 작업 순서 결정 (코드 미반영) | 주제를 야구로 결정 | 해당 없음 |
| 2026-10-28 | 환경 준비 | 템플릿을 제출 저장소 구조(frontend/, backend/, docs/)로 복사하고 .env 키 생성, git init | 02 템플릿 폴더를 직접 저장소로 쓰지 말고 새 폴더에 필요한 파일만 복사하도록 제안 | baseball-board/ 전체 폴더 구조, backend/.env (미커밋) | - | npm ci, /api/health 200, 시작 코드 로그인 501 확인 (아래 기록 참고) |

## 2026-10-28 환경 준비 확인 결과 (시작 코드, 인증 미구현 상태)

- `npm ci` 백엔드·프론트 완료, `npm run build` 성공
- `GET /api/health` → 200 `{"status":"ok","stack":"express"}`
- `POST /api/auth/login` (Alice 정상 계정) → 501 NOT_IMPLEMENTED (시작 코드 의도된 상태)
- 토큰 없이 `POST /api/posts` → 201, authorId 1 (데모 ID 반환 상태 확인, 이후 제거 대상)
- `py -I tools/check_api.py --mode starter` → 14/14 PASS
- 시험 글 삭제(204) 후 서버 종료. `backend/data/board.sqlite` 자동 생성 확인

## 2026-10-28 BE-01 로그인과 토큰 발급 (backend/src/auth.js)

- 요청: BE-01 구현. 키 검증(빈 값·예시 키·형식 오류 거부) + HS256 발급(sub 문자열, exp, iss, aud, TTL)
- AI 제안: `loadSecret()`로 서버 시작 시 JWT_SECRET 검사 후 `Buffer.from(hex, 'hex')`로 32바이트 키 변환, `issueToken()`은 `jwt.sign({sub: String(user.id)}, secret, {algorithm, expiresIn, issuer, audience})`
- 반영: auth.js의 `loadSecret`, `config`, `issueToken` (그대로 반영). app.js는 수정 없음
- 검증 (curl, 2026-10-28):
  - 예시 키 / 빈 키 / `abc123` → 서버 시작 거부, 각각 다른 오류 메시지
  - Alice 정상 로그인 → 200, accessToken·expiresIn 90·user(id,name,email). 비밀번호·해시 없음
  - 토큰 디코드 → header alg HS256, payload sub "1"(문자열), iss webservice-class, aud board-api, exp-iat=90
  - 틀린 비밀번호 / 없는 이메일 → 401 INVALID_CREDENTIALS
  - password 누락 → 400 BAD_INPUT
- 배운 점: JWT payload는 base64url이라 키 없이 누구나 읽을 수 있다 → 비밀정보는 넣으면 안 되고, 서명은 "읽기"가 아니라 "위조 방지"용이다.

## 2026-10-28 BE-02 토큰 검증과 /me, BE-03 작성자 권한 (backend/src/auth.js)

- 요청: 이전 세션(VS Code 종료로 끊김)을 이어서 남은 단계 전부 진행 요청. BE-02·BE-03부터 시작
- AI 제안 (currentUserId):
  - Authorization 헤더를 공백으로 나눠 정확히 `Bearer <토큰>` 두 조각이 아니면 401 TOKEN_REQUIRED
  - `jwt.verify(token, secret, { algorithms: ["HS256"], issuer, audience })`로 서명·알고리즘·exp·iss·aud 검증
  - `TokenExpiredError`만 401 TOKEN_EXPIRED, 나머지 오류는 전부 401 INVALID_TOKEN
  - 라이브러리는 exp가 **없는** 토큰을 통과시키므로 `typeof payload.exp !== "number"`를 직접 검사
  - sub가 양의 정수 문자열인지 검사 후 `findPublic(Number(sub))`로 실제 계정 존재 확인, 그 ID만 반환
- AI 제안 (assertOwner): `userId !== authorId`이면 403 FORBIDDEN. app.js의 호출 순서(인증→존재→권한→입력)는 제공 코드 그대로 유지
- 반영: auth.js의 `currentUserId`, `assertOwner` 그대로 반영. users.js의 `findPublic` import 추가. app.js는 서버 시작 콘솔 문구만 변경(인증 TODO 미완성 → JWT 인증 적용)
- 검증:
  - `py -I tools/check_api.py --mode final` → 40/40 PASS (docs/evidence/check_api_final.log)
  - `bash tools/manual_tests.sh` → T01~T17 curl 결과 전부 기대값 일치 (docs/evidence/manual_tests_T01-T17.log)
  - 추가 클레임 검사 `node backend/scripts/check_claims.mjs` → iss/aud 불일치, exp 누락, sub 누락·숫자형·없는 사용자, alg=none, HS512, payload 변조 모두 401 INVALID_TOKEN (docs/evidence/check_claims.log)
- 확인한 것: 공지 "decode가 아니라 verify" 요구를 `jwt.verify`로 충족하는지, `algorithms` 옵션을 비우면 alg=none이 통과할 수 있다는 점을 check_claims로 실제 확인

## 2026-10-28 FE-01~04 (frontend/src/api.js, main.jsx, index.html)

- AI 제안 (api.js): 토큰은 모듈 변수 `session`에만 보관(localStorage 미사용). `authorizationHeaders`는 토큰이 있을 때만 헤더 반환. `request`에서 401이면 `clearSession()` 호출, 403은 유지. code별 안내 문구 표 `MESSAGES`. `login`은 응답의 accessToken·user를 session에 저장. `canEdit`는 `session.user.id === post.authorId`
- AI 제안 (main.jsx): 404면 상세 닫고 목록 재조회, 401이면 편집 상태 정리. 비로그인 시 "글을 쓰려면 먼저 로그인하세요" 안내와 등록 버튼 비활성화. 타인 글에는 수정·삭제 버튼 대신 안내 문구. 데모 배너를 서비스 안내로 교체, 제목을 야구 주제로 변경
- 반영: 그대로 반영. style.css·vite.config.js는 수정 없음
- 검증: `npm run build` 성공 (docs/evidence/frontend_build.log), `npm run preview` 4173에서 페이지 제목과 `/api/health` 프록시 200 확인. 브라우저 UI 캡처(T02·T10·T11·T16 화면)는 직접 수행 예정

## 2026-10-28 테스트 증거 생성 (tools/manual_tests.sh, docs/evidence/)

- AI 제안: T01~T17을 curl로 수행하면서 토큰을 `<TOKEN(masked)>`로 가리고 핵심 헤더(HTTP 상태·Location·WWW-Authenticate)와 본문만 남기는 스크립트
- 실행 결과: T10은 TOKEN_TTL=3 서버(8002)에서 자동 `--expiry` 48/48 PASS + 수동 curl 4종 TOKEN_EXPIRED. T15는 서버 프로세스를 실제로 종료·재실행해 글 유지 확인
- 환경 메모: 이전 세션에서 켜 둔 BE-01 상태 서버가 8000 포트를 계속 잡고 있어 Claude Code가 종료 권한을 받지 못함 → 테스트는 8001 포트로 수행. 최종 4173 UI 확인은 8000 서버를 직접 재시작한 뒤 진행

## 2026-10-28 UI 리뉴얼 (frontend/src/main.jsx, style.css)

- 요청: 한화 이글스 느낌의 주황·검정·흰색, MLB파크식 표 형태 게시판. 로그인·권한 로직은 유지
- AI 제안: 상단 검정 바(사이트 이름 + 로그인 상태) → 주황 메뉴 줄 → 본문 왼쪽에 상세·목록 표(번호/제목/글쓴이/작성일)·글쓰기, 오른쪽에 로그인 상자. 주황은 `#ff6600`(한화 공식 값은 직접 확인하지 않음). 로그인 폼은 미리 채우지 않고 테스트 계정 안내만 표시
- 반영: main.jsx는 JSX 구조와 작성일 표시 함수 `shortDate`만 추가·변경, `run`·`save`·404/401 처리·`canEdit` 분기·비로그인 안내·`role="status"`는 그대로. api.js 수정 없음
- 검증: `npm run build` 성공. 화면 동작은 4173 브라우저 캡처로 확인 예정
