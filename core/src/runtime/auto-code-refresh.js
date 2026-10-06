const { createScheduler } = require('../services/scheduler');
const wxLoginAdapter = require('../services/wx-login-adapter');

function createAutoCodeRefreshService(deps) {
  const {
    getAccounts,
    addOrUpdateAccount,
    resolveWorkerControls,
    log,
    addAccountLog,
  } = deps;

  const scheduler = createScheduler('auto_code_refresh');
  const recoveryState = new Map();
  const MAX_DAILY_RECOVERIES = 8;
  const MAX_CONSECUTIVE_FAILURES = 3;

  function getRecoveryState(accountId) {
    const date = new Date().toISOString().slice(0, 10);
    const current = recoveryState.get(String(accountId));
    if (!current || current.date !== date) {
      const fresh = { date, attempts: 0, failures: 0 };
      recoveryState.set(String(accountId), fresh);
      return fresh;
    }
    return current;
  }

  function isRecoveryReason(reason) {
    return ['ws_400', 'kickout:', 'ws_reconnect_failed:', 'refresh_failed']
      .some(prefix => String(reason || '').includes(prefix));
  }

  function getTaskName(accountId) {
    return `refresh_${  String(accountId || '')}`;
  }

  function getKeepaliveTaskName(accountId) {
    return `wx_keepalive_${String(accountId || '')}`;
  }

  function findAccount(accountId) {
    const data = getAccounts();
    const accounts = Array.isArray(data && data.accounts) ? data.accounts : [];
    return accounts.find(acc => String(acc.id) === String(accountId));
  }

  async function requestFarmCode(account) {
    const wxid = String(account && account.wxid || '').trim();
    if (!wxid) throw new Error('账号缺少 wxid，无法刷新 Code');

    if (!account.loginBuffer) throw new Error('账号缺少应用宝登录凭据，请重新扫码登录');
    if (account.refreshtoken) {
      const keepalive = await wxLoginAdapter.keepWxCredentialAlive(account);
      if (!keepalive.Success) throw new Error(keepalive.Message || '微信凭证续期失败');
    }
    const local = await wxLoginAdapter.getFarmCode(wxid, { accountId: account.id });
    if (local.Success && local.Data && local.Data.code) return String(local.Data.code);
    throw new Error(local.Message || '进程内获取 Code 失败');
  }

  async function refreshAccountCode(accountId, reason = 'timer') {
    const account = findAccount(accountId);
    if (!account) return false;

    const recovery = isRecoveryReason(reason) ? getRecoveryState(accountId) : null;
    if (recovery && (recovery.attempts >= MAX_DAILY_RECOVERIES
      || recovery.failures >= MAX_CONSECUTIVE_FAILURES)) {
      addAccountLog('auto_relogin_blocked', '自动重登已熔断，请检查网络或重新扫码',
        account.id, account.name, { reason, ...recovery });
      return false;
    }
    if (recovery) recovery.attempts += 1;

    try {
      const code = await requestFarmCode(account);
      const nextAccount = { ...account, code };
      addOrUpdateAccount(nextAccount);

      const controls = typeof resolveWorkerControls === 'function' ? (resolveWorkerControls() || {}) : {};
      if (typeof controls.restartWorker === 'function') controls.restartWorker(nextAccount);

      addAccountLog('auto_code_refresh', `刷新 Code 成功，已重启账号: ${  account.name}`,
        account.id, account.name, { reason });
      log('系统', `刷新 Code 成功: ${  account.name}`, {
        accountId: String(account.id),
        accountName: account.name,
      });
      if (recovery) recovery.failures = 0;
      return true;
    } catch (err) {
      if (recovery) recovery.failures += 1;
      addAccountLog('auto_code_refresh_failed', `刷新 Code 失败: ${  err.message}`,
        account.id, account.name, { reason });
      log('错误', `刷新 Code 失败: ${  account.name  } - ${  err.message}`, {
        accountId: String(account.id),
        accountName: account.name,
      });
      return false;
    }
  }

  function scheduleAccount(accountId) {
    scheduler.clear(getTaskName(accountId));
    scheduler.clear(getKeepaliveTaskName(accountId));
    scheduler.clear(`relogin_${String(accountId || '')}`);

    const account = findAccount(accountId);
    if (!account || account.platform !== 'wx') return;

    if (!String(account.wxid || '').trim()) {
      log('系统', '微信凭证保活未启动: 账号缺少 wxid', {
        accountId: String(accountId),
        accountName: account.name || '',
      });
      return;
    }

    if (account.loginBuffer && account.refreshtoken) {
      scheduler.setIntervalTask(getKeepaliveTaskName(accountId), 30 * 60000, async () => {
        const latest = findAccount(accountId);
        if (!latest) return;
        const result = await wxLoginAdapter.keepWxCredentialAlive(latest);
        if (!result.Success) {
          log('错误', `微信凭证保活失败: ${latest.name} - ${result.Message || '未知错误'}`, {
            accountId: String(accountId), accountName: latest.name,
          });
        }
      }, { preventOverlap: true });
    }
  }

  function rescheduleAll() {
    scheduler.clearAll();
    const data = getAccounts();
    const accounts = Array.isArray(data && data.accounts) ? data.accounts : [];
    for (const account of accounts) {
      scheduleAccount(account.id);
    }
  }

  function stopAccount(accountId) {
    scheduler.clear(getTaskName(accountId));
    scheduler.clear(getKeepaliveTaskName(accountId));
    scheduler.clear(`relogin_${String(accountId || '')}`);
  }

  return {
    refreshAccountCode,
    scheduleAccount,
    rescheduleAll,
    stopAccount,
  };
}

module.exports = { createAutoCodeRefreshService };
