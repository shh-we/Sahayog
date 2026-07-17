import User from"../models/User.js";

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
//register new user
export async function register (req, res){
  try {
    const { name, email, password, phone, role, skills = [] } = req.body;
    
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password, phone'
      });
    }
    
    
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }
    
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }
    
    // Validate phone number (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 10-digit phone number"
      });
    }
    
    // Validate role
    if (role && !['user', 'responder', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be: user, responder, or admin"
      });
    }

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be created via public registration."
      });
    }

    // Validate skills for responders
    const validSkills = new Set(['medical', 'fire', 'security', 'general']);
    if (role === 'responder') {
      if (!Array.isArray(skills) || skills.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Responder accounts must include at least one skill'
        });
      }

      const invalidSkills = skills.filter((skill) => !validSkills.has(skill));
      if (invalidSkills.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid skills: ${invalidSkills.join(', ')}`
        });
      }
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login instead.'
      });
    }

    // Check if phone number already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered. Please login instead.'
      });
    }
    
    // Create new user
    const finalRole = role || 'user';
    const userData = {
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: finalRole,
      isApproved: finalRole === 'responder' ? false : true
    };

    if (finalRole === 'responder') {
      userData.skills = skills;
    }

    const user = await User.create(userData);
    
    const successMessage = finalRole === 'responder'
      ? "Registration successful! Your responder account is pending administrator approval."
      : "Registration successful! You can now log in.";
    
    res.status(201).json({
      success: true,
      message: successMessage,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isAvailable: user.isAvailable
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during registration. Please try again.',
      error: error.message
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */

//login
export async function login (req, res) {
  try {
    const { phone, password, loginAs } = req.body;
    
  
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number and password'
      });
    }
    
    // Find user and include password field
    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your phone number and password.'
      });
    }
    
    // Verify password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your phone number and password.'
      });
    }
    
    // Validate role if loginAs is specified
    if (loginAs && user.role !== loginAs) {
      return res.status(403).json({
        success: false,
        message: `Your account is registered as ${user.role}, not ${loginAs}. Please select the correct login option.`
      });
    }

    // Block login only when user is a responder and is not approved
    if (user.role === "responder" && !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Your account is pending administrator approval."
      });
    }
    
    // Generate token
    const token = user.generateAuthToken();
    
    res.status(200).json({
      success: true,
      message: 'Login successful! Welcome back.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isAvailable: user.isAvailable,
        location: user.location
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login. Please try again.',
      error: error.message
    });
  }
};

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */

//get current logged in user
export async function getMe(req, res) {
  try {
    // req.user is set by protect middleware
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please login again.'
      });
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isAvailable: user.isAvailable,
        location: user.location,
        createdAt: user.createdAt
      }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user information',
      error: error.message
    });
  }
}