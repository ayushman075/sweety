import jwt, { Secret, SignOptions, JwtPayload } from "jsonwebtoken";
import { UserRole } from "@prisma/client";

export interface JWTPayload extends JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not defined`);
  return value;
};

const JWT_SECRET: Secret = getEnv("JWT_SECRET");
const JWT_REFRESH_SECRET: Secret = getEnv("JWT_REFRESH_SECRET");
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";


const accessOptions: SignOptions = {
  issuer: "sweetshop-api",
  audience: "sweetshop-users",
  expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
};

const refreshOptions: SignOptions = {
  issuer: "sweetshop-api",
  audience: "sweetshop-users",
  expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
};

export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, accessOptions);
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId, type: "refresh" }, JWT_REFRESH_SECRET, refreshOptions);
};


export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

export const verifyRefreshToken = (
  token: string
): { userId: string; type: string } => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as {
    userId: string;
    type: string;
  };
};

export const generateTokenPair = (payload: JWTPayload): TokenPair => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload.userId),
  };
};
