import express, { Response } from "express";
import { PostService } from "../services/postService";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = express.Router();

// All post routes require authentication
router.use(authMiddleware);

// Create a new post
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const post = await PostService.createPost({
      title,
      content,
      authorId: req.userId,
    });

    return res.status(201).json(post);
  } catch (error: any) {
    console.error("Error creating post:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get all posts
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const posts = await PostService.getAllPosts();
    return res.status(200).json(posts);
  } catch (error: any) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get post by ID
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string);

    if (isNaN(postId)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    const post = await PostService.getPostById(postId);
    return res.status(200).json(post);
  } catch (error: any) {
    console.error("Error fetching post:", error);
    if (error.message === "Post not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get posts by current user
router.get("/user/me", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const posts = await PostService.getPostsByUser(req.userId);
    return res.status(200).json(posts);
  } catch (error: any) {
    console.error("Error fetching user posts:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update post
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string);
    const { title, content } = req.body;

    if (isNaN(postId)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const post = await PostService.updatePost(postId, req.userId, {
      title,
      content,
    });

    return res.status(200).json(post);
  } catch (error: any) {
    console.error("Error updating post:", error);
    if (error.message === "Post not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("not authorized")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete post
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string);

    if (isNaN(postId)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await PostService.deletePost(postId, req.userId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error deleting post:", error);
    if (error.message === "Post not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("not authorized")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
