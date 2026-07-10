import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";
const TEMPORARY_TOKEN_EXPIRY_MINUTES = Number(process.env.TEMPORARY_TOKEN_EXPIRY_MINUTES || 20);

export const generateAccessToken = (userId: string): string => {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET is not set");
  }
  return jwt.sign({ id: userId }, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY as any,
  });
};

export const generateRefreshToken = (userId: string): string => {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  if (!secret) {
    throw new Error("REFRESH_TOKEN_SECRET is not set");
  }
  return jwt.sign({ id: userId }, secret, {
    expiresIn: REFRESH_TOKEN_EXPIRY as any,
  });
};

export interface TemporaryTokenResult {
  unHashedToken: string;
  hashedToken: string;
  tokenExpiry: Date;
}

export const generateTemporaryToken = (): TemporaryTokenResult => {
  const unHashedToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(unHashedToken).digest("hex");

  const tokenExpiry = new Date(Date.now() + TEMPORARY_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  return {
    unHashedToken,
    hashedToken,
    tokenExpiry,
  };
};
