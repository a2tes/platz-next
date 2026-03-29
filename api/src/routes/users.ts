import { Router } from "express";
import { UsersController } from "../controllers/usersController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

// All user management endpoints are admin-only
router.use(authenticateToken, requireAdmin);

// GET /api/users - list users
router.get("/", UsersController.getUsers);

// POST /api/users - create user
router.post("/", UsersController.createUser);

// PATCH /api/users/:id - update user (name/email/role)
router.patch("/:id", UsersController.updateUser);

// PATCH /api/users/:id/status - set status (DRAFT/PUBLISHED)
router.patch("/:id/status", UsersController.updateUserStatus);

// GET /api/users/trash - list soft-deleted users
router.get("/trash", UsersController.getTrashed);

// PATCH /api/users/:id/restore - restore soft-deleted user
router.patch("/:id/restore", UsersController.restore);

// DELETE /api/users/:id - soft delete user
router.delete("/:id", UsersController.deleteUser);

export default router;
