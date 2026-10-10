const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.FARM_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'login-rate-limit-'));

const userStore = require('../src/models/user-store');

function failLogin(username, ip) {
  userStore.recordLoginAttempt({
    username,
    success: false,
    ip,
    userAgent: 'test',
    reason: '密码错误',
  });
}

test('同一 IP 60 秒内失败未满 10 次时不限流', () => {
  for (let i = 0; i < 9; i += 1) {
    failLogin(`user${i}`, '10.0.0.1');
  }
  const result = userStore.checkLoginRateLimit('10.0.0.1');
  assert.equal(result.limited, false);
  assert.equal(result.remainingMs, 0);
});

test('同一 IP 60 秒内失败达到 10 次时限流', () => {
  failLogin('user9', '10.0.0.1');
  const result = userStore.checkLoginRateLimit('10.0.0.1');
  assert.equal(result.limited, true);
  assert.ok(result.remainingMs > 0);
  assert.ok(result.remainingMs <= 60 * 1000);
});

test('不同 IP 的失败次数互不影响', () => {
  const result = userStore.checkLoginRateLimit('10.0.0.2');
  assert.equal(result.limited, false);
});

test('历史累计失败次数不作为限流依据', () => {
  const ip = '10.0.0.3';
  userStore.recordLoginAttempt({
    username: 'olduser',
    success: false,
    ip,
    userAgent: 'test',
    reason: '密码错误',
  });
  const logsFile = path.join(process.env.FARM_DATA_DIR, 'login-logs.json');
  const logs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));
  const old = logs.find((entry) => entry.username === 'olduser');
  old.createdAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  old.failedCount = 99;
  fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));

  const attemptsFile = path.join(process.env.FARM_DATA_DIR, 'login-attempts.json');
  const attempts = JSON.parse(fs.readFileSync(attemptsFile, 'utf8'));
  const attempt = attempts.find((entry) => entry.username === 'olduser');
  attempt.failedCount = 99;
  attempt.lastAttemptAt = old.createdAt;
  fs.writeFileSync(attemptsFile, JSON.stringify(attempts, null, 2));

  const result = userStore.checkLoginRateLimit(ip);
  assert.equal(result.limited, false);
});
