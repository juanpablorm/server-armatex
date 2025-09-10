const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config();

const DEBUG_DB = (process.env.DEBUG_DB || "0") === "1";

const app = express();
app.set("trust proxy", 1);

const allowed = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const defaultAllowed = ["http://localhost:3000", "http://localhost:5173"];

app.use(
  cors({
    origin: allowed.length ? allowed : defaultAllowed,
  })
);

app.use(express.json());

const useSSL = (process.env.DB_SSL || "false").toLowerCase() === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST,                // ej. "aws.connect.psdb.cloud"
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,            // ej. "armatex"
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  ssl: useSSL ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
});

app.get("/", (_req, res) => res.send("OK"));              // útil para healthcheck por defecto
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get("/api/models3d", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id,
              title,
              description,
              model_src  AS modelSrc,
              poster_src AS posterSrc
       FROM models_3d
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("DB error on /api/models3d:", err.code, err.sqlMessage || err.message);
    res.status(500).json({
      error: "DB_ERROR",
      code: err.code,
      message: DEBUG_DB ? (err.sqlMessage || err.message) : undefined
    });
  }
});

app.get("/api/db/ping", async (_req, res) => {
  try {
    const [r] = await pool.query("SELECT 1 AS ok");
    res.json(r[0]); // { ok: 1 }
  } catch (e) {
    console.error("DB PING ERROR:", e.code, e.message);
    res.status(500).json({ error: "DB_PING_ERROR", code: e.code, message: DEBUG_DB ? e.message : undefined });
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "NOT_FOUND" }));

const port = process.env.PORT || 10000; // Render inyecta PORT
app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on :${port}`);
  console.log("Allowed CORS origins:", allowed.length ? allowed : defaultAllowed);
});

process.on("SIGTERM", async () => {
  try { await pool.end(); } catch {}
  process.exit(0);
});
