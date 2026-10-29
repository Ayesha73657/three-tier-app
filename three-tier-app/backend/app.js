
const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const port = 3000;

app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "taskuser",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "taskdb",
  waitForConnections: true,
  connectionLimit: 10
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/tasks", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, title FROM tasks ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch tasks failed:", err.message);
    res.status(503).json({ error: "Database temporarily unavailable" });
  }
});

app.post("/api/tasks", async (req, res) => {
  const title = typeof req.body.title === "string"
    ? req.body.title.trim()
    : "";

  if (!title || title.length > 200) {
    return res.status(400).json({
      error: "Task title must contain 1–200 characters"
    });
  }

  try {
    const [result] = await pool.execute(
      "INSERT INTO tasks (title) VALUES (?)",
      [title]
    );

    res.status(201).json({ id: result.insertId, title });
  } catch (err) {
    console.error("Create task failed:", err.message);
    res.status(503).json({ error: "Database temporarily unavailable" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid task ID" });
  }

  try {
    const [result] = await pool.execute(
      "DELETE FROM tasks WHERE id = ?",
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.status(204).end();
  } catch (err) {
    console.error("Delete task failed:", err.message);
    res.status(503).json({ error: "Database temporarily unavailable" });
  }
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port}`);
});

async function shutdown() {
  server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
