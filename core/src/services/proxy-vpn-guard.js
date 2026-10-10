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

const PRIVATE_CIDRS = [
  "10.0.0.0/8",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "100.64.0.0/10",
];

const DATACENTER_CIDRS = [
  "3.0.0.0/8",
  "13.32.0.0/12",
  "13.48.0.0/13",
  "13.56.0.0/14",
  "13.64.0.0/11",
  "15.0.0.0/10",
  "18.0.0.0/8",
  "23.20.0.0/14",
  "34.0.0.0/9",
  "35.0.0.0/10",
  "44.0.0.0/10",
  "52.0.0.0/10",
  "54.0.0.0/8",
  "63.32.0.0/12",
  "64.225.0.0/16",
  "65.108.0.0/16",
  "66.42.0.0/16",
  "67.205.128.0/18",
  "68.183.0.0/16",
  "70.34.0.0/16",
  "78.46.0.0/15",
  "88.198.0.0/16",
  "95.85.0.0/16",
  "95.179.0.0/16",
  "95.216.0.0/16",
  "104.131.0.0/16",
  "104.238.0.0/16",
  "108.61.0.0/16",
  "108.128.0.0/13",
  "128.140.0.0/16",
  "128.199.0.0/16",
  "134.209.0.0/16",
  "135.181.0.0/16",
  "136.243.0.0/16",
  "136.244.0.0/16",
  "137.184.0.0/16",
  "138.68.0.0/16",
  "138.197.0.0/16",
  "139.59.0.0/16",
  "139.162.0.0/16",
  "140.82.0.0/16",
  "141.147.0.0/16",
  "142.93.0.0/16",
  "143.110.0.0/16",
  "143.198.0.0/16",
  "144.76.0.0/16",
  "145.14.0.0/16",
  "146.190.0.0/16",
  "147.182.0.0/16",
  "148.251.0.0/16",
  "149.28.0.0/16",
  "152.42.0.0/16",
  "155.138.0.0/16",
  "157.90.0.0/16",
  "157.230.0.0/16",
  "157.245.0.0/16",
  "159.65.0.0/16",
  "159.69.0.0/16",
  "159.89.0.0/16",
  "159.203.0.0/16",
  "161.35.0.0/16",
  "162.55.0.0/16",
  "162.243.0.0/16",
  "164.90.0.0/16",
  "164.92.0.0/16",
  "165.22.0.0/16",
  "165.227.0.0/16",
  "167.71.0.0/16",
  "167.99.0.0/16",
  "167.172.0.0/16",
  "167.235.0.0/16",
  "168.119.0.0/16",
  "170.64.0.0/16",
  "174.138.0.0/16",
  "178.62.0.0/16",
  "178.63.0.0/16",
  "178.128.0.0/16",
  "185.65.134.0/24",
  "185.70.40.0/22",
  "185.159.156.0/22",
  "185.213.154.0/24",
  "188.40.0.0/16",
  "188.166.0.0/16",
  "193.138.218.0/24",
  "195.201.0.0/16",
  "198.199.64.0/18",
  "198.211.96.0/19",
  "206.189.0.0/16",
  "207.154.0.0/16",
  "207.246.0.0/16",
  "209.97.0.0/16",
  "212.102.0.0/16",
  "213.239.0.0/16",
  "216.238.0.0/16",
  "45.32.0.0/16",
  "45.55.0.0/16",
  "45.63.0.0/16",
  "45.76.0.0/16",
  "45.77.0.0/16",
  "45.79.0.0/16",
  "45.83.220.0/22",
  "49.12.0.0/16",
  "5.9.0.0/16",
  "5.161.0.0/16",
  "5.252.0.0/16",
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

function ipv4ToInt(ip) {
  const parts = String(ip || "").split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

function matchIpv4Cidr(ip, cidr) {
  const slash = cidr.indexOf("/");
  if (slash <= 0) return false;
  const rangeInt = ipv4ToInt(cidr.slice(0, slash));
  const ipInt = ipv4ToInt(ip);
  const bits = Number(cidr.slice(slash + 1));
  if (rangeInt == null || ipInt == null) return false;
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xFFFFFFFF : (0xFFFFFFFF << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function ipInCidrs(ip, cidrs) {
  const value = normalizeIp(ip);
  if (!value || value.includes(":")) return false;
  return cidrs.some((cidr) => matchIpv4Cidr(value, cidr));
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

function hasExtraForwardedHop(req) {
  const headers = (req && req.headers) || {};
  const xff = headerValue(headers, "x-forwarded-for").trim();
  if (!xff) return false;
  const hops = xff.split(",").map((item) => normalizeIp(item.trim())).filter(Boolean);
  if (hops.length === 0) return false;
  const cf = normalizeIp(headerValue(headers, "cf-connecting-ip"));
  if (cf && hops[0] !== cf) return true;
  const realIp = normalizeIp(headerValue(headers, "x-real-ip"));
  if (realIp && hops[0] !== realIp) return true;
  return false;
}

function isPrivateOrLocalIp(ip) {
  const value = normalizeIp(ip);
  if (!value) return true;
  if (value === "localhost") return true;
  if (value.includes(":")) {
    const lower = value.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
  }
  return ipInCidrs(value, PRIVATE_CIDRS);
}

function isDatacenterIp(ip) {
  if (isPrivateOrLocalIp(ip)) return false;
  return ipInCidrs(ip, DATACENTER_CIDRS);
}

function isProxyOrVpnRequest(req) {
  const headers = (req && req.headers) || {};
  if (hasProxyHintHeader(headers)) return true;
  if (hasExtraForwardedHop(req)) return true;
  const ip = readClientIp(req);
  if (isDatacenterIp(ip)) return true;
  return false;
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
