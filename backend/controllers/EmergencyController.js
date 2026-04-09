import Emergency from "../models/Emergency.js";

// @desc    Create new emergency
// @route   POST /api/emergencies
// @access  Private - Any logged in user

export async function createEmergency(req, res) {
  try {
    const { type, description, longitude, latitude, address } = req.body;

    // 1. Validate required fields
    if (!type || !longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: "Please provide type, longitude and latitude"
      });
    }

    // 2. Create emergency
    const emergency = await Emergency.create({
      createdBy: req.user.id,
      type,
      description,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
        address
      }
    });

    res.status(201).json({
      success: true,
      message: "Emergency reported successfully",
      emergency
    });

  } catch (error) {
    console.error("Error in createEmergency:", error);
    res.status(500).json({
      success: false,
      message: "Error creating emergency",
      error: error.message
    });
  }
}

// @desc    Get emergencies (role based)
// @route   GET /api/emergencies
// @access  Private
export async function getEmergencies(req, res) {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    // User sees only their own emergencies
    if (req.user.role === "user") {
      filter.createdBy = req.user.id;
    }

    const [emergencies, total] = await Promise.all([
      Emergency.find(filter)
        .populate("createdBy", "name phone")
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
    console.error("Error in getEmergencies:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching emergencies",
      error: error.message
    });
  }
}

// @desc    Get single emergency by id
// @route   GET /api/emergencies/:id
// @access  Private
export async function getEmergencyById(req, res) {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate("createdBy", "name phone")
      .populate("responders.userId", "name phone skills");

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found"
      });
    }

    // User can only view their own emergency
    if (
      req.user.role === "user" &&
      emergency.createdBy._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    res.status(200).json({
      success: true,
      emergency
    });

  } catch (error) {
    console.error("Error in getEmergencyById:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching emergency",
      error: error.message
    });
  }
}

// @desc    Get nearby emergencies
// @route   GET /api/emergencies/nearby
// @access  Private
export async function getNearbyEmergencies(req, res) {
  try {
    const { longitude, latitude, radius = 5000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: "Please provide longitude and latitude"
      });
    }

    const emergencies = await Emergency.find({
      status: "active",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(longitude), Number(latitude)]
          },
          $maxDistance: Number(radius)
        }
      }
    }).populate("createdBy", "name phone");

    res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies
    });

  } catch (error) {
    console.error("Error in getNearbyEmergencies:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching nearby emergencies",
      error: error.message
    });
  }
}

// @desc    Update emergency status
// @route   PUT /api/emergencies/:id/status
// @access  Private - Responder/Admin
export async function updateStatus(req, res) {
  try {
    const { status } = req.body;

    // Valid status transitions
    const validTransitions = {
      active: ["assigned", "cancelled"],
      assigned: ["in_progress", "cancelled"],
      in_progress: ["resolved", "cancelled"],
    };

    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found"
      });
    }

    // Check if transition is valid
    const allowed = validTransitions[emergency.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${emergency.status}' to '${status}'`
      });
    }

    emergency.status = status;
    if (status === "resolved") emergency.resolvedAt = new Date();
    await emergency.save();

    res.status(200).json({
      success: true,
      message: "Emergency status updated",
      emergency
    });

  } catch (error) {
    console.error("Error in updateStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error updating status",
      error: error.message
    });
  }
}

// @desc    Delete emergency (soft delete - marks as cancelled)
// @route   DELETE /api/emergencies/:id
// @access  Private - Admin or creator
export async function deleteEmergency(req, res) {
  try {
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found"
      });
    }

    // Only admin or the creator can delete
    if (
      req.user.role !== "admin" &&
      emergency.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Can only cancel active emergencies
    if (!["active", "assigned"].includes(emergency.status)) {
      return res.status(400).json({
        success: false,
        message: "Only active or assigned emergencies can be cancelled"
      });
    }

    // Soft delete — mark as cancelled
    emergency.status = "cancelled";
    await emergency.save();

    res.status(200).json({
      success: true,
      message: "Emergency cancelled successfully"
    });

  } catch (error) {
    console.error("Error in deleteEmergency:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling emergency",
      error: error.message
    });
  }
}