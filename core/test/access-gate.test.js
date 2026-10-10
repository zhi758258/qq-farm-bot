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

function correctAnswer(challenge) {
  const label = targetLabel(challenge.prompt);
  return challenge.tiles.filter((tile) => tile.label === label).map((tile) => tile.id);
}

test("createChallenge 生成点选图案题目且不含答案", () => {
  const gate = createAccessGate({
    secret: crypto.randomBytes(32),
  });
  const challenge = gate.createChallenge("10.0.0.1");
  assert.match(challenge.prompt, /^请点击所有「.+」$/);
  assert.equal(challenge.tiles.length, 9);
  assert.equal(challenge.answer, undefined);
  assert.equal(typeof challenge.id, "string");
  assert.ok(challenge.id.length >= 16);
  const ids = new Set();
  for (const tile of challenge.tiles) {
    assert.equal(typeof tile.id, "string");
    assert.ok(tile.id.length >= 8);
    assert.equal(typeof tile.label, "string");
    assert.equal(typeof tile.glyph, "string");
    ids.add(tile.id);
  }
  assert.equal(ids.size, 9);
  assert.ok(correctAnswer(challenge).length >= 2);
});

test("点对签发一小时通行证，绑定当前 IP", () => {
  let now = 1_700_000_000_000;
  const gate = createAccessGate({
    now: () => now,
    passTtlMs: 60 * 60 * 1000,
    secret: Buffer.from("test-secret"),
  });
  const challenge = gate.createChallenge("8.8.8.8");
  const result = gate.verifyAnswer(challenge.id, correctAnswer(challenge), "8.8.8.8");
  assert.equal(result.ok, true);
  assert.equal(result.maxAge, 60 * 60 * 1000);
  assert.equal(gate.verifyPassToken(result.token, "8.8.8.8"), true);

  now += 60 * 60 * 1000 - 1;
  assert.equal(gate.verifyPassToken(result.token, "8.8.8.8"), true);

  now += 2;
  assert.equal(gate.verifyPassToken(result.token, "8.8.8.8"), false);
});

test("点错返回 404", () => {
  const gate = createAccessGate({
    secret: Buffer.from("test-secret"),
  });
  const challenge = gate.createChallenge("1.1.1.1");
  const label = targetLabel(challenge.prompt);
  const wrong = challenge.tiles.filter((tile) => tile.label !== label).map((tile) => tile.id).slice(0, 2);
  const result = gate.verifyAnswer(challenge.id, wrong, "1.1.1.1");
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test("换 IP 后已通过的通行证失效", () => {
  const gate = createAccessGate({
    secret: Buffer.from("test-secret"),
  });
  const challenge = gate.createChallenge("1.2.3.4");
  const result = gate.verifyAnswer(challenge.id, correctAnswer(challenge), "1.2.3.4");
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
  const gate = createAccessGate({
    secret: Buffer.from("test-secret"),
  });
  const challenge = gate.createChallenge("1.2.3.4");
  const result = gate.verifyAnswer(challenge.id, correctAnswer(challenge), "5.5.5.5");
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test("isRequestPassed 读取 cookie 并通过当前 IP", () => {
  const gate = createAccessGate({
    secret: Buffer.from("test-secret"),
  });
  const challenge = gate.createChallenge("203.0.113.8");
  const result = gate.verifyAnswer(challenge.id, correctAnswer(challenge), "203.0.113.8");
  const req = createReq({
    ip: "203.0.113.8",
    cookie: `${COOKIE_NAME}=${result.token}`,
  });
  assert.equal(gate.isRequestPassed(req), true);
});
