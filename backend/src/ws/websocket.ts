import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  username?: string;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: string;
  payload?: any;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<number, AuthenticatedWebSocket> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.initialize();
  }

  private initialize() {
    this.wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
      console.log("New WebSocket connection attempt");

      // Extract token from query string
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        ws.close(1008, "No token provided");
        return;
      }

      try {
        // Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET) as {
          userId: number;
          username: string;
        };

        ws.userId = decoded.userId;
        ws.username = decoded.username;
        ws.isAlive = true;

        // Store client connection
        this.clients.set(decoded.userId, ws);

        console.log(`User ${decoded.username} (ID: ${decoded.userId}) connected via WebSocket`);

        // Send welcome message
        this.sendToClient(ws, {
          type: "connected",
          payload: {
            message: "Connected to WebSocket server",
            userId: decoded.userId,
          },
        });

        // Broadcast user online status
        this.broadcast({
          type: "user_online",
          payload: {
            userId: decoded.userId,
            username: decoded.username,
          },
        }, decoded.userId);

        // Handle incoming messages
        ws.on("message", (data: Buffer) => {
          this.handleMessage(ws, data);
        });

        // Handle pong responses
        ws.on("pong", () => {
          ws.isAlive = true;
        });

        // Handle disconnection
        ws.on("close", () => {
          if (ws.userId) {
            console.log(`User ${ws.username} (ID: ${ws.userId}) disconnected`);
            this.clients.delete(ws.userId);

            // Broadcast user offline status
            this.broadcast({
              type: "user_offline",
              payload: {
                userId: ws.userId,
                username: ws.username,
              },
            });
          }
        });

        // Handle errors
        ws.on("error", (error) => {
          console.error("WebSocket error:", error);
        });
      } catch (error) {
        console.error("Token verification failed:", error);
        ws.close(1008, "Invalid token");
      }
    });

    // Heartbeat to detect broken connections
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on("close", () => {
      clearInterval(interval);
    });
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      console.log(`Received message from user ${ws.userId}:`, message);

      switch (message.type) {
        case "message":
          this.handleChatMessage(ws, message.payload);
          break;

        case "typing":
          this.handleTyping(ws, message.payload);
          break;

        case "post_created":
          this.handlePostCreated(ws, message.payload);
          break;

        case "post_updated":
          this.handlePostUpdated(ws, message.payload);
          break;

        case "post_deleted":
          this.handlePostDeleted(ws, message.payload);
          break;

        case "message_edited":
          this.handleMessageEdited(ws, message.payload);
          break;

        case "message_deleted":
          this.handleMessageDeleted(ws, message.payload);
          break;

        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  private handleChatMessage(ws: AuthenticatedWebSocket, payload: any) {
    const { recipientId, content } = payload;

    if (!recipientId || !content) {
      return;
    }

    // Send to recipient if online
    const recipientWs = this.clients.get(recipientId);
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      this.sendToClient(recipientWs, {
        type: "new_message",
        payload: {
          senderId: ws.userId,
          senderUsername: ws.username,
          content,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private handleTyping(ws: AuthenticatedWebSocket, payload: any) {
    const { recipientId, isTyping } = payload;

    if (!recipientId) {
      return;
    }

    const recipientWs = this.clients.get(recipientId);
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      this.sendToClient(recipientWs, {
        type: "user_typing",
        payload: {
          userId: ws.userId,
          username: ws.username,
          isTyping,
        },
      });
    }
  }

  private handlePostCreated(ws: AuthenticatedWebSocket, payload: any) {
    // Broadcast new post to all connected users
    this.broadcast({
      type: "post_created",
      payload: {
        ...payload,
        authorId: ws.userId,
        authorUsername: ws.username,
      },
    });
  }

  private handlePostUpdated(ws: AuthenticatedWebSocket, payload: any) {
    // Broadcast post update to all connected users
    this.broadcast({
      type: "post_updated",
      payload: {
        ...payload,
        authorId: ws.userId,
      },
    });
  }

  private handlePostDeleted(ws: AuthenticatedWebSocket, payload: any) {
    // Broadcast post deletion to all connected users
    this.broadcast({
      type: "post_deleted",
      payload: {
        ...payload,
        authorId: ws.userId,
      },
    });
  }

  private handleMessageEdited(ws: AuthenticatedWebSocket, payload: any) {
    const recipientWs = this.clients.get(payload.recipientId);
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      this.sendToClient(recipientWs, {
        type: "message_edited",
        payload: { id: payload.id, content: payload.content },
      });
    }
  }

  private handleMessageDeleted(ws: AuthenticatedWebSocket, payload: any) {
    const recipientWs = this.clients.get(payload.recipientId);
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      this.sendToClient(recipientWs, {
        type: "message_deleted",
        payload: { id: payload.id },
      });
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: WebSocketMessage, excludeUserId?: number) {
    this.clients.forEach((client, userId) => {
      if (userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, message);
      }
    });
  }

  // Public method to send messages from API routes
  public notifyClients(message: WebSocketMessage, targetUserId?: number) {
    if (targetUserId) {
      const client = this.clients.get(targetUserId);
      if (client) {
        this.sendToClient(client, message);
      }
    } else {
      this.broadcast(message);
    }
  }

  public getOnlineUsers(): number[] {
    return Array.from(this.clients.keys());
  }
}
