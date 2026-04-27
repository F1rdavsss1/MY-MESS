import express from "express";
import cors from "cors";
import http from "http";

import authRouter from "./api/auth";
import messageRouter from "./api/message";
import postsRouter from "./api/posts";
import { WebSocketManager } from "./ws/websocket";

const app = express();

app.use(express.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/messages", messageRouter);
app.use("/api/posts", postsRouter);

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Create HTTP server (needed for WebSocket)
const server = http.createServer(app);

// Initialize WebSocket manager
export const wsManager = new WebSocketManager(server);

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`HTTP server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
});
