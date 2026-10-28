#!/usr/bin/env bash
# 05_테스트시나리오 T01~T17을 curl로 수행하고 결과를 표준 출력으로 남긴다.
# 사용법: BASE=http://127.0.0.1:8000 bash tools/manual_tests.sh
# 실제 JWT는 출력에서 <TOKEN:사용자>로 가린다. UI 확인(T02 화면, T10 화면, T11 화면, T16)은 별도 캡처.
set -u
BASE=${BASE:-http://127.0.0.1:8000}
PW='Classroom!2026'
declare -A NAMES
mask() { sed -E 's/eyJ[A-Za-z0-9_.-]{20,}/<TOKEN(masked)>/g'; }
show() { # 응답 헤더 중 핵심만 + 본문
  awk 'BEGIN{b=0} /^\r?$/{b=1; next} b==0 && ($0 ~ /^HTTP\/|^Content-Type|^Location|^WWW-Authenticate|^Content-Length/){print "< "$0; next} b==1{print "< "$0}' | mask
}
req() { # req ID "설명" METHOD PATH TOKENVAR BODY
  local id=$1 desc=$2 m=$3 p=$4 t=$5 body=${6-}
  echo; echo "### $id  $desc"
  echo "> $m /api$p  user=${NAMES[$t]:-없음(토큰 없음)}"
  [ -n "$body" ] && echo "> body: $body"
  local args=(-s -i -X "$m" "$BASE/api$p" -H "Content-Type: application/json")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer ${!t}")
  [ -n "$body" ] && args+=(--data "$body")
  curl "${args[@]}" | tr -d '\r' | show
}
login() { curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" --data "{\"email\":\"$1\",\"password\":\"$PW\"}" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/'; }
j() { curl -s "$BASE/api/posts/$1"; }

echo "# 수동 테스트 기록  BASE=$BASE  $(date '+%Y-%m-%d %H:%M:%S')"
echo "# 토큰 원문은 <TOKEN(masked)>로 가렸고, 헤더의 토큰은 user= 로 표시한다."

EMPTY=""; NAMES[EMPTY]="없음(토큰 없음)"
req T01-a "토큰 없이 목록 조회 (공개)" GET /posts EMPTY

# T02 로그인
req T02 "Alice 로그인" POST /auth/login EMPTY "{\"email\":\"alice@class.test\",\"password\":\"$PW\"}"
ALICE=$(login alice@class.test); NAMES[ALICE]="Alice(id1) 정상 토큰"
BOB=$(login bob@class.test);     NAMES[BOB]="Bob(id2) 정상 토큰"
echo "> (Alice 토큰 조각 수: $(echo "$ALICE" | tr '.' '\n' | wc -l), 헤더 디코드: $(echo "$ALICE" | cut -d. -f1 | base64 -d 2>/dev/null))"
echo "> (payload 디코드: $(echo "$ALICE" | cut -d. -f2 | tr '_-' '/+' | awk '{l=length($0)%4; if(l==2)$0=$0"=="; else if(l==3)$0=$0"="; print}' | base64 -d 2>/dev/null))"

req T03-a "틀린 비밀번호로 로그인" POST /auth/login EMPTY '{"email":"alice@class.test","password":"wrong-password"}'
req T03-b "없는 이메일로 로그인" POST /auth/login EMPTY "{\"email\":\"nobody@class.test\",\"password\":\"$PW\"}"
req T03-c "(추가) password 누락 → 형식 오류" POST /auth/login EMPTY '{"email":"alice@class.test"}'

req T04-a "토큰 없이 /me" GET /me EMPTY
req T04-b "토큰 없이 글 등록" POST /posts EMPTY '{"title":"무토큰","content":"등록 시도"}'
req T04-c "(추가) Bearer 형식 오류: 'Token xxx' 스킴" GET /me EMPTY
curl -s -i "$BASE/api/me" -H "Authorization: Token abc" | tr -d '\r' | show
req T04-d "(추가) 'Bearer' 뒤에 JWT가 아닌 값" GET /me EMPTY
curl -s -i "$BASE/api/me" -H "Authorization: Bearer not-a-jwt" | tr -d '\r' | show

req T05-a "Alice 토큰으로 글 작성" POST /posts ALICE '{"title":"한화 vs LG 직관 후기","content":"9회말 역전! 잠실 분위기 최고였다."}'
AP=$(curl -s "$BASE/api/posts" | sed -E 's/^\[\{"id":([0-9]+).*/\1/')
echo "> (생성된 Alice 글 id = $AP)"
req T05-b "Alice 토큰으로 /me" GET /me ALICE
req T01-b "토큰 없이 존재하는 글 상세 조회 (공개)" GET /posts/$AP EMPTY

req T06-a "Alice 본인 글 수정" PUT /posts/$AP ALICE '{"title":"한화 vs LG 직관 후기 (수정)","content":"9회말 역전! 잠실 분위기 최고였다. 다음엔 1루석."}'
req T06-b "(수정 반영 확인) 공개 상세 재조회" GET /posts/$AP EMPTY
req T06-c "Alice가 삭제용 글 하나 더 작성" POST /posts ALICE '{"title":"삭제 테스트 글","content":"곧 지울 글"}'
DP=$(curl -s "$BASE/api/posts" | sed -E 's/^\[\{"id":([0-9]+).*/\1/')
req T06-d "Alice 본인 글 삭제 (id $DP)" DELETE /posts/$DP ALICE
req T06-e "(삭제 반영 확인) 삭제한 글 재조회" GET /posts/$DP EMPTY

BEFORE=$(j $AP)
req T07 "Bob 정상 토큰으로 Alice 글 수정" PUT /posts/$AP BOB '{"title":"Bob이 바꿈","content":"권한 없음 시도"}'
req T07-x "(추가) Bob이 Alice 글에 공백 제목 → 400이 아니라 403" PUT /posts/$AP BOB '{"title":"   ","content":"공백 제목"}'
req T08 "Bob 정상 토큰으로 Alice 글 삭제" DELETE /posts/$AP BOB
echo "> 데이터 불변 확인(T07/T08 후 재조회): $([ "$BEFORE" = "$(j $AP)" ] && echo '원문 그대로 유지됨' && echo "  $(j $AP)" || echo '!!! 변경됨')"

SIG=${ALICE##*.}; HEAD=${ALICE%.*}
[ "${SIG:0:1}" = "A" ] && NEW="B${SIG:1}" || NEW="A${SIG:1}"
TAMPERED="$HEAD.$NEW"; NAMES[TAMPERED]="Alice 토큰의 서명 첫 글자 변조"
req T09-a "변조 토큰으로 /me" GET /me TAMPERED
req T09-b "변조 토큰으로 글 등록" POST /posts TAMPERED '{"title":"변조","content":"등록 시도"}'
req T09-c "변조 토큰으로 Alice 글 수정" PUT /posts/$AP TAMPERED '{"title":"변조","content":"수정 시도"}'
req T09-d "변조 토큰으로 Alice 글 삭제" DELETE /posts/$AP TAMPERED
echo "> 데이터 불변 확인(T09 후): $([ "$BEFORE" = "$(j $AP)" ] && echo '원문 그대로 유지됨' || echo '!!! 변경됨')  / 목록 개수: $(curl -s $BASE/api/posts | grep -o '"id"' | wc -l)"

echo; echo "### T10  만료 토큰 → 별도 실행 (TOKEN_TTL=3 서버, manual_tests_expiry 로그 참고)"

req T11 "로그아웃 후(헤더에서 토큰 제거) /me" GET /me EMPTY

req T12-a "Bob 로그인 상태로 등록에 authorId:1 추가" POST /posts BOB '{"title":"위조","content":"Alice인 척","authorId":1}'
req T12-b "Bob 로그인 상태로 등록에 userId:1 추가" POST /posts BOB '{"title":"위조","content":"Alice인 척","userId":1}'
echo "> 위조 글 미생성 확인: 현재 목록 $(curl -s $BASE/api/posts | mask)"

req T13-a "Alice 본인 토큰, 빈 제목" POST /posts ALICE '{"title":"","content":"내용"}'
req T13-b "Alice 본인 토큰, 공백 본문" POST /posts ALICE '{"title":"제목","content":"   "}'
LONG=$(printf 'x%.0s' $(seq 1 101))
req T13-c "Alice 본인 토큰, 제목 101자" POST /posts ALICE "{\"title\":\"$LONG\",\"content\":\"내용\"}"
req T13-d "(추가) Alice 자기 글에 공백 제목으로 수정 → 400" PUT /posts/$AP ALICE '{"title":"   ","content":"공백 제목"}'
echo "> DB 불변 확인(T13 후): $([ "$BEFORE" = "$(j $AP)" ] && echo '원문 그대로 유지됨' || echo '!!! 변경됨')  / 목록 개수: $(curl -s $BASE/api/posts | grep -o '"id"' | wc -l)"

req T14-a "없는 글(999999) 조회" GET /posts/999999 EMPTY
req T14-b "없는 글 수정 (Alice 정상 토큰)" PUT /posts/999999 ALICE '{"title":"없음","content":"없음"}'
req T14-c "없는 글 삭제 (Alice 정상 토큰)" DELETE /posts/999999 ALICE
req T14-d "잘못된 ID 조회 (abc)" GET /posts/abc EMPTY
req T14-e "(함정 항목) 토큰 없이 없는 글 수정 → 404가 아니라 401" PUT /posts/999999 EMPTY '{"title":"없음","content":"없음"}'

echo; echo "### T15  서버 재시작 후 유지 → 별도 실행 (manual_tests_restart 로그 참고)"
echo; echo "### T16  새로고침 후 로그인 해제 → 브라우저 화면 캡처로 확인 (evidence/ui-*.png)"

req T17-a "토큰 없이 Alice 글 수정" PUT /posts/$AP EMPTY '{"title":"무토큰","content":"수정 시도"}'
req T17-b "토큰 없이 Alice 글 삭제" DELETE /posts/$AP EMPTY
req T17-c "Bob 본인 글 작성" POST /posts BOB '{"title":"KIA 우승 가능성?","content":"선발진이 탄탄하다."}'
BP=$(curl -s "$BASE/api/posts" | sed -E 's/^\[\{"id":([0-9]+).*/\1/')
req T17-d "Bob 본인 글 수정 (id $BP)" PUT /posts/$BP BOB '{"title":"KIA 우승 가능성? (수정)","content":"선발진이 탄탄하다. 불펜도 좋다."}'
req T17-e "Bob 본인 글 삭제 (id $BP)" DELETE /posts/$BP BOB
req T17-f "(확인) 삭제된 Bob 글 재조회" GET /posts/$BP EMPTY

echo; echo "# 테스트 종료. Alice 글 id $AP 는 T15 재시작 확인용으로 남겨 둔다."
