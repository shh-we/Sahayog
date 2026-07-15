import User from "../models/User.js";
import Emergency from "../models/Emergency.js";
import DispatchAttempt from "../models/DispatchAttempt.js";
import { publishResponderAssigned } from "../socket/emergencyPublisher.js";

// @desc    Get assignments for the responder
// @route   GET /api/responders/my-assignments
// @access  Private - Responder only
export async function getMyAssignments(req, res) {
  try {
    const { history } = req.query;
    
    const filter = {
      assignedResponder: req.user.id
    };

    if (history === "true") {
      filter.status = "resolved";
    } else {
      filter.status = { $in: ["assigned", "in_progress"] };
    }

    const emergencies = await Emergency.find(filter)
      .populate("reporterId", "name phone")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      emergencies
    });
  } catch (error) {
    console.error("Error in getMyAssignments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching assignments",
      error: error.message
    });
  }
}

// @desc    Accept emergency direct
// @route   POST /api/responders/emergencies/:id/accept
// @access  Private - Responder only
export async function acceptEmergency(req, res) {
  try {
    const { id } = req.params;
    const responderId = req.user.id;

    const emergency = await Emergency.findOneAndUpdate(
      {
        _id: id,
        status: "active",
        assignedResponder: null
      },
      {
        status: "assigned",
        dispatchStatus: "assigned",
        assignedResponder: responderId
      },
      { new: true }
    );

    if (!emergency) {
      return res.status(409).json({
        success: false,
        message: "Emergency is already assigned or resolved"
      });
    }

    // Cancel all pending attempts for this emergency
    await DispatchAttempt.updateMany(
      { emergencyId: id, status: "pending" },
      { status: "cancelled" }
    );

    // Notify emergency room
    publishResponderAssigned(id.toString(), {
      responderId: responderId.toString(),
      emergencyId: id.toString(),
      etaSeconds: 300 // default ETA 5 minutes
    });

    res.status(200).json({
      success: true,
      message: "Emergency accepted successfully",
      emergency
    });
  } catch (error) {
    console.error("Error in acceptEmergency:", error);
    res.status(500).json({
      success: false,
      message: "Error accepting emergency",
      error: error.message
    });
  }
}

// @desc    Get nearby responders
// @route   GET /api/responders/nearby
// @access  Private
export async function getNearbyResponders(req, res) {
  try {
    const { longitude, latitude, radius = 15000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: "Please provide longitude and latitude"
      });
    }

    const responders = await User.find({
      role: "responder",
      isAvailable: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(longitude), Number(latitude)]
          },
          $maxDistance: Number(radius)
        }
      }
    }).select("name email phone skills isAvailable location createdAt");

    res.status(200).json({
      success: true,
      count: responders.length,
      responders
    });

  } catch (error) {
    console.error("Error in getNearbyResponders:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching nearby responders",
      error: error.message
    });
  }
}