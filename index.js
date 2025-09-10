// index.js — API Armatex (Render / Railway / PlanetScale)
// Sintaxis CommonJS

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config();

const app = express();
app.set("trust proxy", 1);

// ------------ DEBUG --------------
const DEBUG_DB = (process.env.DEBUG_DB || "0") === "1";

// ------------ CORS ---------------
const whitelistEnv = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Fallbacks útiles en dev y tu dominio en producción
const fallback = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://armatex.wuaze.com",
  "https://www.armatex.wuaze.com",
];
const allowList = whitelistEnv.length ? whitelistEnv : fallback;

// Loguea el Origin entrante para depurar CORS
app.use((req, _res, next) => {
  if (req.headers.origin) console.log("Origin:", req.headers.origin);
  next();
});

app.use(
  cors({
    origin(origin, cb) {
      // Permite requests sin Origin (healthchecks/curl)
      if (!origin) return cb(null, true);
      if (allowList.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS: " + origin));
    },
    methods: ["GET", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 86400,
  })
);
// Preflight
app.options("*", cors());

// ------------ Middlewares --------
app.use(express.json());

// ------------ Config DB ----------
let host = process.env.DB_HOST;
let port = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;
let user = process.env.DB_USER;
let pass = process.env.DB_PASS;
let name = process.env.DB_NAME;

// Soporta una sola URL tipo mysql://user:pass@host:port/db si la defines
const dsn = process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL;
if ((!host || !user || !name) && dsn) {
  const u = new URL(dsn); // mysql://user:pass@host:port/db
  host = host || u.hostname;
  port = port || Number(u.port || 3306);
  user = user || decodeURIComponent(u.username);
  pass = pass || decodeURIComponent(u.password);
  name = name || u.pathname.replace(/^\//, "");
}

// SSL según proveedor (PlanetScale = true, Railway normalmente = false)
const useSSL = (process.env.DB_SSL || "false").toLowerCase() === "true";

console.log("[DB] host:", host, "port:", port || 3306, "db:", name, "ssl:", useSSL);

// Pool MySQL
const pool = mysql.createPool({
  host,
  port: port || 3306,
  user,
  password: pass,
  database: name,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 60000, // ayuda con timeouts al “despertar”
  ssl: useSSL ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
});

// ------------ Rutas --------------
app.get("/", (_req, res) => res.send("OK"));
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Diagnóstico de DB
app.get("/api/db/ping", async (_req, res) => {
  try {
    const [r] = await pool.query("SELECT 1 AS ok");
    res.json(r[0]); // { ok: 1 }
  } catch (e) {
    console.error("DB_PING_ERROR:", e.code, e.message);
    res.status(500).json({
      error: "DB_PING_ERROR",
      code: e.code,
      message: DEBUG_DB ? e.message : undefined,
    });
  }
});

// Datos para tu carrusel (tabla `models3d`)
app.get("/api/models3d", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id,
              title,
              description,
              model_src  AS modelSrc,
              poster_src AS posterSrc
       FROM models3d
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("DB error on /api/models3d:", err.code, err.sqlMessage || err.message);
    res.status(500).json({
      error: "DB_ERROR",
      code: err.code,
      message: DEBUG_DB ? (err.sqlMessage || err.message) : undefined,
    });
  }
});

// 404 para /api no definidas
app.use("/api", (_req, res) => res.status(404).json({ error: "NOT_FOUND" }));

// ------------ Start --------------
const portServer = process.env.PORT || 10000; // Render inyecta PORT
app.listen(portServer, "0.0.0.0", () => {
  console.log(`API listening on :${portServer}`);
  console.log("CORS allowList:", allowList);
});

// Cierre ordenado
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    try { await pool.end(); } catch {}
    process.exit(0);
  });
}
