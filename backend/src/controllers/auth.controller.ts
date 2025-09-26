import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import AsyncHandler from '../utils/AsyncHandler';
import ApiResponse from '../utils/ApiResponse';
import { getCacheKey, setCache, deleteCache, deleteCachePattern } from '../utils/redis.util';
import { generateTokenPair, verifyRefreshToken, JWTPayload } from '../utils/jwt.util';
import { TokenType, UserRole } from '@prisma/client';
import prisma from '../config/db.config';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

const SALT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

// Register new user
export const register = AsyncHandler(async (req: Request, res: Response) => {
  const { email, password, name }: RegisterRequest = req.body;

  // Validation
  if (!email || !password || !name) {
    return res.status(400).json(
      new ApiResponse(400, {}, "Email, password, and name are required", false)
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json(
      new ApiResponse(400, {}, "Invalid email format", false)
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json(
      new ApiResponse(400, {}, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, false)
    );
  }

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json(
        new ApiResponse(409, {}, "User already exists", false)
      );
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: UserRole.USER
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    // Generate tokens
    const tokenPayload: JWTPayload = {
      userId: user.id,
      role: user.role,
      email: user.email
    };
    const tokens = generateTokenPair(tokenPayload);

    // Store refresh token
    await prisma.token.create({
      data: {
        token: tokens.refreshToken,
        type: TokenType.REFRESH,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userId: user.id
      }
    });

    // Cache user data
    await setCache(getCacheKey("user", user.id), user, 3600);

    return res.status(201).json(
      new ApiResponse(201, {
        user,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }, "Registration successful", true)
    );

  } catch (error: any) {
    console.error("Register error:", error);
    
    if (error.code === 'P2002') {
      return res.status(409).json(
        new ApiResponse(409, {}, "User already exists", false)
      );
    }

    return res.status(500).json(
      new ApiResponse(500, {}, "Registration failed", false)
    );
  }
});

// Login user
export const login = AsyncHandler(async (req: Request, res: Response) => {
  const { email, password }: LoginRequest = req.body;

  if (!email || !password) {
    return res.status(400).json(
      new ApiResponse(400, {}, "Email and password are required", false)
    );
  }

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Invalid credentials", false)
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Invalid credentials", false)
      );
    }

    // Generate tokens
    const tokenPayload: JWTPayload = {
      userId: user.id,
      role: user.role,
      email: user.email
    };
    const tokens = generateTokenPair(tokenPayload);

    // Store refresh token
    await prisma.token.create({
      data: {
        token: tokens.refreshToken,
        type: TokenType.REFRESH,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userId: user.id
      }
    });

    // Cache user data (without password)
    const { password: _, ...userWithoutPassword } = user;
    await setCache(getCacheKey("user", user.id), userWithoutPassword, 3600);

    return res.status(200).json(
      new ApiResponse(200, {
        user: userWithoutPassword,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }, "Login successful", true)
    );

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Login failed", false)
    );
  }
});

// Refresh access token
export const refreshToken = AsyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token }: RefreshTokenRequest = req.body;

  if (!token) {
    return res.status(400).json(
      new ApiResponse(400, {}, "Refresh token is required", false)
    );
  }

  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(token);

    // Check if token exists and is valid
    const storedToken = await prisma.token.findFirst({
      where: {
        token,
        type: TokenType.REFRESH,
        isUsed: false,
        expiresAt: { gte: new Date() }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true
          }
        }
      }
    });

    if (!storedToken || !storedToken.user.isActive) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Invalid or expired refresh token", false)
      );
    }

    // Mark current token as used
    await prisma.token.update({
      where: { id: storedToken.id },
      data: { isUsed: true }
    });

    // Generate new tokens
    const tokenPayload: JWTPayload = {
      userId: storedToken.user.id,
      role: storedToken.user.role,
      email: storedToken.user.email
    };
    const newTokens = generateTokenPair(tokenPayload);

    // Store new refresh token
    await prisma.token.create({
      data: {
        token: newTokens.refreshToken,
        type: TokenType.REFRESH,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userId: storedToken.user.id
      }
    });

    return res.status(200).json(
      new ApiResponse(200, {
        user: storedToken.user,
        token: newTokens.accessToken,
        refreshToken: newTokens.refreshToken
      }, "Token refreshed successfully", true)
    );

  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(401).json(
      new ApiResponse(401, {}, "Invalid refresh token", false)
    );
  }
});

// Logout user
export const logout = AsyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id; // Non-null assertion since middleware guarantees user exists

  try {
    // Invalidate all refresh tokens
    await prisma.token.updateMany({
      where: {
        userId,
        type: TokenType.REFRESH,
        isUsed: false
      },
      data: { isUsed: true }
    });

    // Clear cache
    await deleteCache(getCacheKey("user", userId));

    return res.status(200).json(
      new ApiResponse(200, {}, "Logout successful", true)
    );

  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Logout failed", false)
    );
  }
});

// Get user profile
export const getProfile = AsyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id; // Non-null assertion since middleware guarantees user exists

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json(
        new ApiResponse(404, {}, "User not found", false)
      );
    }

    return res.status(200).json(
      new ApiResponse(200, user, "Profile retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Failed to retrieve profile", false)
    );
  }
});

// Change password
export const changePassword = AsyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id; // Non-null assertion since middleware guarantees user exists
  const { currentPassword, newPassword }: ChangePasswordRequest = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json(
      new ApiResponse(400, {}, "Current and new password are required", false)
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json(
      new ApiResponse(400, {}, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`, false)
    );
  }

  try {
    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true }
    });

    if (!user) {
      return res.status(404).json(
        new ApiResponse(404, {}, "User not found", false)
      );
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Current password is incorrect", false)
      );
    }

    // Update password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    // Invalidate all refresh tokens
    await prisma.token.updateMany({
      where: {
        userId,
        type: TokenType.REFRESH,
        isUsed: false
      },
      data: { isUsed: true }
    });

    // Clear user cache
    await deleteCache(getCacheKey("user", userId));

    return res.status(200).json(
      new ApiResponse(200, {}, "Password changed successfully", true)
    );

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Failed to change password", false)
    );
  }
});