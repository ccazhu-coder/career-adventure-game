import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { assertDbOk, supabaseAdmin } from "./db.js";

const TOKEN_TTL = "8h";

export function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET 尚未設定");
  return process.env.JWT_SECRET;
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password || ""), 12);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(String(password || ""), String(passwordHash || ""));
}

export function signSession(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      username: user.username,
      email: user.email || ""
    },
    jwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

export async function requireUser(req, roles = []) {
  const header = req.headers.authorization || "";
  const queryToken = req.query?.token || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : String(queryToken || "");
  if (!token) throw new Error("請先登入");
  const payload = jwt.verify(token, jwtSecret());
  if (roles.length && !roles.includes(payload.role)) throw new Error("權限不足");

  const db = supabaseAdmin();
  const user = assertDbOk(await db
    .from("users")
    .select("id, username, email, display_name, role, status")
    .eq("id", payload.sub)
    .single());

  if (!user || user.status !== "active") throw new Error("帳號已停用或不存在");
  if (roles.length && !roles.includes(user.role)) throw new Error("權限不足");
  return user;
}
