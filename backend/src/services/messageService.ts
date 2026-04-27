import prisma from "../db";

export interface CreateMessageData {
  content: string;
  senderId: number;
  recipientId: number;
}

// Выбираемые поля для сообщения
const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  isEdited: true,
  senderId: true,
  recipientId: true,
  sender: { select: { id: true, username: true } },
  recipient: { select: { id: true, username: true } },
};

export class MessageService {
  // Отправить сообщение
  static async sendMessage(data: CreateMessageData) {
    return prisma.message.create({
      data: {
        content: data.content,
        senderId: data.senderId,
        recipientId: data.recipientId,
      },
      select: messageSelect,
    });
  }

  // Получить переписку между двумя пользователями
  static async getMessages(userId1: number, userId2: number) {
    return prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId1, recipientId: userId2 },
          { senderId: userId2, recipientId: userId1 },
        ],
      },
      select: messageSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  // Получить список уникальных собеседников (для сайдбара)
  // Возвращает последнее сообщение с каждым уникальным пользователем
  static async getConversations(userId: number) {
    // Все сообщения где участвует пользователь
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      select: messageSelect,
      orderBy: { createdAt: "desc" },
    });

    // Дедупликация: оставляем только последнее сообщение с каждым собеседником
    const seen = new Set<number>();
    const conversations: typeof messages = [];

    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!seen.has(otherId)) {
        seen.add(otherId);
        conversations.push(msg);
      }
    }

    return conversations;
  }

  // Редактировать сообщение (только автор)
  static async editMessage(messageId: number, userId: number, content: string) {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error("Message not found");
    if (msg.senderId !== userId) throw new Error("Not authorized");

    return prisma.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      select: messageSelect,
    });
  }

  // Удалить сообщение (только автор)
  static async deleteMessage(messageId: number, userId: number) {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error("Message not found");
    if (msg.senderId !== userId) throw new Error("Not authorized");

    await prisma.message.delete({ where: { id: messageId } });
    return { id: messageId };
  }
}
