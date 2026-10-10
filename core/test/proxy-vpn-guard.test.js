const test = require("node:test");
const assert = require("node:assert/strict");

const { createProxyVpnGuard, isProxyOrVpnRequest } = require("../src/services/proxy-vpn-guard");

test("代理拦截已关闭", () => {
  assert.equal(isProxyOrVpnRequest({ headers: { "proxy-connection": "keep-alive" } }), false);
});

test("守卫直接放行", async () => {
  const guard = createProxyVpnGuard();
  let nextCalled = false;
  await guard({}, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
