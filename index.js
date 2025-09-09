import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();
const app = express();
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:5173"] })); // Ajusta
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
});

// Endpoint de solo lectura
app.get("/api/models3d", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, title, description, model_src AS modelSrc, poster_src AS posterSrc
     FROM models_3d
     ORDER BY updated_at DESC`
  );
  res.json(rows);
});

app.listen(process.env.PORT, () =>
  console.log(`API corriendo en http://localhost:${process.env.PORT}`)
);
