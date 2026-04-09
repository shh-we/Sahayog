import User from "../models/User.js";

// @desc    Get logged in user profile
// @route   GET /api/users/profile
// @access  Private
export async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const baseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt
    };

    if (user.role === "responder") {
      return res.status(200).json({
        success: true,
        user: {
          ...baseData,
          skills: user.skills,
          isAvailable: user.isAvailable,
          location: user.location,
          responseHistory: user.responseHistory
        }
      });
    }

    if (user.role === "admin") {
      return res.status(200).json({
        success: true,
        user: {
          ...baseData,
          skills: user.skills,
        }
      });
    }

    return res.status(200).json({
      success: true,
      user: baseData
    });

  } catch (error) {
    console.error("Error in getProfile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message
    });
  }
}

// @desc    Update logged in user profile
// @route   PUT /api/users/profile
// @access  Private
export async function updateProfile(req, res) {
  try {
    const { name, phone } = req.body;

    // Build update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    // Validate phone if provided
    if (phone) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid 10-digit phone number"
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Error in updateProfile:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message
    });
  }
}

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Check fields are present
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password"
      });
    }

    // 2. Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long"
      });
    }

    // 3. Get user with password selected
    const user = await User.findById(req.user.id).select("+password");

    // 4. Check current password is correct
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // 5. Check new password is not same as current
    const isSame = await user.comparePassword(newPassword);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be same as current password"
      });
    }

    // 6. Save new password — pre-save hook in model will hash it
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Error in changePassword:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message
    });
  }
}

// @desc    Update responder location
// @route   PUT /api/users/location
// @access  Private - Responder only
export async function updateLocation(req, res) {
  try {
    const { longitude, latitude } = req.body;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: "Please provide longitude and latitude"
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        location: {
          type: "Point",
          coordinates: [longitude, latitude]
        }
      },
      { new: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      location: user.location
    });

  } catch (error) {
    console.error("Error in updateLocation:", error);
    res.status(500).json({
      success: false,
      message: "Error updating location",
      error: error.message
    });
  }
}

// @desc    Toggle responder availability
// @route   PUT /api/users/availability
// @access  Private - Responder only
export async function toggleAvailability(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Flip current availability
    user.isAvailable = !user.isAvailable;
    await user.save();

    res.status(200).json({
      success: true,
      message: `You are now ${user.isAvailable ? "available" : "unavailable"}`,
      isAvailable: user.isAvailable
    });

  } catch (error) {
    console.error("Error in toggleAvailability:", error);
    res.status(500).json({
      success: false,
      message: "Error updating availability",
      error: error.message
    });
  }
}

// @desc    Get all users
// @route   GET /api/users
// @access  Private - Admin only
export async function getAllUsers(req, res) {
  try {
    const { role, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      users
    });

  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message
    });
  }
}

// @desc    Get single user by id
// @route   GET /api/users/:id
// @access  Private - Admin only
export async function getUserById(req, res) {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    console.error("Error in getUserById:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message
    });
  }
}

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private - Admin only
export async function deleteUser(req, res) {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account"
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message
    });
  }
}