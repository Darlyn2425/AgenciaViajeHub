async function readJsonBody(req) {
  if (req && typeof req.body === "object" && req.body !== null) {
    return req.body;
  }
  if (req && typeof req.body === "string") {
    const rawFromBody = req.body.trim();
    if (!rawFromBody) return {};
    try {
      return JSON.parse(rawFromBody);
    } catch {
      throw new Error("Invalid JSON body");
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

module.exports = {
  readJsonBody,
};
