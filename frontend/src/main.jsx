import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, login, getSession, clearSession, canEdit } from "./api";
import "./style.css";
// 목록 표의 작성일 칸: 같은 날이면 시:분, 아니면 연.월.일
function shortDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return d.toDateString() === new Date().toDateString()
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
function App() {
  const [posts, setPosts] = useState([]),
    [selected, setSelected] = useState(null);
  const [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [editing, setEditing] = useState(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [user, setUser] = useState(null),
    [message, setMessage] = useState("게시판을 불러오는 중입니다."),
    [busy, setBusy] = useState(false);
  const refresh = async () => setPosts(await api.list());
  async function run(action, success) {
    setBusy(true);
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(e.message);
      // 404: 글이 사라졌으므로 상세를 닫고 목록을 다시 불러온다.
      if (e.status === 404) {
        setSelected(null);
        reset();
        try {
          await refresh();
        } catch {}
      }
      // 401: api.js가 세션을 지웠으므로 편집 중이던 상태도 함께 정리한다.
      // 403: 로그인은 유효하므로 아무 것도 지우지 않는다.
      if (e.status === 401) setEditing(null);
    } finally {
      setUser(getSession().user);
      setBusy(false);
    }
  }
  useEffect(() => {
    run(refresh, "게시판이 준비되었습니다.");
  }, []);
  function reset() {
    setTitle("");
    setContent("");
    setEditing(null);
  }
  async function save(e) {
    e.preventDefault();
    await run(async () => {
      const p = editing
        ? await api.update(editing, { title, content })
        : await api.create({ title, content });
      setSelected(p);
      reset();
      await refresh();
    }, "게시글을 저장했습니다.");
  }
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <span className="logo">⚾ 야구 이야기</span>
          <span className="who">
            {user ? `${user.name}님 로그인 중` : "로그아웃 상태"}
          </span>
        </div>
      </header>
      <nav className="subbar">
        <div className="wrap">
          <span className="tab">자유게시판</span>
        </div>
      </nav>
      <main className="wrap">
        <p className="banner">
          글 읽기는 누구나, 글쓰기는 로그인한 사용자만, 수정·삭제는 작성자
          본인만 할 수 있습니다. 로그인 상태는 이 탭의 메모리에만 보관되어
          새로고침하면 해제됩니다 (토큰 유효 시간 90초).
        </p>
        <div role="status" className="message">
          {message}
        </div>
        <div className="layout">
          <div>
            {selected && (
              <section className="box view">
                <div className="view-head">
                  <h2>{selected.title}</h2>
                  <p className="meta">
                    {selected.authorName} ·{" "}
                    {new Date(selected.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="content">{selected.content}</p>
                <div className="view-foot">
                  {canEdit(selected) ? (
                    <div className="actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditing(selected.id);
                          setTitle(selected.title);
                          setContent(selected.content);
                        }}
                      >
                        수정
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => {
                          if (confirm("게시글을 삭제할까요?"))
                            run(async () => {
                              await api.remove(selected.id);
                              setSelected(null);
                              reset();
                              await refresh();
                            }, "게시글을 삭제했습니다.");
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ) : (
                    <p className="muted">
                      {user
                        ? "다른 사용자의 글은 수정·삭제할 수 없습니다."
                        : "수정·삭제는 작성자 본인이 로그인한 뒤 가능합니다."}
                    </p>
                  )}
                  <button className="secondary" onClick={() => setSelected(null)}>
                    목록
                  </button>
                </div>
              </section>
            )}
            <section className="box">
              <div className="board-head">
                <h2>
                  자유게시판 <small>{posts.length}개</small>
                </h2>
                <a className="btn" href="#write">
                  글쓰기
                </a>
              </div>
              <table className="board">
                <thead>
                  <tr>
                    <th className="col-no">번호</th>
                    <th>제목</th>
                    <th className="col-author">글쓴이</th>
                    <th className="col-date">작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty">
                        아직 글이 없습니다. 첫 야구 이야기를 남겨 보세요.
                      </td>
                    </tr>
                  ) : (
                    posts.map((p) => (
                      <tr
                        key={p.id}
                        className={selected?.id === p.id ? "current" : ""}
                      >
                        <td className="col-no">{p.id}</td>
                        <td>
                          <button
                            className="post-title"
                            disabled={busy}
                            onClick={() =>
                              run(
                                async () => setSelected(await api.detail(p.id)),
                                "게시글을 불러왔습니다.",
                              )
                            }
                          >
                            {p.title}
                          </button>
                        </td>
                        <td className="col-author">{p.authorName}</td>
                        <td className="col-date">{shortDate(p.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
            <section className="box" id="write">
              <h2>{editing ? "게시글 수정" : "새 글 작성"}</h2>
              {!user && (
                <p className="muted">글을 쓰려면 먼저 로그인하세요.</p>
              )}
              <form onSubmit={save}>
                <label>
                  제목
                  <input
                    maxLength={100}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </label>
                <label>
                  내용
                  <textarea
                    maxLength={5000}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </label>
                <div className="actions">
                  <button disabled={busy || !user}>
                    {editing ? "수정 저장" : "등록"}
                  </button>
                  <button type="button" className="secondary" onClick={reset}>
                    입력 초기화
                  </button>
                </div>
              </form>
            </section>
          </div>
          <aside>
            <section className="box login">
              <h2>로그인</h2>
              <p className="who-box">
                {user ? `${user.name}님 로그인 중` : "로그아웃 상태"}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => login(email, password), "로그인했습니다. 글을 작성할 수 있습니다.");
                }}
              >
                <label>
                  이메일
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label>
                  비밀번호
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
                <div className="actions">
                  <button disabled={busy}>로그인</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      clearSession();
                      setUser(null);
                      reset();
                      setMessage("로그아웃했습니다. 이 탭의 토큰을 지웠습니다.");
                    }}
                  >
                    로그아웃
                  </button>
                </div>
              </form>
              <button
                className="secondary full"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const me = await api.me();
                    setSelected(null);
                    alert(`${me.name} (${me.email})`);
                  }, "내 정보 조회를 완료했습니다.")
                }
              >
                내 정보 조회
              </button>
              <p className="hint">
                테스트 계정: alice@class.test / bob@class.test
                <br />
                공통 비밀번호: Classroom!2026
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
