import DispatchAttempt from "../models/DispatchAttempt.js";
import { acceptDispatchAttempt, declineDispatchAttempt } from "../services/dispatchService.js";

// @desc    Accept dispatch offer
// @route   POST /api/dispatch/:attemptId/accept
// @access  Private - Responder only
export async function acceptOffer(req, res) {
  try {
    const { attemptId } = req.params;

    // 1. Look up attempt to verify if responderId matches req.user.id
    const attempt = await DispatchAttempt.findById(attemptId);
    if (!attempt || attempt.responderId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "forbidden" });
    }

    // 2. Call service
    const result = await acceptDispatchAttempt(attemptId, req.user.id);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      if (result.reason === "already_assigned") {
        return res.status(409).json(result);
      }
      return res.status(500).json({ error: "unexpected_error" });
    }
  } catch (error) {
    console.error("Error in acceptOffer:", error);
    return res.status(500).json({ error: "server_error" });
  }
}

// @desc    Decline dispatch offer
// @route   POST /api/dispatch/:attemptId/decline
// @access  Private - Responder only
export async function declineOffer(req, res) {
  try {
    const { attemptId } = req.params;

    // 1. Look up attempt to verify if responderId matches req.user.id
    const attempt = await DispatchAttempt.findById(attemptId);
    if (!attempt || attempt.responderId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "forbidden" });
    }

    // 2. Call service
    const result = await declineDispatchAttempt(attemptId);

    if (result.ok) {
      return res.status(200).json(result);
    } else {
      if (result.reason === "not_pending") {
        return res.status(409).json(result);
      }
      return res.status(500).json({ error: "unexpected_error" });
    }
  } catch (error) {
    console.error("Error in declineOffer:", error);
    return res.status(500).json({ error: "server_error" });
  }
}
