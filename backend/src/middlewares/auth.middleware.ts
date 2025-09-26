import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../utils/jwt.util';
import { getCacheKey, getCache, setCache } from '../utils/redis.util';
import ApiResponse from '../utils/ApiResponse';
import { UserRole } from '@prisma/client';
import prisma from '../config/db.config';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email: string;
  };
}

// Type for requests that have been authenticated (user is guaranteed to exist)
export interface AuthorizedRequest extends Request {
  user: {
    id: string;
    role: UserRole;
    email: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Access token is required", false)
      );
    }

    // Verify JWT token
    let decoded: JWTPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch (error: any) {
      const message = error.name === 'TokenExpiredError' 
        ? "Access token has expired" 
        : "Invalid access token";
      
      return res.status(401).json(
        new ApiResponse(401, {}, message, false)
      );
    }

    // Check user in cache first
    const userCacheKey = getCacheKey("user", decoded.userId);
    let user = await getCache<any>(userCacheKey);

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true
        }
      });

      if (!user || !user.isActive) {
        return res.status(401).json(
          new ApiResponse(401, {}, "User not found or inactive", false)
        );
      }

      // Cache user for 1 hour
      await setCache(userCacheKey, user, 3600);
    }

    // Attach user to request
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      email: decoded.email
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Authentication failed", false)
    );
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    return res.status(403).json(
      new ApiResponse(403, {}, "Admin access required", false)
    );
  }
  next();
};

export const requireUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || ![UserRole.USER, UserRole.ADMIN].includes(req.user.role)) {
    return res.status(403).json(
      new ApiResponse(403, {}, "User access required", false)
    );
  }
  next();
};