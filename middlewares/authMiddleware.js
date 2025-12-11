import jwt from 'jsonwebtoken';

// Middleware to authenticate using either cookie or Bearer token
const authenticateTokenDual = (req, res, next) => {
  // 1️⃣ Try to get token from cookie
  let token = req.cookies?.token;

  // 2️⃣ If no cookie, try Authorization header
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  // 3️⃣ No token found
  if (!token) return res.status(401).json({ message: 'Access Denied: No token provided' });

  // 4️⃣ Verify token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Legacy middleware that only reads cookie (optional)
const authenticateCookie = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Legacy middleware that only reads cookie (try/catch style)
const authenticateCookieTryCatch = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'Access Denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid Token' });
  }
};

export default authenticateTokenDual;
export { authenticateCookie, authenticateCookieTryCatch };
