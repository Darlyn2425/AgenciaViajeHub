module.exports = async function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true, service: "api", time: new Date().toISOString() }));
};
