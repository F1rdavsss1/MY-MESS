import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { postsAPI } from '../services/api';
import wsService from '../services/websocket';
import '../styles/posts.css';

const Posts = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', content: '' });
  const [editingPost, setEditingPost] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // WebSocket: listen for real-time post events
  useEffect(() => {
    if (!token) return;
    wsService.connect(token);

    const unsubCreated = wsService.on('post_created', (payload) => {
      setPosts((prev) => [payload, ...prev]);
    });
    const unsubUpdated = wsService.on('post_updated', (payload) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === payload.id ? { ...p, ...payload } : p))
      );
    });
    const unsubDeleted = wsService.on('post_deleted', (payload) => {
      setPosts((prev) => prev.filter((p) => p.id !== payload.id));
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, [token]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data } = await postsAPI.getAll();
      setPosts(data);
    } catch (err) {
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingPost) {
        const { data } = await postsAPI.update(editingPost.id, form);
        setPosts((prev) => prev.map((p) => (p.id === data.id ? data : p)));
        // Notify others via WS
        wsService.send('post_updated', data);
        setEditingPost(null);
      } else {
        const { data } = await postsAPI.create(form);
        setPosts((prev) => [data, ...prev]);
        // Notify others via WS
        wsService.send('post_created', data);
      }
      setForm({ title: '', content: '' });
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save post');
    }
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setForm({ title: post.title, content: post.content || '' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await postsAPI.delete(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      // Notify others via WS
      wsService.send('post_deleted', { id: postId });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleCancel = () => {
    setEditingPost(null);
    setForm({ title: '', content: '' });
    setShowForm(false);
    setError('');
  };

  const handleLogout = () => {
    wsService.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="posts-page">
      {/* Top nav */}
      <header className="posts-header">
        <div className="posts-header-left">
          <Link to="/messenger" className="nav-link">← Messenger</Link>
          <h1>Posts</h1>
        </div>
        <div className="posts-header-right">
          <span className="username-label">{user.username}</span>
          <button
            className="btn-primary"
            onClick={() => { setShowForm(true); setEditingPost(null); setForm({ title: '', content: '' }); }}
          >
            + New Post
          </button>
          <button className="btn-icon" onClick={handleLogout} title="Logout">✕</button>
        </div>
      </header>

      <div className="posts-content">
        {/* Create / Edit form */}
        {showForm && (
          <div className="post-form card">
            <h3>{editingPost ? 'Edit Post' : 'New Post'}</h3>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Post title"
                  required
                />
              </div>
              <div className="input-group">
                <label>Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Write something..."
                  rows={4}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingPost ? 'Save Changes' : 'Publish'}
                </button>
                <button type="button" className="btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Posts list */}
        {loading ? (
          <p className="empty-hint">Loading posts...</p>
        ) : posts.length === 0 ? (
          <p className="empty-hint">No posts yet. Be the first!</p>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <div key={post.id} className="post-card card">
                <div className="post-meta">
                  <div className="avatar small">{post.author?.username?.[0]?.toUpperCase()}</div>
                  <span className="post-author">{post.author?.username}</span>
                </div>
                <h2 className="post-title">{post.title}</h2>
                {post.content && <p className="post-content">{post.content}</p>}
                {post.authorId === user.id && (
                  <div className="post-actions">
                    <button className="btn-edit" onClick={() => handleEdit(post)}>Edit</button>
                    <button className="btn-delete" onClick={() => handleDelete(post.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Posts;
