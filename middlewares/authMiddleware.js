import jwt from "jsonwebtoken";

const authenticate = (req, res, next) => {
  let token = null;

  // Try cookie
  if (req.cookies?.token) {
    token = req.cookies.token;
  }

  // Try Authorization header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  // Try x-access-token
  if (!token && req.headers["x-access-token"]) {
    token = req.headers["x-access-token"];
  }

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.email) {
      return res.status(401).json({ message: "Invalid token: email missing" });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

export default authenticate;
