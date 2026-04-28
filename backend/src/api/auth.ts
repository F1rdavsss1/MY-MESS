import express, { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { authMiddleware, AuthRequest } from "../middleware/auth";

interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

const router = express.Router();

// Register new user
router.post(
  "/register",
  async function (req: Request<{}, {}, RegisterBody>, res: Response) {
    try {
      const { username, email, password } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ 
          error: "Email, username, and password are required" 
        });
      }

      const result = await AuthService.register({ username, email, password });

      return res.status(201).json(result);
    } catch (e: any) {
      console.error("Registration error:", e);
      return res.status(400).json({ 
        error: e.message || "Registration failed" 
      });
    }
  }
);

// Login user
router.post(
  "/login", 
  async function (req: Request<{}, {}, LoginBody>, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          error: "Email and password are required" 
        });
      }

      const result = await AuthService.login({ email, password });

      return res.status(200).json(result);
    } catch (e: any) {
      console.error("Login error:", e);
      return res.status(401).json({ 
        error: e.message || "Login failed" 
      });
    }
  }
);

// Logout user
router.post("/logout", async function (req: Request, res: Response) {
  try {
    return res.status(200).json({ 
      message: "Logged out successfully" 
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user
router.get("/me", authMiddleware, async function (req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await AuthService.getUserById(req.userId);

    return res.status(200).json({ user });
  } catch (e: any) {
    console.error("Get user error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users
router.get("/", async function (req: Request, res: Response) {
  try {
    const users = await AuthService.getAllUsers();
    return res.status(200).json({ users });
  } catch (e: any) {
    console.error("Get users error:", e);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Delete user
router.delete("/:id", async function (req: Request, res: Response) {
  try {
    const userId = Number(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const deletedUser = await AuthService.deleteUser(userId);

    return res.status(200).json({
      message: "User deleted successfully",
      user: deletedUser
    });
  } catch (e: any) {
    console.error("Delete user error:", e);
    return res.status(500).json({ error: e.message || "Failed to delete user" });
  }
});

export default router;