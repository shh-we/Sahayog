import Emergency from "../models/Emergency.js";
import User from "../models/User.js";

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

    // Check if responder already accepted this emergency
    const alreadyAccepted = emergency.responders.some(
      (r) => r.userId.toString() === req.user.id
    );
    if (alreadyAccepted) {
      return res.status(400).json({
        success: false,
        message: "You have already accepted this emergency"
      });
    }

    // Add responder to emergency
    emergency.responders.push({
      userId: req.user.id,
      status: "en_route",
      notifiedAt: new Date(),
      respondedAt: new Date()
    });

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

// @desc    Update responder status on an emergency
// @route   PUT /api/responders/emergencies/:id/status
// @access  Private - Responder only
export async function updateResponseStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ["en_route", "on_scene", "completed"];

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
    if (!responder) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this emergency"
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
      .populate("createdBy", "name phone")
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
    if (emergency.createdBy.toString() !== req.user.id) {
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