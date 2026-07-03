import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '8h';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function verifyOperatorPassword(password) {
  return password === process.env.APP_PASSWORD;
}

export function verifyAdminPassword(password) {
  return password === process.env.ADMIN_PASSWORD;
}

export async function verifyAuth(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return { valid: false };
    const user = verifyToken(token);
    if (!user) return { valid: false };
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}
