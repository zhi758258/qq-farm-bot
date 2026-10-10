const crypto = require("node:crypto");

const COOKIE_NAME = "farm_access_pass";
const DEFAULT_PASS_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function defaultRandomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function normalizeIp(ip) {
  let value = String(ip || "").trim();
  if (value.startsWith("::ffff:")) value = value.slice(7);
  return value;
}

function parseCookieHeader(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function readCookie(req, name) {
  if (req && req.cookies && req.cookies[name]) return String(req.cookies[name]);
  const header = req && req.headers && req.headers.cookie;
  return parseCookieHeader(header)[name] || "";
}

function createAccessGate(options = {}) {
  const passTtlMs = Number(options.passTtlMs) > 0 ? Number(options.passTtlMs) : DEFAULT_PASS_TTL_MS;
  const challengeTtlMs =
    Number(options.challengeTtlMs) > 0 ? Number(options.challengeTtlMs) : DEFAULT_CHALLENGE_TTL_MS;
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : defaultRandomInt;
  const secret = options.secret || crypto.randomBytes(32);
  const challenges = new Map();

  function readClientIp(req) {
    const headers = req && req.headers || {};
    const cfIp = headers["cf-connecting-ip"];
    if (cfIp) return String(cfIp).trim();
    const xRealIp = headers["x-real-ip"];
    if (xRealIp) return String(xRealIp).trim();
    const xff = headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.trim()) {
      const first = xff.split(",")[0].trim();
      if (first) return first;
    }
    if (req && req.ip) return req.ip;
    if (req && req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
    return "";
  }

  function getIp(req) {
    return normalizeIp(readClientIp(req));
  }

  function pruneChallenges() {
    const ts = now();
    for (const [id, item] of challenges.entries()) {
      if (!item || item.expiresAt <= ts) challenges.delete(id);
    }
  }

  function signPass(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  function readPass(token) {
    const raw = String(token || "");
    const dot = raw.lastIndexOf(".");
    if (dot <= 0) return null;
    const body = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    try {
      return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  }

  function issuePass(ip) {
    const issuedAt = now();
    return signPass({
      ip: normalizeIp(ip),
      iat: issuedAt,
      exp: issuedAt + passTtlMs,
    });
  }

  function verifyPassToken(token, ip) {
    const payload = readPass(token);
    if (!payload || typeof payload !== "object") return false;
    if (payload.exp <= now()) return false;
    return payload.ip === normalizeIp(ip);
  }

  function isRequestPassed(req) {
    return verifyPassToken(readCookie(req, COOKIE_NAME), getIp(req));
  }

  function createChallenge(ip) {
    pruneChallenges();
    const op = randomInt(0, 1) === 0 ? "+" : "-";
    let left;
    let right;
    let answer;
    if (op === "+") {
      left = randomInt(1, 20);
      right = randomInt(1, 20);
      answer = left + right;
    } else {
      left = randomInt(1, 20);
      right = randomInt(1, left);
      answer = left - right;
    }
    const id = crypto.randomBytes(16).toString("hex");
    challenges.set(id, {
      answer,
      ip: normalizeIp(ip),
      expiresAt: now() + challengeTtlMs,
    });
    return {
      id,
      question: `${left} ${op} ${right}`,
    };
  }

  function verifyAnswer(id, answer, ip) {
    pruneChallenges();
    const challengeId = String(id || "").trim();
    const challenge = challenges.get(challengeId);
    if (!challenge) {
      return { ok: false, status: 400, error: "验证已过期，请刷新" };
    }
    challenges.delete(challengeId);
    if (challenge.expiresAt <= now()) {
      return { ok: false, status: 400, error: "验证已过期，请刷新" };
    }
    if (challenge.ip !== normalizeIp(ip)) {
      return { ok: false, status: 404, error: "Not Found" };
    }
    const numeric = Number(answer);
    if (!Number.isFinite(numeric) || numeric !== challenge.answer) {
      return { ok: false, status: 404, error: "Not Found" };
    }
    return {
      ok: true,
      token: issuePass(ip),
      maxAge: passTtlMs,
    };
  }

  function setPassCookie(res, token, maxAge, req) {
    if (!res || typeof res.cookie !== "function") return;
    const proto = req && req.headers && String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const secure = !!(req && (req.secure || proto === "https"));
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: maxAge || passTtlMs,
      secure,
    });
  }

  return {
    COOKIE_NAME,
    passTtlMs,
    getIp,
    createChallenge,
    verifyAnswer,
    issuePass,
    verifyPassToken,
    isRequestPassed,
    setPassCookie,
    readCookie,
  };
}

module.exports = {
  COOKIE_NAME,
  DEFAULT_PASS_TTL_MS,
  createAccessGate,
};
