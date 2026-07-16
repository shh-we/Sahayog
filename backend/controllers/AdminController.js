import Emergency from "../models/Emergency.js";
import User from "../models/User.js";

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/stats
// @access  Private - Admin only
export async function getStats(req, res) {
  try {
    const [
      totalEmergencies,
      activeEmergencies,
      resolvedEmergencies,
      totalResponders,
      availableResponders,
      totalUsers,
      totalAdmins
    ] = await Promise.all([
      Emergency.countDocuments(),
      Emergency.countDocuments({ status: { $in: ["active", "assigned", "in_progress"] } }),
      Emergency.countDocuments({ status: "resolved" }),
      User.countDocuments({ role: "responder" }),
      User.countDocuments({ role: "responder", isAvailable: true }),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "admin" })
    ]);

    // Calculate average response time
    const emergencies = await Emergency.find({ status: "resolved" }).limit(100);
    
    const avgResponseTime = 0; // Legacy responders array calculations removed

    res.status(200).json({
      success: true,
      stats: {
        emergencies: {
          total: totalEmergencies,
          active: activeEmergencies,
          resolved: resolvedEmergencies
        },
        responders: {
          total: totalResponders,
          available: availableResponders
        },
        users: {
          total: totalUsers
        },
        admins: totalAdmins,
        avgResponseTime: `${avgResponseTime} mins`
      }
    });

  } catch (error) {
    console.error("Error in getStats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message
    });
  }
}

// @desc    Get all emergencies (admin view)
// @route   GET /api/admin/emergencies
// @access  Private - Admin only
export async function getAllEmergencies(req, res) {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const [emergencies, total] = await Promise.all([
      Emergency.find(filter)
        .populate("reporterId", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Emergency.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      emergencies
    });

  } catch (error) {
    console.error("Error in getAllEmergencies:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching emergencies",
      error: error.message
    });
  }
}

// @desc    Get all responders (admin view)
// @route   GET /api/admin/responders
// @access  Private - Admin only
export async function getAllResponders(req, res) {
  try {
    const { isAvailable, page = 1, limit = 20 } = req.query;

    const filter = { role: "responder", isApproved: true };
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";

    const [responders, total] = await Promise.all([
      User.find(filter)
        .select("name email phone skills isAvailable status location createdAt")
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
      responders
    });

  } catch (error) {
    console.error("Error in getAllResponders:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching responders",
      error: error.message
    });
  }
}

// @desc    Get all users (admin view)
// @route   GET /api/admin/users
// @access  Private - Admin only
export async function getAllUsersList(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;

    const filter = { role: "user" };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email phone role isApproved createdAt")
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
    console.error("Error in getAllUsersList:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message
    });
  }
}

// @desc    Get pending verification queue (all roles, isApproved = false)
// @route   GET /api/admin/users/pending
// @access  Private - Admin only
export async function getPendingUsers(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const filter = { isApproved: false };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email phone role isApproved createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    res.status(200).json({ success: true, total, users });
  } catch (error) {
    console.error("Error in getPendingUsers:", error);
    res.status(500).json({ success: false, message: "Error fetching pending users", error: error.message });
  }
}

// @desc    Approve a user account
// @route   PATCH /api/admin/users/:id/approve
// @access  Private - Admin only
export async function approveUser(req, res) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true, select: "name email phone role isApproved" }
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, message: "User approved successfully", user });
  } catch (error) {
    console.error("Error in approveUser:", error);
    res.status(500).json({ success: false, message: "Error approving user", error: error.message });
  }
}

// @desc    Reject (delete) a user account
// @route   DELETE /api/admin/users/:id/reject
// @access  Private - Admin only
export async function rejectUser(req, res) {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, message: "User rejected and removed" });
  } catch (error) {
    console.error("Error in rejectUser:", error);
    res.status(500).json({ success: false, message: "Error rejecting user", error: error.message });
  }
}

// @desc    Create a new responder directly
// @route   POST /api/admin/responders
// @access  Private - Admin only
export async function createResponder(req, res) {
  try {
    const { name, phone, email, password, skills, isAvailable, status } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields (name, phone, email, password) are required" });
    }

    // Check existing
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email or phone number is already registered" });
    }

    const responder = await User.create({
      name,
      phone,
      email: email.toLowerCase(),
      password,
      role: "responder",
      skills,
      isAvailable,
      status: status || "available",
      isApproved: true // Auto-approve admin-created accounts
    });

    res.status(201).json({
      success: true,
      message: "Responder created successfully",
      responder: {
        _id: responder._id,
        name: responder.name,
        email: responder.email,
        phone: responder.phone,
        skills: responder.skills,
        isAvailable: responder.isAvailable,
        status: responder.status,
        createdAt: responder.createdAt
      }
    });
  } catch (error) {
    console.error("Error creating responder:", error);
    res.status(500).json({ success: false, message: "Error creating responder", error: error.message });
  }
}

