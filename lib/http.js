const { applyApiSecurityHeaders } = require("./security");

function json(req, res, statusCode, payload) {
  applyApiSecurityHeaders(req, res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(req, res, allowed) {
  applyApiSecurityHeaders(req, res);
  res.setHeader("Allow", allowed.join(", "));
  return json(req, res, 405, {
    ok: false,
    error: "Method not allowed",
  });
}

module.exports = {
  json,
  methodNotAllowed,
};
