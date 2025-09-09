const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json());

// Healthcheck para Render
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ... tus rutas /api/models3d etc.

const port = process.env.PORT || 4000; // Render inyecta PORT
app.listen(port, () => console.log(`API on :${port}`));
