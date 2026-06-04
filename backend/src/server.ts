import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import configRoutes from "./config/routes.js";
import ingestRoutes from "./routes/ingest.js";
import wikiRoutes from "./routes/wiki.js";
import sourceRoutes from "./routes/source.js";
import investigateRoutes from "./routes/investigate.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Config routes
app.use("/api", configRoutes);

// Ingestion routes
app.use("/api", ingestRoutes);

// Wiki routes
app.use("/api", wikiRoutes);

// Source / SQLite data routes
app.use("/api", sourceRoutes);

// Investigation routes
app.use("/api", investigateRoutes);

// 404 handler — always return JSON
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler — always return JSON
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

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
