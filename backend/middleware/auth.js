import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * @desc    Protect routes - verify JWT token
 * @usage   router.get('/profile', protect, getProfile)
 */
export async function protect (req, res, next){
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Access denied. No token provided."
      });
    }
     //  Extract token from "Bearer <token>"
    const token = authHeader.split(" ")[1];

    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists. Please login again.'
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please login again.',
      error: error.message
    });
  }
};

/**
 * @desc    Authorize specific roles
 * @usage   router.put('/availability', protect, authorize('responder'), toggleAvailability)
 */
export function authorize(...roles){
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires ${roles.join(' or ')} role. Your role is: ${req.user.role}`
      });
    }
    next();
  };
};