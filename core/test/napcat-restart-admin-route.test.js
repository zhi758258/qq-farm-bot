const test = require('node:test');
const assert = require('node:assert/strict');

const routes = require('../src/controllers/admin-napcat-login-routes');

function createMockApp() {
  const handlers = { get: [], post: [] };
  const app = {
    get: (route, ...args) => handlers.get.push({ route, handlers: args }),
    post: (route, ...args) => handlers.post.push({ route, handlers: args }),
  };
  return { app, handlers };
}

async function invoke(handlersList, route, req) {
  const entry = handlersList.find((item) => item.route === route);
  assert.ok(entry, `未找到路由 ${route}`);
  const res = {
    statusCode: 200,
    payload: null,
    json(payload) {
      this.payload = payload;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
  let index = 0;
  const run = async () => {
    const handler = entry.handlers[index];
    index += 1;
    if (!handler) return;
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    if (nextCalled) await run();
  };
  await run();
  return res;
}

test('GET /api/napcat-login/capability 返回 NapCat 重启状态', async () => {
  const { app, handlers } = createMockApp();
  routes.registerAdminNapcatLoginRoutes({ app });
  const res = await invoke(handlers.get, '/api/napcat-login/capability', {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(typeof res.payload.data.enabled, 'boolean');
  assert.equal(typeof res.payload.data.restarting, 'boolean');
  assert.equal(typeof res.payload.data.lastRestartAt, 'number');
});

test('POST /api/admin/napcat/restart 拒绝非管理员', async () => {
  const { app, handlers } = createMockApp();
  routes.registerAdminNapcatLoginRoutes({
    app,
    requireAdminRole: (_req, res) => res.status(403).json({ ok: false, error: '需要管理员权限' }),
  });
  const res = await invoke(handlers.post, '/api/admin/napcat/restart', { currentUser: { role: 'user' } });
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.ok, false);
});