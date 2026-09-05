const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
  verifyGroupMembership,
  memberListIncludes,
  normalizeVerifyMode,
} = require('../src/controllers/admin-auth-routes');

function createNapcatServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        handler(req, res, body);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function makeConfig(port, extra = {}) {
  return {
    verifyMode: 'napcat',
    verifyUrl: `http://127.0.0.1:${port}`,
    qqGroupNumber: '695130479',
    verifyToken: '',
    timeoutMs: 3000,
    ...extra,
  };
}

const MEMBERS = [
  { user_id: 10001, nickname: 'a' },
  { user_id: 283405278, nickname: 'b' },
  { user_id: '30001', nickname: 'c' },
];

test('normalizeVerifyMode 只认 napcat', () => {
  assert.equal(normalizeVerifyMode('napcat'), 'napcat');
  assert.equal(normalizeVerifyMode('NapCat'), 'napcat');
  assert.equal(normalizeVerifyMode(''), '');
  assert.equal(normalizeVerifyMode('generic'), '');
});

test('memberListIncludes 匹配数字/字符串 user_id 与 uin 兜底', () => {
  assert.equal(memberListIncludes(MEMBERS, '283405278'), true);
  assert.equal(memberListIncludes(MEMBERS, 283405278), true);
  assert.equal(memberListIncludes(MEMBERS, '30001'), true);
  assert.equal(memberListIncludes([{ uin: 123 }], '123'), true);
  assert.equal(memberListIncludes(MEMBERS, '99999'), false);
  assert.equal(memberListIncludes('not-array', '10001'), false);
  assert.equal(memberListIncludes(MEMBERS, 'abc'), false);
});

test('NapCat 模式：在群内返回 inGroup', async () => {
  const { server, port } = await createNapcatServer((req, res, body) => {
    assert.equal(req.method, 'POST');
    const parsed = JSON.parse(body);
    assert.equal(parsed.action, 'get_group_member_list');
    assert.equal(parsed.params.group_id, 695130479);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', retcode: 0, data: MEMBERS, message: '' }));
  });
  try {
    const result = await verifyGroupMembership('283405278', makeConfig(port));
    assert.equal(result.inGroup, true);
    assert.equal(result.error, '');
    assert.equal(result.memberCount, 3);
  }
  finally {
    await closeServer(server);
  }
});

test('NapCat 模式：不在群内返回 not_in_group', async () => {
  const { server, port } = await createNapcatServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', retcode: 0, data: MEMBERS, message: '' }));
  });
  try {
    const result = await verifyGroupMembership('99999999', makeConfig(port));
    assert.equal(result.inGroup, false);
    assert.equal(result.error, 'not_in_group');
    assert.equal(result.memberCount, 3);
  }
  finally {
    await closeServer(server);
  }
});

test('NapCat 模式：retcode 非 0 视为服务异常并带 NapCat message', async () => {
  const { server, port } = await createNapcatServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'failed', retcode: 100, data: {}, message: '群(695130479)成员283405278不存在' }));
  });
  try {
    const result = await verifyGroupMembership('283405278', makeConfig(port));
    assert.equal(result.inGroup, false);
    assert.equal(result.error, 'service_unavailable');
    assert.match(result.errorMessage, /NapCat 返回错误/);
  }
  finally {
    await closeServer(server);
  }
});

test('NapCat 模式：HTTP 500 返回 service_unavailable', async () => {
  const { server, port } = await createNapcatServer((req, res) => {
    res.writeHead(500);
    res.end('boom');
  });
  try {
    const result = await verifyGroupMembership('283405278', makeConfig(port));
    assert.equal(result.inGroup, false);
    assert.equal(result.error, 'service_unavailable');
    assert.equal(result.httpStatus, 500);
  }
  finally {
    await closeServer(server);
  }
});

test('NapCat 模式：非 JSON 响应返回 invalid_response', async () => {
  const { server, port } = await createNapcatServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('NapCat4 Is Running');
  });
  try {
    const result = await verifyGroupMembership('283405278', makeConfig(port));
    assert.equal(result.inGroup, false);
    assert.equal(result.error, 'invalid_response');
  }
  finally {
    await closeServer(server);
  }
});

test('空验证模式回退通用 GET 校验', async () => {
  const { server, port } = await createNapcatServer((req, res) => {
    assert.equal(req.method, 'GET');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, data: { inGroup: true } }));
  });
  try {
    const result = await verifyGroupMembership('283405278', makeConfig(port, { verifyMode: '' }));
    assert.equal(result.inGroup, true);
  }
  finally {
    await closeServer(server);
  }
});
