const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { COOKIE_NAME, createAccessGate } = require("../src/services/access-gate");

function createReq({ ip = "1.2.3.4", cookie = "", headers = {} } = {}) {
  return {
    ip,
    headers: {
      ...headers,
      cookie,
    },
  };
}

function targetLabel(prompt) {
  const match = String(prompt || "").match(/「(.+)」/);
  assert.ok(match, "题目应包含目标文字");
  return match[1];
}

function correctIconAnswer(challenge) {
  const label = targetLabel(challenge.prompt);
  return challenge.tiles.filter((tile) => tile.label === label).map((tile) => tile.id);
}

function parseMathAnswer(question) {
  const match = String(question || "").match(/^(\d+)\s*([+-])\s*(\d+)$/);
  assert.ok(match, "加减法题目格式不正确");
  const left = Number(match[1]);
  const right = Number(match[3]);
  return match[2] === "+" ? left + right : left - right;
}

test("createChallenge 可生成加减法题目且不含答案", () => {
  const gate = createAccessGate({ secret: crypto.randomBytes(32) });
  const challenge = gate.createChallenge("10.0.0.1", "math");
  assert.equal(challenge.type, "math");
  assert.match(challenge.question, /^\d+ [+-] \d+$/);
  assert.equal(challenge.answer, undefined);
  assert.equal(typeof challenge.id, "string");
});

test("createChallenge 可生成点选图案题目且不含答案", () => {
  const gate = createAccessGate({ secret: crypto.randomBytes(32) });
  const challenge = gate.createChallenge("10.0.0.1", "icon");
  assert.equal(challenge.type, "icon");
  assert.match(challenge.prompt, /^请点击所有「.+」$/);
  assert.equal(challenge.tiles.length, 9);
  assert.equal(challenge.answer, undefined);
  assert.ok(correctIconAnswer(challenge).length >= 2);
});

test("createChallenge 可生成滑动题目且不含答案", () => {
  const gate = createAccessGate({ secret: crypto.randomBytes(32) });
  const challenge = gate.createChallenge("10.0.0.1", "slide");
  assert.equal(challenge.type, "slide");
  assert.equal(typeof challenge.target, "number");
  assert.ok(challenge.target >= 24 && challenge.target <= 86);
  assert.equal(challenge.answer, undefined);
});

test("createChallenge 可生成拖拽图案题目且不含答案", () => {
  const gate = createAccessGate({ secret: crypto.randomBytes(32) });
  const challenge = gate.createChallenge("10.0.0.1", "drag");
  assert.equal(challenge.type, "drag");
  assert.match(challenge.prompt, /^请把「.+」拖到框内$/);
  assert.equal(challenge.pieces.length, 4);
  assert.equal(typeof challenge.slot.label, "string");
  assert.equal(challenge.answer, undefined);
  const ids = new Set(challenge.pieces.map((item) => item.id));
  assert.equal(ids.size, 4);
});

test("未指定类型时随机四种之一", () => {
  const gate = createAccessGate({ secret: crypto.randomBytes(32) });
  const types = new Set();
  for (let i = 0; i < 80; i += 1) {
    types.add(gate.createChallenge("10.0.0.1").type);
  }
  assert.ok(types.has("math"));
  assert.ok(types.has("icon"));
  assert.ok(types.has("slide"));
  assert.ok(types.has("drag"));
});

test("加减法答对签发一小时通行证，绑定当前 IP", () => {
  let now = 1_700_000_000_000;
  const gate = createAccessGate({
    now: () => now,
    passTtlMs: 60 * 60 * 1000,
    secret: Buffer.from("test-secret"),
  });
  const challenge = gate.createChallenge("8.8.8.8", "math");
  const result = gate.verifyAnswer(challenge.id, parseMathAnswer(challenge.question), "8.8.8.8");
  assert.equal(result.ok, true);
  assert.equal(result.maxAge, 60 * 60 * 1000);
  assert.equal(gate.verifyPassToken(result.token, "8.8.8.8"), true);

  now += 60 * 60 * 1000 - 1;
  assert.equal(gate.verifyPassToken(result.token, "8.8.8.8"), true);

  now += 2;
  assert.equal(gate.verifyPassToken(result.token, "8.8.8.8"), false);
});

test("点选图案答错返回 404", () => {
  const gate = createAccessGate({ secret: Buffer.from("test-secret") });
  const challenge = gate.createChallenge("1.1.1.1", "icon");
  const label = targetLabel(challenge.prompt);
  const wrong = challenge.tiles.filter((tile) => tile.label !== label).map((tile) => tile.id).slice(0, 2);
  const result = gate.verifyAnswer(challenge.id, wrong, "1.1.1.1");
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test("滑动位置偏差在容差内通过，超出返回 404", () => {
  const gate = createAccessGate({ secret: Buffer.from("test-secret") });
  const okChallenge = gate.createChallenge("1.2.3.4", "slide");
  const ok = gate.verifyAnswer(okChallenge.id, okChallenge.target + 4, "1.2.3.4");
  assert.equal(ok.ok, true);

  const failChallenge = gate.createChallenge("1.2.3.4", "slide");
  const fail = gate.verifyAnswer(failChallenge.id, failChallenge.target + 20, "1.2.3.4");
  assert.equal(fail.ok, false);
  assert.equal(fail.status, 404);
});

test("拖拽正确图案通过，拖错返回 404", () => {
  const gate = createAccessGate({ secret: Buffer.from("test-secret") });
  const okChallenge = gate.createChallenge("1.2.3.4", "drag");
  const label = targetLabel(okChallenge.prompt);
  const correct = okChallenge.pieces.find((item) => item.label === label);
  assert.ok(correct);
  const ok = gate.verifyAnswer(okChallenge.id, correct.id, "1.2.3.4");
  assert.equal(ok.ok, true);

  const failChallenge = gate.createChallenge("1.2.3.4", "drag");
  const failLabel = targetLabel(failChallenge.prompt);
  const wrong = failChallenge.pieces.find((item) => item.label !== failLabel);
  assert.ok(wrong);
  const fail = gate.verifyAnswer(failChallenge.id, wrong.id, "1.2.3.4");
  assert.equal(fail.ok, false);
  assert.equal(fail.status, 404);
});

test("换 IP 后已通过的通行证失效", () => {
  const gate = createAccessGate({ secret: Buffer.from("test-secret") });
  const challenge = gate.createChallenge("1.2.3.4", "icon");
  const result = gate.verifyAnswer(challenge.id, correctIconAnswer(challenge), "1.2.3.4");
  assert.equal(result.ok, true);
  assert.equal(gate.verifyPassToken(result.token, "1.2.3.4"), true);
  assert.equal(gate.verifyPassToken(result.token, "9.9.9.9"), false);

  const req = createReq({
    ip: "9.9.9.9",
    cookie: `${COOKIE_NAME}=${result.token}`,
  });
  assert.equal(gate.isRequestPassed(req), false);
});

test("题目绑定 IP，其他 IP 提交视为 404", () => {
  const gate = createAccessGate({ secret: Buffer.from("test-secret") });
  const challenge = gate.createChallenge("1.2.3.4", "math");
  const result = gate.verifyAnswer(challenge.id, parseMathAnswer(challenge.question), "5.5.5.5");
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test("isRequestPassed 读取 cookie 并通过当前 IP", () => {
  const gate = createAccessGate({ secret: Buffer.from("test-secret") });
  const challenge = gate.createChallenge("203.0.113.8", "slide");
  const result = gate.verifyAnswer(challenge.id, challenge.target, "203.0.113.8");
  const req = createReq({
    ip: "203.0.113.8",
    cookie: `${COOKIE_NAME}=${result.token}`,
  });
  assert.equal(gate.isRequestPassed(req), true);
});
