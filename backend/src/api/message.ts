import express, { Response } from "express";
import { MessageService } from "../services/messageService";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = express.Router();
router.use(authMiddleware);

// GET /api/messages — список чатов (уникальные собеседники + последнее сообщение)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await MessageService.getConversations(req.userId!);
    return res.status(200).json(conversations);
  } catch (e: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/messages/:userId — переписка с конкретным пользователем
router.get("/:userId", async (req: AuthRequest, res: Response) => {
  try {
    const otherId = parseInt(req.params.userId as string);
    if (isNaN(otherId)) return res.status(400).json({ error: "Invalid user ID" });

    const messages = await MessageService.getMessages(req.userId!, otherId);
    return res.status(200).json(messages);
  } catch (e: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/messages — отправить сообщение
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { recipientId, content } = req.body;
    if (!recipientId || !content)
      return res.status(400).json({ error: "recipientId and content are required" });

    const message = await MessageService.sendMessage({
      senderId: req.userId!,
      recipientId: parseInt(recipientId),
      content,
    });
    return res.status(201).json(message);
  } catch (e: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/messages/:id — редактировать сообщение
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const msgId = parseInt(req.params.id as string);
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const message = await MessageService.editMessage(msgId, req.userId!, content);
    return res.status(200).json(message);
  } catch (e: any) {
    if (e.message === "Not authorized") return res.status(403).json({ error: e.message });
    if (e.message === "Message not found") return res.status(404).json({ error: e.message });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/messages/:id — удалить сообщение
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const msgId = parseInt(req.params.id as string);
    const result = await MessageService.deleteMessage(msgId, req.userId!);
    return res.status(200).json(result);
  } catch (e: any) {
    if (e.message === "Not authorized") return res.status(403).json({ error: e.message });
    if (e.message === "Message not found") return res.status(404).json({ error: e.message });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
