const PROXY_HINT_HEADERS = [
  "proxy-connection",
  "proxy-authorization",
  "proxy-agent",
  "x-proxy-id",
  "x-proxy-user-ip",
  "x-proxy-host",
  "x-bluecoat-via",
  "x-tinyproxy",
  "x-coming-from",
  "mt-proxy-id",
  "x-previously-forwarded-for",
];

function normalizeIp(ip) {
  let value = String(ip || "").trim();
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (value === "::1") return "127.0.0.1";
  return value;
}

function headerValue(headers, name) {
  const value = headers && headers[name];
  if (Array.isArray(value)) return value.find((item) => String(item || "").trim()) || "";
  return value == null ? "" : String(value);
}

function readTcpPeer(req) {
  if (req && req.socket && req.socket.remoteAddress) return normalizeIp(req.socket.remoteAddress);
  if (req && req.connection && req.connection.remoteAddress) {
    return normalizeIp(req.connection.remoteAddress);
  }
  return "";
}

function readClientIp(req) {
  const headers = (req && req.headers) || {};
  const cfIp = headerValue(headers, "cf-connecting-ip");
  if (cfIp) return normalizeIp(cfIp);
  const xRealIp = headerValue(headers, "x-real-ip");
  if (xRealIp) return normalizeIp(xRealIp);
  const xff = headerValue(headers, "x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return normalizeIp(first);
  }
  if (req && req.ip) return normalizeIp(req.ip);
  const peer = readTcpPeer(req);
  if (peer) return peer;
  return "";
}

function hasProxyHintHeader(headers) {
  const source = headers || {};
  return PROXY_HINT_HEADERS.some((name) => {
    const value = headerValue(source, name).trim();
    return value.length > 0;
  });
}

function isProxyOrVpnRequest(req) {
  const headers = (req && req.headers) || {};
  return hasProxyHintHeader(headers);
}

function sendNotFound(res) {
  if (!res || res.headersSent) return;
  res.status(404);
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("Cache-Control", "no-store");
  res.send("Not Found");
}

function createProxyVpnGuard() {
  return (req, res, next) => {
    if (isProxyOrVpnRequest(req)) {
      return sendNotFound(res);
    }
    return next();
  };
}

module.exports = {
  createProxyVpnGuard,
  isProxyOrVpnRequest,
  sendNotFound,
  readClientIp,
};
