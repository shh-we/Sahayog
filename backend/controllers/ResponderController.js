import Emergency from "../models/Emergency.js";
import User from "../models/User.js";
import { getIO } from "../socket/index.js";

// @desc    Accept an emergency
// @route   POST /api/responders/emergencies/:id/accept
// @access  Private - Responder only
export async function acceptEmergency(req, res) {
  try {
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found"
      });
    }

    // Only active or assigned emergencies can be accepted
    if (!["active", "assigned"].includes(emergency.status)) {
      return res.status(400).json({
        success: false,
        message: "This emergency is no longer available"
      });
    }

    // Check if responder is already in the list
    const existingResponder = emergency.responders.find(
      (r) => r.userId.toString() === req.user.id
    );

    if (existingResponder) {
      // If already accepted/active/completed, reject
      if (["accepted", "en_route", "on_scene", "completed"].includes(existingResponder.status)) {
        return res.status(400).json({
          success: false,
          message: "You have already accepted this emergency"
        });
      }
      // Update the existing notified/declined entry
      existingResponder.status = "accepted";
      existingResponder.respondedAt = new Date();
    } else {
      // Add responder to emergency (if not previously notified)
      emergency.responders.push({
        userId: req.user.id,
        status: "accepted",
        notifiedAt: new Date(),
        respondedAt: new Date()
      });
    }

    // Update emergency status to assigned
    emergency.status = "assigned";
    await emergency.save();

    // Add to responder's history
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        responseHistory: {
          emergencyId: emergency._id
        }
      }
    });

    // Emit Socket.IO event to notify all users
    const io = getIO();
    io.emit("emergency_accepted", {
      emergencyId: emergency._id,
      responderId: req.user.id,
      responderName: req.user.name,
      status: "assigned"
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

// @desc    Decline an emergency
// @route   POST /api/responders/emergencies/:id/decline
// @access  Private - Responder only
export async function declineEmergency(req, res) {
  try {
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found"
      });
    }

    // Check if responder already in list
    const existingResponder = emergency.responders.find(
      (r) => r.userId.toString() === req.user.id
    );

    if (existingResponder) {
      if (existingResponder.status === "declined") {
        return res.status(400).json({
          success: false,
          message: "You have already declined this emergency"
        });
      }
      existingResponder.status = "declined";
    } else {
      // Add responder to emergency with declined status
      emergency.responders.push({
        userId: req.user.id,
        status: "declined",
        notifiedAt: new Date(),
        respondedAt: new Date()
      });
    }

    await emergency.save();

    // Emit Socket.IO event
    const io = getIO();
    io.emit("emergency_declined", {
      emergencyId: emergency._id,
      responderId: req.user.id,
      responderName: req.user.name
    });

    res.status(200).json({
      success: true,
      message: "Emergency declined successfully",
      emergency
    });

  } catch (error) {
    console.error("Error in declineEmergency:", error);
    res.status(500).json({
      success: false,
      message: "Error declining emergency",
      error: error.message
    });
  }
}

// @desc    Update responder status on an emergency
// @route   PUT /api/responders/emergencies/:id/status
// @access  Private - Responder only
export async function updateResponseStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ["accepted", "en_route", "on_scene", "completed"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}`
      });
    }

    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found"
      });
    }

    // Find this responder in the emergency's responders array
    const responder = emergency.responders.find(
      (r) => r.userId.toString() === req.user.id
    );
    if (!responder || !["accepted", "en_route", "on_scene", "completed"].includes(responder.status)) {
      return res.status(403).json({
        success: false,
        message: "You are not an active responder assigned to this emergency"
      });
    }

    // Validate state transitions
    const statusOrder = {
      "accepted": 1,
      "en_route": 2,
      "on_scene": 3,
      "completed": 4
    };

    const currentOrder = statusOrder[responder.status] || 0;
    const nextOrder = statusOrder[status] || 0;

    if (nextOrder <= currentOrder) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${responder.status} to ${status}`
      });
    }

    // Update responder status and relevant timestamp
    responder.status = status;
    if (status === "on_scene")  responder.arrivedAt   = new Date();
    if (status === "completed") responder.completedAt = new Date();

    // Update emergency status based on responder status
    if (status === "on_scene")  emergency.status = "in_progress";
    if (status === "completed") emergency.status = "resolved";
    if (status === "completed") emergency.resolvedAt = new Date();

    await emergency.save();

    // Emit Socket.IO event to notify users and admin
    const io = getIO();
    io.emit("status_update", {
      emergencyId: emergency._id,
      responderId: req.user.id,
      responderName: req.user.name,
      status: status,
      emergencyStatus: emergency.status
    });

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      responder
    });

  } catch (error) {
    console.error("Error in updateResponseStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error updating response status",
      error: error.message
    });
  }
}

// @desc    Get responder's active assignments
// @route   GET /api/responders/my-assignments
// @access  Private - Responder only
export async function getMyAssignments(req, res) {
  try {
    const emergencies = await Emergency.find({
      "responders.userId": req.user.id,
      status: { $in: ["assigned", "in_progress"] }
    })
      .populate("reporterId", "name phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: emergencies.length,
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

// @desc    Submit feedback for a responder
// @route   POST /api/responders/emergencies/:id/feedback
// @access  Private - Emergency creator only
export async function submitFeedback(req, res) {
  try {
    const { responderId, rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5"
      });
    }

    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found"
      });
    }

    // Only the emergency creator can submit feedback
    if (emergency.reporterId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the emergency creator can submit feedback"
      });
    }

    // Emergency must be resolved first
    if (emergency.status !== "resolved") {
      return res.status(400).json({
        success: false,
        message: "Can only submit feedback for resolved emergencies"
      });
    }

    // Find the responder in the emergency
    const responder = emergency.responders.find(
      (r) => r.userId.toString() === responderId
    );
    if (!responder) {
      return res.status(404).json({
        success: false,
        message: "Responder not found on this emergency"
      });
    }

    // Save feedback rating
    responder.feedback = { rating };
    await emergency.save();

    // Update rating in responder's response history
    await User.updateOne(
      {
        _id: responderId,
        "responseHistory.emergencyId": emergency._id
      },
      {
        $set: { "responseHistory.$.feedback": rating }
      }
    );

    res.status(200).json({
      success: true,
      message: "Feedback submitted successfully"
    });

  } catch (error) {
    console.error("Error in submitFeedback:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting feedback",
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