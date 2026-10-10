const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { createAccessGate } = require("../src/services/access-gate");
const { registerAdminAccessGateRoutes, createAccessGateApiGuard } = require("../src/controllers/admin-access-gate-routes");

function createMockApp() {
  const handlers = { get: [], post: [] };
  const app = {
    get: (route, ...args) => handlers.get.push({ route, handlers: args }),
    post: (route, ...args) => handlers.post.push({ route, handlers: args }),
  };
  return { app, handlers };
}

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    cookieName: "",
    cookieValue: "",
    json(payload) {
      this.payload = payload;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, value) {
      this.cookieName = name;
      this.cookieValue = value;
      return this;
    },
  };
}

async function invoke(handlersList, route, req) {
  const entry = handlersList.find((item) => item.route === route);
  assert.ok(entry, `未找到路由 ${route}`);
  const res = createRes();
  for (const handler of entry.handlers) {
    await handler(req, res, () => {});
  }
  return res;
}

function correctAnswer(data) {
  const match = String(data.prompt || "").match(/「(.+)」/);
  assert.ok(match, "题目应包含目标文字");
  return data.tiles.filter((tile) => tile.label === match[1]).map((tile) => tile.id);
}

test("点对验证后写入通行证 cookie", async () => {
  const gate = createAccessGate({
    secret: Buffer.from("route-secret"),
  });
  const { app, handlers } = createMockApp();
  registerAdminAccessGateRoutes({ app, accessGate: gate });

  const challengeRes = await invoke(handlers.get, "/api/access-gate/challenge", {
    ip: "198.51.100.10",
    headers: {},
    body: {},
  });
  assert.equal(challengeRes.payload.ok, true);
  assert.equal(challengeRes.payload.passed, false);
  assert.match(challengeRes.payload.data.prompt, /^请点击所有「.+」$/);
  assert.equal(challengeRes.payload.data.tiles.length, 9);

  const verifyRes = await invoke(handlers.post, "/api/access-gate/verify", {
    ip: "198.51.100.10",
    headers: {},
    body: { id: challengeRes.payload.data.id, answer: correctAnswer(challengeRes.payload.data) },
  });
  assert.equal(verifyRes.statusCode, 200);
  assert.equal(verifyRes.payload.ok, true);
  assert.equal(verifyRes.cookieName, "farm_access_pass");
  assert.ok(verifyRes.cookieValue);
});

test("点错返回 404", async () => {
  const gate = createAccessGate({
    secret: Buffer.from("route-secret"),
  });
  const { app, handlers } = createMockApp();
  registerAdminAccessGateRoutes({ app, accessGate: gate });
  const challengeRes = await invoke(handlers.get, "/api/access-gate/challenge", {
    ip: "198.51.100.10",
    headers: {},
    body: {},
  });
  const verifyRes = await invoke(handlers.post, "/api/access-gate/verify", {
    ip: "198.51.100.10",
    headers: {},
    body: { id: challengeRes.payload.data.id, answer: ["wrong"] },
  });
  assert.equal(verifyRes.statusCode, 404);
  assert.equal(verifyRes.payload.ok, false);
});

test("API 守卫拦截未通过验证的请求", async () => {
  const gate = createAccessGate({ secret: crypto.randomBytes(16) });
  const guard = createAccessGateApiGuard(gate);
  const res = createRes();
  let nextCalled = false;
  await guard(
    { method: "GET", path: "/login", ip: "1.1.1.1", headers: {} },
    res,
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.code, "ACCESS_GATE");
});

test("API 守卫放行 access-gate 与 health", async () => {
  const gate = createAccessGate({ secret: crypto.randomBytes(16) });
  const guard = createAccessGateApiGuard(gate);
  const res = createRes();
  let nextCalled = false;
  await guard(
    { method: "GET", path: "/access-gate/challenge", ip: "1.1.1.1", headers: {} },
    res,
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, true);
});
