function createProxyVpnGuard() {
  return (_req, _res, next) => next();
}

function isProxyOrVpnRequest() {
  return false;
}

module.exports = {
  createProxyVpnGuard,
  isProxyOrVpnRequest,
};
