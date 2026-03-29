import { Router } from "express";
import {
	login,
	refresh,
	logout,
	logoutAll,
	me,
	updateMe,
	changeMyPassword,
} from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";
import { authRateLimit } from "../middleware/rateLimiter";

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", authRateLimit, login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh", refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Public
 */
router.post("/logout", logout);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post("/logout-all", authenticateToken, logoutAll);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get("/me", authenticateToken, me);

/**
 * @route   PATCH /api/auth/me
 * @desc    Update current user's profile (name/email)
 * @access  Private
 */
router.patch("/me", authenticateToken, updateMe);

/**
 * @route   PATCH /api/auth/me/password
 * @desc    Change current user's password
 * @access  Private
 */
router.patch("/me/password", authenticateToken, changeMyPassword);

export default router;
