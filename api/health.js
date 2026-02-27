const { json, methodNotAllowed } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }
  return json(req, res, 200, { ok: true, service: "api", time: new Date().toISOString() });
};
