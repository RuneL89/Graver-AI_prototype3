import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import configRoutes from "./config/routes.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Config routes
app.use("/api", configRoutes);

async function startServer() {
  // Ensure DB and migrations run before accepting requests
  getDb();
  runMigrations();

  const server = app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
