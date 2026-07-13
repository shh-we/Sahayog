import User from "../models/User.js";

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