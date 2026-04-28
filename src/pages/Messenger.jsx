import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { messageAPI } from '../services/api';
import wsService from '../services/websocket';
import '../styles/messenger.css';

// Цвета аватарок как в Telegram
const AVATAR_COLORS = [
  ['#FF6B6B', '#FF8E53'],
  ['#4ECDC4', '#44A08D'],
  ['#A8EDEA', '#FED6E3'],
  ['#667EEA', '#764BA2'],
  ['#F093FB', '#F5576C'],
  ['#4FACFE', '#00F2FE'],
  ['#43E97B', '#38F9D7'],
  ['#FA709A', '#FEE140'],
  ['#A18CD1', '#FBC2EB'],
  ['#FD746C', '#FF9068'],
];

function getAvatarColors(name = '') {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function Avatar({ username, size = 46, showBadge = false }) {
  const letter = (username || '?')[0].toUpperCase();
  const [from, to] = getAvatarColors(username);
  return (
    <div
      className="tg-avatar"
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.4,
      }}
    >
      {letter}
      {showBadge && <span className="online-badge" />}
    </div>
  );
}

// Тестовый чат 
const DEMO_CHAT = {
  id: '__demo__',
  senderId: 0,
  recipientId: 0,
  sender: { id: 0, username: 'Support Bot' },
  recipient: { id: 0, username: 'Support Bot' },
  content: 'Привет! Это тестовый чат 👋',
  createdAt: new Date().toISOString(),
  isDemo: true,
};

const DEMO_MESSAGES = [
  { id: 1, senderId: 0, content: 'Привет! Это тестовый чат 👋', createdAt: new Date(Date.now() - 60000).toISOString(), isEdited: false },
  { id: 2, senderId: 0, content: 'Попробуй отправить сообщение!', createdAt: new Date().toISOString(), isEdited: false },
];

export default function Messenger() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // userId или '__demo__'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMsg, setEditingMsg] = useState(null); // { id, content }
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);

  // WebSocket 
  useEffect(() => {
    if (!token) return;
    wsService.connect(token);

    const u1 = wsService.on('connected', () => setWsConnected(true));

    const u2 = wsService.on('new_message', (payload) => {
      setConversations((prev) => {
        // Обновляем превью последнего сообщения в сайдбаре
        const exists = prev.find(
          (c) => !c.isDemo && (c.senderId === payload.senderId || c.recipientId === payload.senderId)
        );
        if (exists) {
          return prev.map((c) =>
            c === exists ? { ...c, content: payload.content } : c
          );
        }
        return prev;
      });
      // Добавляем в открытый чат
      setSelectedId((curId) => {
        if (curId === payload.senderId) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              senderId: payload.senderId,
              content: payload.content,
              createdAt: payload.timestamp,
              isEdited: false,
              sender: { id: payload.senderId, username: payload.senderUsername },
            },
          ]);
        }
        return curId;
      });
    });

    const u3 = wsService.on('message_edited', (payload) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.id ? { ...m, content: payload.content, isEdited: true } : m))
      );
    });

    const u4 = wsService.on('message_deleted', (payload) => {
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
    });

    const u5 = wsService.on('user_typing', (payload) => {
      setTypingUsers((prev) => ({ ...prev, [payload.userId]: payload.isTyping ? payload.username : null }));
    });

    const u6 = wsService.on('user_online', (p) =>
      setOnlineUsers((prev) => [...new Set([...prev, p.userId])])
    );
    const u7 = wsService.on('user_offline', (p) =>
      setOnlineUsers((prev) => prev.filter((id) => id !== p.userId))
    );

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); wsService.disconnect(); };
  }, [token]);

  // Scroll to bottom 
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations 
  const loadConversations = async () => {
    try {
      const { data } = await messageAPI.getAll();
      setConversations(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  // Load messages when chat selected 
  useEffect(() => {
    if (!selectedId || selectedId === '__demo__') {
      if (selectedId === '__demo__') setMessages(DEMO_MESSAGES);
      return;
    }
    setLoading(true);
    messageAPI.getWithUser(selectedId)
      .then(({ data }) => setMessages(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedId]);

  //  Helpers 
  const getOtherUser = (conv) => {
    if (!conv || conv.isDemo) return { id: 0, username: 'Support Bot' };
    return conv.senderId === user.id ? conv.recipient : conv.sender;
  };

  const selectedConv = selectedId === '__demo__'
    ? DEMO_CHAT
    : conversations.find((c) => {
        const other = getOtherUser(c);
        return other.id === selectedId;
      });

  const selectedUser = getOtherUser(selectedConv);

  // Send / Edit 
  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return;

    if (editingMsg) {
      // Редактирование
      setMessages((prev) =>
        prev.map((m) => (m.id === editingMsg.id ? { ...m, content: text, isEdited: true } : m))
      );
      setEditingMsg(null);
      setNewMessage('');
      try {
        const { data } = await messageAPI.edit(editingMsg.id, text);
        setMessages((prev) => prev.map((m) => (m.id === data.id ? data : m)));
        wsService.send('message_edited', { id: data.id, content: data.content, recipientId: selectedId });
      } catch (err) {
        console.error(err);
      }
      return;
    }

    if (selectedId === '__demo__') {
      // В демо-чате просто добавляем локально
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), senderId: user.id, content: text, createdAt: new Date().toISOString(), isEdited: false },
      ]);
      setNewMessage('');
      return;
    }

    // Оптимистичное добавление
    const optimistic = {
      id: `opt_${Date.now()}`,
      senderId: user.id,
      content: text,
      createdAt: new Date().toISOString(),
      isEdited: false,
      sender: { id: user.id, username: user.username },
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage('');

    try {
      const { data } = await messageAPI.send({ recipientId: selectedId, content: text });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data : m)));
      wsService.send('message', { recipientId: selectedId, content: text });
      loadConversations();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      console.error(err);
    }
  };

  const startEdit = (msg) => {
    setEditingMsg(msg);
    setNewMessage(msg.content);
    inputRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setNewMessage('');
  };

  const handleDelete = async (msgId) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      await messageAPI.delete(msgId);
      wsService.send('message_deleted', { id: msgId, recipientId: selectedId });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTyping = () => {
    if (!selectedId || selectedId === '__demo__') return;
    wsService.send('typing', { recipientId: selectedId, isTyping: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      wsService.send('typing', { recipientId: selectedId, isTyping: false });
    }, 1500);
  };

  const handleLogout = () => {
    wsService.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const typingLabel = selectedId && typingUsers[selectedId]
    ? `${typingUsers[selectedId]} печатает...`
    : null;

  // Список чатов: реальные + демо если пусто
  const chatList = conversations.length > 0 ? conversations : [DEMO_CHAT];

  return (
    <div className="messenger-container">
      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-user">
            <Avatar username={user.username} size={36} />
            <span className="username-label">{user.username}</span>
            <span className={`ws-dot ${wsConnected ? 'online' : 'offline'}`} title={wsConnected ? 'Online' : 'Offline'} />
          </div>
          <div className="sidebar-actions">
            <Link to="/posts" className="nav-link">Posts</Link>
            <button className="btn-icon" onClick={handleLogout} title="Logout">✕</button>
          </div>
        </div>

        <div className="chat-list">
          {chatList.map((conv) => {
            const other = getOtherUser(conv);
            const isActive = conv.isDemo ? selectedId === '__demo__' : selectedId === other.id;
            return (
              <div
                key={conv.isDemo ? '__demo__' : conv.id}
                className={`chat-item ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedId(conv.isDemo ? '__demo__' : other.id)}
              >
                <Avatar
                  username={other.username}
                  size={50}
                  showBadge={!conv.isDemo && onlineUsers.includes(other.id)}
                />
                <div className="chat-info">
                  <h4>{other.username}</h4>
                  <p>{conv.content?.slice(0, 42)}{conv.content?.length > 42 ? '…' : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Chat area ── */}
      {selectedId ? (
        <div className="chat-area">
          <div className="chat-header">
            <Avatar
              username={selectedUser.username}
              size={40}
              showBadge={!selectedConv?.isDemo && onlineUsers.includes(selectedUser.id)}
            />
            <div className="chat-header-info">
              <h3>{selectedUser.username}</h3>
              {typingLabel
                ? <span className="typing-indicator">{typingLabel}</span>
                : !selectedConv?.isDemo && onlineUsers.includes(selectedUser.id)
                  ? <span className="online-text">онлайн</span>
                  : null
              }
            </div>
          </div>

          <div className="messages-container">
            {loading ? (
              <p className="empty-hint">Загрузка...</p>
            ) : messages.length === 0 ? (
              <p className="empty-hint">Нет сообщений. Напиши первым!</p>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === user.id;
                return (
                  <div key={msg.id} className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
                    {!isMine && (
                      <Avatar username={selectedUser.username} size={28} />
                    )}
                    <div className={`message ${isMine ? 'sent' : 'received'}`}>
                      <p>{msg.content}</p>
                      <div className="message-footer">
                        {msg.isEdited && <span className="edited-label">изменено</span>}
                        <span className="time">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {/* Кнопки edit/delete только для своих и не в демо */}
                      {isMine && !selectedConv?.isDemo && (
                        <div className="message-actions">
                          <button onClick={() => startEdit(msg)} title="Редактировать">✏️</button>
                          <button onClick={() => handleDelete(msg.id)} title="Удалить">🗑️</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="message-input-container" onSubmit={handleSubmit}>
            {editingMsg && (
              <div className="edit-banner">
                <span>✏️ Редактирование</span>
                <button type="button" className="cancel-edit" onClick={cancelEdit}>✕</button>
              </div>
            )}
            <div className="input-row">
              <input
                ref={inputRef}
                type="text"
                className="message-input"
                placeholder="Написать сообщение..."
                value={newMessage}
                onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
              />
              <button type="submit" className="send-button" disabled={!newMessage.trim()}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="chat-area chat-placeholder">
          <h3>Выбери чат</h3>
          <p>или перейди в <Link to="/posts" className="link">Posts</Link></p>
        </div>
      )}
    </div>
  );
}
