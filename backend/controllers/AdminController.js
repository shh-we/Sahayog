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
      completedEmergencies,
      totalResponders,
      availableResponders,
      totalUsers,
      totalAdmins
    ] = await Promise.all([
      Emergency.countDocuments(),
      Emergency.countDocuments({ status: { $in: ["active", "assigned"] } }),
      Emergency.countDocuments({ status: "completed" }),
      User.countDocuments({ role: "responder" }),
      User.countDocuments({ role: "responder", isAvailable: true }),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "admin" })
    ]);

    // Calculate average response time
    const emergencies = await Emergency.find({ status: "completed" }).limit(100);
    
    let totalResponseTime = 0;
    let completedCount = 0;

    emergencies.forEach(emergency => {
      if (emergency.responders && emergency.responders.length > 0) {
        emergency.responders.forEach(responder => {
          if (responder.respondedAt && responder.arrivedAt) {
            const responseTime = new Date(responder.arrivedAt) - new Date(responder.respondedAt);
            totalResponseTime += responseTime;
            completedCount++;
          }
        });
      }
    });

    const avgResponseTime = completedCount > 0 
      ? Math.round(totalResponseTime / completedCount / 60000) // Convert to minutes
      : 0;

    res.status(200).json({
      success: true,
      stats: {
        emergencies: {
          total: totalEmergencies,
          active: activeEmergencies,
          completed: completedEmergencies
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
        .populate("createdBy", "name email phone")
        .populate("responders.userId", "name skills")
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

    const filter = { role: "responder" };
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";

    const [responders, total] = await Promise.all([
      User.find(filter)
        .select("name email phone skills isAvailable location createdAt")
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
        .select("name email phone role createdAt")
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
