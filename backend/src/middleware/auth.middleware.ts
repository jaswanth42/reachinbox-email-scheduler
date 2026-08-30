import dotenv from "dotenv";
dotenv.config();

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

export interface AuthUser {
  userId: string;
  email: string;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token missing",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as AuthUser;

    // Store authenticated user on request
    (req as Request & { authUser: AuthUser }).authUser =
      decoded;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}