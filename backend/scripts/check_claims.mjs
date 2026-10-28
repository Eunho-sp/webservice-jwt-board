// 추가 점검: 서명은 내 로컬 키로 정상이지만 클레임이 잘못된 토큰이 거부되는지 (로컬 실습 키·서버만 사용)
import "dotenv/config";
import jwt from "jsonwebtoken";
const key = Buffer.from(process.env.JWT_SECRET, "hex");
const base = process.env.BASE || "http://127.0.0.1:8001";
const ok = { algorithm: "HS256", issuer: "webservice-class", audience: "board-api", expiresIn: 60 };
const cases = [
  ["정상 토큰(대조군)", jwt.sign({ sub: "1" }, key, ok), 200],
  ["iss 불일치 (other-issuer)", jwt.sign({ sub: "1" }, key, { ...ok, issuer: "other-issuer" }), 401],
  ["aud 불일치 (other-api)", jwt.sign({ sub: "1" }, key, { ...ok, audience: "other-api" }), 401],
  ["exp 누락", jwt.sign({ sub: "1" }, key, { algorithm: "HS256", issuer: ok.issuer, audience: ok.audience }), 401],
  ["sub 누락", jwt.sign({}, key, ok), 401],
  ["sub가 숫자형(1)", jwt.sign({ sub: 1 }, key, ok), 401],
  ["sub가 없는 사용자(99)", jwt.sign({ sub: "99" }, key, ok), 401],
  ["alg=none (서명 없음)", jwt.sign({ sub: "1", iss: ok.issuer, aud: ok.audience, exp: Math.floor(Date.now()/1000)+60 }, "", { algorithm: "none" }), 401],
  ["HS512로 같은 키 서명", jwt.sign({ sub: "1" }, key, { ...ok, algorithm: "HS512" }), 401],
  ["payload만 sub 2로 바꿈 (서명 불일치)", (() => { const [h, , s] = jwt.sign({ sub: "1" }, key, ok).split("."); const p = Buffer.from(JSON.stringify({ ...jwt.decode(jwt.sign({ sub: "1" }, key, ok)), sub: "2" })).toString("base64url"); return `${h}.${p}.${s}`; })(), 401],
];
console.log("# 클레임 검증 추가 점검  BASE=" + base + "  " + new Date().toISOString());
for (const [name, token, expected] of cases) {
  const r = await fetch(base + "/api/me", { headers: { Authorization: "Bearer " + token } });
  const body = await r.text();
  const hdr = r.headers.get("www-authenticate");
  console.log(`${r.status === expected ? "PASS" : "FAIL"} ${name.padEnd(28)} → HTTP ${r.status} ${body}${hdr ? "  [WWW-Authenticate: " + hdr + "]" : ""}`);
}
