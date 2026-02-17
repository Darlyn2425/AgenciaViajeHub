const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "brianessa_travel_hub";

let client;
let clientPromise;

function getClient() {
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }

  if (!clientPromise) {
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

async function getDb() {
  const connectedClient = await getClient();
  return connectedClient.db(dbName);
}

module.exports = {
  getClient,
  getDb,
};
