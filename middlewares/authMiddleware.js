import jwt from "jsonwebtoken";

const authenticate = (req, res, next) => {
  let token = null;

  // 1️⃣ Try cookie first
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // 2️⃣ Try Authorization header
  if (!token) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  // 3️⃣ Try fallback (mobile browsers put token in x-access-token)
  if (!token && req.headers["x-access-token"]) {
    token = req.headers["x-access-token"];
  }

  // 4️⃣ No token found
  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized: No token provided" });
  }

  // 5️⃣ Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

export default authenticate;
