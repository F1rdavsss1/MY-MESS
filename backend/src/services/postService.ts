import prisma from "../db";

export interface CreatePostData {
  title: string;
  content?: string;
  authorId: number;
}

export interface UpdatePostData {
  title?: string;
  content?: string;
}

export class PostService {
  // Create a new post
  static async createPost(data: CreatePostData) {
    const post = await prisma.post.create({
      data: {
        title: data.title,
        content: data.content,
        authorId: data.authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return post;
  }

  // Get all posts
  static async getAllPosts() {
    const posts = await prisma.post.findMany({
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    return posts;
  }

  // Get post by ID
  static async getPostById(postId: number) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!post) {
      throw new Error("Post not found");
    }

    return post;
  }

  // Get posts by user
  static async getPostsByUser(userId: number) {
    const posts = await prisma.post.findMany({
      where: { authorId: userId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    return posts;
  }

  // Update post
  static async updatePost(postId: number, userId: number, data: UpdatePostData) {
    // Check if post exists and belongs to user
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!existingPost) {
      throw new Error("Post not found");
    }

    if (existingPost.authorId !== userId) {
      throw new Error("You are not authorized to update this post");
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return updatedPost;
  }

  // Delete post
  static async deletePost(postId: number, userId: number) {
    // Check if post exists and belongs to user
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!existingPost) {
      throw new Error("Post not found");
    }

    if (existingPost.authorId !== userId) {
      throw new Error("You are not authorized to delete this post");
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    return { message: "Post deleted successfully" };
  }
}
