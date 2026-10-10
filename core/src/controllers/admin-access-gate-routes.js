function registerAdminAccessGateRoutes({ app, accessGate }) {
  app.get("/api/access-gate/status", (req, res) => {
    res.json({
      ok: true,
      passed: accessGate.isRequestPassed(req),
    });
  });

  app.get("/api/access-gate/challenge", (req, res) => {
    if (accessGate.isRequestPassed(req)) {
      return res.json({ ok: true, passed: true });
    }
    const challenge = accessGate.createChallenge(accessGate.getIp(req));
    return res.json({
      ok: true,
      passed: false,
      data: {
        id: challenge.id,
        type: challenge.type,
        prompt: challenge.prompt,
        question: challenge.question,
        tiles: challenge.tiles,
        target: challenge.target,
        pieces: challenge.pieces,
        slot: challenge.slot,
      },
    });
  });

  app.post("/api/access-gate/verify", (req, res) => {
    const { id, answer } = req.body || {};
    const result = accessGate.verifyAnswer(id, answer, accessGate.getIp(req));
    if (!result.ok) {
      return res.status(result.status || 404).json({
        ok: false,
        error: result.error || "Not Found",
      });
    }
    accessGate.setPassCookie(res, result.token, result.maxAge, req);
    return res.json({ ok: true, passed: true });
  });
}

function createAccessGateApiGuard(accessGate) {
  return (req, res, next) => {
    if (req.method === "OPTIONS") return next();
    if (req.path === "/health" || req.path.startsWith("/access-gate")) return next();
    if (accessGate.isRequestPassed(req)) return next();
    return res.status(403).json({
      ok: false,
      error: "请先完成访问验证",
      code: "ACCESS_GATE",
    });
  };
}

module.exports = {
  registerAdminAccessGateRoutes,
  createAccessGateApiGuard,
};
