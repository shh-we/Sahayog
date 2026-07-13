import Emergency from "../models/Emergency.js";
import { getRequiredSkills } from "../services/emergencyService.js";
import { startDispatch } from "../services/dispatchService.js";

// @desc    Create new emergency
// @route   POST /api/emergencies
// @access  Private - Any logged in user
export async function createEmergency(req, res) {
  try {
    const { type, description, longitude, latitude, address } = req.body;

    // 1. Validate type
    if (!type || typeof type !== 'string' || type.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid type"
      });
    }

    // 2. Validate coordinates are present and not null/empty/whitespace/non-numeric
    if (
      latitude === undefined || latitude === null ||
      longitude === undefined || longitude === null ||
      (typeof latitude !== 'number' && typeof latitude !== 'string') ||
      (typeof longitude !== 'number' && typeof longitude !== 'string') ||
      (typeof latitude === 'string' && latitude.trim() === '') ||
      (typeof longitude === 'string' && longitude.trim() === '')
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid longitude and latitude"
      });
    }

    // 3. Ensure they are finite numbers (rejects NaN, Infinity, -Infinity)
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        success: false,
        message: "Coordinates must be finite numbers"
      });
    }

    // 4. Range validation
    if (lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: "Latitude must be between -90 and 90"
      });
    }
    if (lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        message: "Longitude must be between -180 and 180"
      });
    }

    const requiredSkills = getRequiredSkills(type);

    // 2. Create emergency
    const emergency = await Emergency.create({
      reporterId: req.user.id,
      type,
      description,
      reporterLocation: {
        type: "Point",
        coordinates: [lon, lat]
      },
      address,
      requiredSkills
    });

    if (!emergency) {
      throw new Error("Failed to create emergency");
    }

    // Start dispatch process using the Feature 4 placeholder service
    await startDispatch(emergency._id);

    // Response includes at minimum: id, status, dispatchStatus, and createdAt
    res.status(201).json({
      success: true,
      message: "Emergency reported successfully",
      emergency: {
        id: emergency._id,
        _id: emergency._id,
        status: emergency.status,
        dispatchStatus: emergency.dispatchStatus !== undefined ? emergency.dispatchStatus : null,
        createdAt: emergency.createdAt,
        reporterId: emergency.reporterId,
        reporterLocation: emergency.reporterLocation,
        address: emergency.address,
        type: emergency.type,
        description: emergency.description
      }
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
      filter.reporterId = req.user.id;
    }

    const [emergencies, total] = await Promise.all([
      Emergency.find(filter)
        .populate("reporterId", "name phone")
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
      .populate("reporterId", "name phone");

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found"
      });
    }

    // User can only view their own emergency
    if (
      req.user.role === "user" &&
      emergency.reporterId._id.toString() !== req.user.id
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
      reporterLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(longitude), Number(latitude)]
          },
          $maxDistance: Number(radius)
        }
      }
    }).populate("reporterId", "name phone");

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
      emergency.reporterId.toString() !== req.user.id
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