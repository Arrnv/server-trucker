// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";

export const appAuthMiddleware = (req, res, next) => {
  const token =
    req.headers.authorization?.split(" ")[1] || req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user data to request
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
export default appAuthMiddleware;

