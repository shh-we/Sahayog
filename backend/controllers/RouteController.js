import { getRoute } from "../services/routing/routeService.js";

/**
 * @desc    Get driving route geometry and metadata between two coordinate pairs
 * @route   GET /api/routes/driving
 * @access  Private
 */
export async function getDrivingRoute(req, res) {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;

    if (
      fromLat === undefined || fromLat === null ||
      fromLng === undefined || fromLng === null ||
      toLat === undefined || toLat === null ||
      toLng === undefined || toLng === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing coordinates query parameters (fromLat, fromLng, toLat, toLng)"
      });
    }

    const fLat = Number(fromLat);
    const fLng = Number(fromLng);
    const tLat = Number(toLat);
    const tLng = Number(toLng);

    if (
      !Number.isFinite(fLat) || !Number.isFinite(fLng) ||
      !Number.isFinite(tLat) || !Number.isFinite(tLng)
    ) {
      return res.status(400).json({
        success: false,
        message: "Coordinates must be finite numbers"
      });
    }

    // Latitude range checking
    if (fLat < -90 || fLat > 90 || tLat < -90 || tLat > 90) {
      return res.status(400).json({
        success: false,
        message: "Latitude must be in the range [-90, 90]"
      });
    }

    // Longitude range checking
    if (fLng < -180 || fLng > 180 || tLng < -180 || tLng > 180) {
      return res.status(400).json({
        success: false,
        message: "Longitude must be in the range [-180, 180]"
      });
    }

    try {
      // Coordinate order for getRoute is [longitude, latitude]
      const routeData = await getRoute([fLng, fLat], [tLng, tLat]);

      return res.status(200).json({
        success: true,
        geometry: routeData.geometry,
        distanceMeters: routeData.distanceMeters,
        durationSeconds: routeData.durationSeconds,
        source: "osrm"
      });
    } catch (routeErr) {
      console.error("[RouteController] getRoute failed:", routeErr.message);
      return res.status(503).json({
        success: false,
        error: "route_unavailable",
        message: "Road route is temporarily unavailable; location sharing continues."
      });
    }
  } catch (error) {
    console.error("[RouteController] Unexpected error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during route fetching"
    });
  }
}
