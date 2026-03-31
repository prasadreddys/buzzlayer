import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret";

export async function isAuthenticated(req, res, next) {
  let token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Authorization token required" });
  if (token.startsWith("Bearer ")) token = token.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error("JWT error", err);
    res.status(401).json({ error: "Invalid token" });
  }
}
