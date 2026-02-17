function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return json(res, 405, {
    ok: false,
    error: "Method not allowed",
  });
}

module.exports = {
  json,
  methodNotAllowed,
};
