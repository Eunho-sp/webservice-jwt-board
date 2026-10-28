import jwt from "jsonwebtoken";
import { ApiError } from "./errors.js";
import { findPublic } from "./users.js";

// ---------- 서버 설정 (환경변수에서 읽기) ----------
// .env.example에 들어 있는 예시 키. 이 값이 그대로 남아 있으면 서버를 시작하지 않는다.
const EXAMPLE_SECRET = "REPLACE_WITH_RANDOM_64_HEX_CHARACTERS";

function loadSecret() {
  const raw = (process.env.JWT_SECRET || "").trim();
  if (!raw) throw new Error("JWT_SECRET이 비어 있습니다. .env를 확인하세요.");
  if (raw === EXAMPLE_SECRET)
    throw new Error("JWT_SECRET이 예시 키 그대로입니다. 새 난수로 바꾸세요.");
  if (!/^[0-9a-fA-F]{64}$/.test(raw))
    throw new Error("JWT_SECRET은 64자리 16진수 문자열이어야 합니다.");
  // 64자리 hex → 32바이트 키. 서명에는 이 Buffer를 사용한다.
  return Buffer.from(raw, "hex");
}

const config = {
  secret: loadSecret(),
  issuer: process.env.JWT_ISSUER || "webservice-class",
  audience: process.env.JWT_AUDIENCE || "board-api",
  ttl: Number(process.env.TOKEN_TTL || 90), // 초 단위. 만료 테스트 때 3 등으로 줄인다.
};
if (!Number.isInteger(config.ttl) || config.ttl <= 0)
  throw new Error("TOKEN_TTL은 1 이상의 정수(초)여야 합니다.");

// ---------- BE-01: 로그인 성공한 사용자에게 JWT 발급 ----------
// 입력: app.js의 verifyCredentials를 통과한 공개 사용자 { id, name, email }
// 출력: HS256으로 서명된 JWT 문자열
// 토큰에는 비밀번호/해시를 넣지 않고, 사용자 ID만 sub(문자열)로 넣는다.
export function issueToken(user) {
  return jwt.sign(
    { sub: String(user.id) },
    config.secret,
    {
      algorithm: "HS256",
      expiresIn: config.ttl, // exp = 현재 시각(UTC 초) + ttl
      issuer: config.issuer, // iss
      audience: config.audience, // aud
    },
  );
}

// ---------- BE-02: 보호 API 요청마다 토큰을 검증해 사용자 ID를 돌려준다 ----------
// 입력: Express req (Authorization 헤더)
// 출력: 검증된 사용자 ID (number). 실패하면 ApiError(401)를 던진다.
//   - 헤더 없음 / "Bearer <토큰>" 형식 아님      → 401 TOKEN_REQUIRED
//   - 서명·알고리즘·iss·aud·sub 오류, 없는 사용자 → 401 INVALID_TOKEN
//   - 서명은 정상이지만 exp가 지남              → 401 TOKEN_EXPIRED
export function currentUserId(req) {
  const header = req.get("Authorization") || "";
  const parts = header.trim().split(/\s+/);
  // "Bearer" 한 단어 + 토큰 한 단어, 정확히 두 조각이어야 한다.
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1])
    throw new ApiError(
      401,
      "TOKEN_REQUIRED",
      "로그인이 필요합니다. Authorization: Bearer <토큰> 형식으로 보내세요.",
    );
  const token = parts[1];

  let payload;
  try {
    // decode가 아니라 verify: 서명을 다시 계산해 비교하고,
    // 허용 알고리즘을 HS256 하나로 고정하며, exp(만료)·iss·aud를 함께 검사한다.
    payload = jwt.verify(token, config.secret, {
      algorithms: ["HS256"],
      issuer: config.issuer,
      audience: config.audience,
    });
  } catch (error) {
    // TokenExpiredError는 "서명은 맞는데 시간이 지난" 경우에만 발생한다.
    if (error instanceof jwt.TokenExpiredError)
      throw new ApiError(
        401,
        "TOKEN_EXPIRED",
        "로그인 시간이 만료되었습니다. 다시 로그인하세요.",
      );
    // 그 밖의 오류(서명 불일치, 알고리즘 불일치, iss/aud 불일치, 형식 오류)는 모두 변조로 본다.
    throw new ApiError(401, "INVALID_TOKEN", "토큰이 유효하지 않습니다.");
  }

  // 라이브러리는 exp가 "없는" 토큰은 통과시키므로, exp 존재 여부는 직접 확인한다.
  if (typeof payload.exp !== "number")
    throw new ApiError(401, "INVALID_TOKEN", "토큰에 만료 시각이 없습니다.");
  // sub는 양의 정수를 표현한 "문자열"이어야 한다.
  if (typeof payload.sub !== "string" || !/^[1-9]\d*$/.test(payload.sub))
    throw new ApiError(401, "INVALID_TOKEN", "토큰의 사용자 정보가 올바르지 않습니다.");

  // 토큰 내용만 믿지 않고 실제 계정이 존재하는지 확인한 뒤 그 ID만 넘긴다.
  const user = findPublic(Number(payload.sub));
  if (!user)
    throw new ApiError(401, "INVALID_TOKEN", "존재하지 않는 사용자입니다.");
  return user.id;
}

// ---------- BE-03: 작성자 본인인지 검사 ----------
// 입력: 토큰에서 검증된 사용자 ID, DB에 저장된 글의 authorId
// 출력: 같으면 아무 일도 하지 않음. 다르면 403 FORBIDDEN (DB는 건드리지 않는다)
// 401(누구인지 모름)과 403(누구인지는 알지만 권한 없음)을 구분하는 지점이다.
export function assertOwner(userId, authorId) {
  if (userId !== authorId)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "본인이 작성한 글만 수정·삭제할 수 있습니다.",
    );
}
