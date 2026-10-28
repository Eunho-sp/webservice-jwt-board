// FE-01~04: 로그인 연결, 토큰 전송, 오류 처리, 작성자 버튼 판단
// 토큰은 이 모듈의 변수(브라우저 메모리)에만 둔다. localStorage/sessionStorage에 저장하지 않는다.
// 그래서 새로고침하면 로그인 상태가 사라지는 것이 정상이다.
let session = { accessToken: "", user: null };
export const getSession = () => session;
export function clearSession() {
  session = { accessToken: "", user: null };
}

// FE-02: 메모리에 토큰이 있을 때만 Authorization 헤더를 만든다.
// 토큰이 없으면 빈 객체를 돌려줘서 "Bearer undefined" 같은 헤더가 생기지 않게 한다.
function authorizationHeaders() {
  return session.accessToken
    ? { Authorization: `Bearer ${session.accessToken}` }
    : {};
}

// FE-03: 서버의 HTTP 상태와 code에 맞춰 화면에 보여줄 문구를 정한다.
const MESSAGES = {
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 틀렸습니다.",
  TOKEN_REQUIRED: "로그인이 필요한 기능입니다. 먼저 로그인하세요.",
  TOKEN_EXPIRED: "로그인 시간이 만료되었습니다. 다시 로그인하세요.",
  INVALID_TOKEN: "로그인 정보가 유효하지 않습니다. 다시 로그인하세요.",
  FORBIDDEN: "본인이 작성한 글만 수정·삭제할 수 있습니다.",
  NOT_FOUND: "해당 게시글이 없습니다. 목록을 다시 불러왔습니다.",
  BAD_INPUT: "입력값을 확인하세요.",
};

export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authorizationHeaders(),
      ...options.headers,
    },
  });
  // 204(삭제 성공)는 본문이 없으므로 JSON으로 읽지 않는다.
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    // 401은 "누구인지 확인 불가"이므로 메모리의 토큰과 사용자 상태를 지운다.
    // 403은 로그인은 유효하지만 권한이 없는 것이므로 로그인 상태를 유지한다.
    if (response.status === 401) clearSession();
    const code = data?.code;
    const error = new Error(
      MESSAGES[code] || data?.message || code || `HTTP ${response.status}`,
    );
    error.status = response.status;
    error.code = code;
    throw error;
  }
  return data;
}

// FE-01: 로그인 폼의 email·password를 JSON으로 보내고,
// 성공 응답의 accessToken과 user를 메모리에 저장한다. 실패하면 request()가 던진 오류가 그대로 올라간다.
export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  session = { accessToken: data.accessToken, user: data.user };
  return data.user;
}

// FE-04: 로그인한 사용자와 글의 작성자가 같을 때만 수정·삭제 버튼을 보여준다.
// 이것은 화면 편의일 뿐이고, 실제 권한 검사는 서버의 assertOwner가 한다.
export function canEdit(post) {
  return !!session.user && session.user.id === post.authorId;
}

export const api = {
  list: () => request("/posts"),
  detail: (id) => request(`/posts/${id}`),
  create: (input) =>
    request("/posts", { method: "POST", body: JSON.stringify(input) }),
  update: (id, input) =>
    request(`/posts/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  remove: (id) => request(`/posts/${id}`, { method: "DELETE" }),
  me: () => request("/me"),
};
