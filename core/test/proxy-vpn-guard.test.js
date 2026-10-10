const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createProxyVpnGuard,
  isProxyOrVpnRequest,
} = require("../src/services/proxy-vpn-guard");

function createReq({ ip = "203.0.113.10", headers = {} } = {}) {
  return {
    ip,
    headers,
    socket: { remoteAddress: ip },
  };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(body) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
  };
}

test("普通公网访问不拦截", () => {
  const req = createReq({ ip: "203.0.113.10" });
  assert.equal(isProxyOrVpnRequest(req), false);
});

test("局域网和本机访问不拦截", () => {
  assert.equal(isProxyOrVpnRequest(createReq({ ip: "192.168.1.8" })), false);
  assert.equal(isProxyOrVpnRequest(createReq({ ip: "127.0.0.1" })), false);
  assert.equal(isProxyOrVpnRequest(createReq({ ip: "10.0.0.12" })), false);
});

test("站点反代头不拦截", () => {
  const req = createReq({
    ip: "203.0.113.10",
    headers: {
      via: "1.1 nginx",
      "x-forwarded-for": "198.51.100.20, 203.0.113.10",
      "x-real-ip": "203.0.113.10",
      "cf-connecting-ip": "203.0.113.10",
    },
  });
  assert.equal(isProxyOrVpnRequest(req), false);
});

test("机房出口 IP 不误伤普通访客", () => {
  assert.equal(isProxyOrVpnRequest(createReq({ ip: "54.239.28.85" })), false);
  assert.equal(isProxyOrVpnRequest(createReq({ ip: "167.71.12.34" })), false);
});

test("客户端代理头直接判定为代理", () => {
  const req = createReq({
    ip: "203.0.113.10",
    headers: { "proxy-connection": "keep-alive" },
  });
  assert.equal(isProxyOrVpnRequest(req), true);
});

test("守卫对代理请求返回 HTTP 404 正文 Not Found", async () => {
  const guard = createProxyVpnGuard();
  const res = createRes();
  let nextCalled = false;
  await guard(
    createReq({ headers: { "proxy-authorization": "Basic xxx" } }),
    res,
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body, "Not Found");
});

test("守卫放行普通请求", async () => {
  const guard = createProxyVpnGuard();
  const res = createRes();
  let nextCalled = false;
  await guard(createReq(), res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});
