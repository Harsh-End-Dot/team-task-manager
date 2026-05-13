import jwt from "jsonwebtoken";
import { env } from "./env.js";

export type JwtPayload = { sub: string; email: string };

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || !decoded || !("sub" in decoded) || !("email" in decoded)) {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtPayload;
}
