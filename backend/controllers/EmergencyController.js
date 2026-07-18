  import Emergency from "../models/Emergency.js";
  import { getRequiredSkills } from "../services/emergencyService.js";
  import { startDispatch } from "../services/dispatchService.js";
  import { publishEmergencyStatusUpdate, publishJourneyStarted } from "../socket/emergencyPublisher.js";
  import { findAStarRoute } from "../services/routing/aStarService.js";
  import { getRoute } from "../services/routing/routeService.js";

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
        .populate("assignedResponder", "name phone skills email role")
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
      .populate("reporterId", "name phone")
      .populate("assignedResponder", "name phone skills email role");

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
    }).populate("reporterId", "name phone")
      .populate("assignedResponder", "name phone skills email role");

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

// @desc    Update assigned responder status
// @route   PATCH /api/emergencies/:id/status
// @access  Private - Assigned Responder only
export async function updateResponderStatus(req, res) {
  try {
    const { status } = req.body;

    // Validate allowed statuses
    if (!["en_route", "on_scene", "completed"].includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    const emergency = await Emergency.findById(req.params.id);

    // Verify emergency exists, has an assigned responder, and matches requesting user
    if (
      !emergency ||
      !emergency.assignedResponder ||
      emergency.assignedResponder.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({ error: "forbidden" });
    }

    // Persist the status in responderStatus
    emergency.responderStatus = status;

    // When going en_route, store the shared journey state for user-side sync
    if (status === "en_route") {
      const { routeCoordinates, journeyStartedAt } = req.body;
      if (routeCoordinates && Array.isArray(routeCoordinates)) {
        emergency.routeCoordinates = routeCoordinates;
      }
      emergency.journeyStartedAt = journeyStartedAt ? new Date(journeyStartedAt) : new Date();
    }

    // Special logic for completed status
    if (status === "completed") {
      emergency.status = "resolved";
      emergency.resolvedAt = new Date();
    }

    await emergency.save();

    // Publish status update to the emergency's room
    publishEmergencyStatusUpdate(emergency._id.toString(), {
      emergencyId: emergency._id.toString(),
      status: emergency.status,
      responderStatus: emergency.responderStatus,
      updatedAt: emergency.updatedAt
    });

    // When en_route, also broadcast the journey state for synchronized animation
    if (status === "en_route") {
      const routeSource = req.body.routeSource || 'unknown';
      publishJourneyStarted(emergency._id.toString(), {
        emergencyId: emergency._id.toString(),
        routeCoordinates: emergency.routeCoordinates,
        journeyStartedAt: emergency.journeyStartedAt.toISOString(),
        routeSource
      });
    }

    return res.status(200).json({
      success: true,
      emergency
    });

  } catch (error) {
    console.error("Error in updateResponderStatus:", error);
    return res.status(500).json({ error: "server_error" });
  }
}

// ─── A* Routing: Responder → Incident ────────────────────────────────────────

/**
 * Computes the A* route from a responder's current location to the incident.
 * Falls back to OSRM's getRoute if A* finds no path.
 *
 * @param {string} emergencyId
 * @returns {Promise<{ path: Array<[number, number]>, distanceMeters: number, source: string } | null>}
 */
export async function getResponderToIncidentRoute(emergencyId) {
  const tag = `[ROUTE]`;
  try {
    const emergency = await Emergency.findById(emergencyId)
      .populate('assignedResponder', 'location');

    if (!emergency || !emergency.assignedResponder || !emergency.assignedResponder.location) {
      console.warn(`${tag} Responder-to-incident: emergency or responder location not found for ${emergencyId}`);
      return null;
    }

    const responderLoc = emergency.assignedResponder.location;
    const responderCoords = Array.isArray(responderLoc.coordinates)
      ? responderLoc.coordinates
      : responderLoc;
    const incidentCoords = emergency.reporterLocation.coordinates;

    console.log(`${tag} Computing responder-to-incident route for emergency ${emergencyId}`);
    console.log(`${tag} Input coordinates: responder=[${responderCoords[0]},${responderCoords[1]}] incident=[${incidentCoords[0]},${incidentCoords[1]}]`);

    // Try A* first
    let aStarResult;
    try {
      aStarResult = findAStarRoute(responderCoords, incidentCoords);
    } catch (astarErr) {
      console.error(`${tag} A* algorithm threw an exception (bug in algorithm/graph):`, astarErr);
      aStarResult = { found: false, reason: 'exception', startSnap: null, endSnap: null, path: [], distanceMeters: 0, iterations: 0 };
    }

    console.log(`${tag} A* algorithm result: path found=${aStarResult.found}, distance=${aStarResult.distanceMeters}m, waypoints=${aStarResult.path.length}, iterations=${aStarResult.iterations}`);
    if (aStarResult.startSnap) console.log(`${tag} Snap details: start=nodeId=${aStarResult.startSnap.nodeId} (${aStarResult.startSnap.distanceMeters.toFixed(1)}m), end=nodeId=${aStarResult.endSnap.nodeId} (${aStarResult.endSnap.distanceMeters.toFixed(1)}m)`);

    if (aStarResult.found && aStarResult.path.length >= 2) {
      console.log(`${tag} Route source selected: A* (self-implemented shortest path algorithm)`);
      return {
        path: aStarResult.path,
        distanceMeters: aStarResult.distanceMeters,
        source: 'astar'
      };
    }

    // A* failed -- log reason and fall back to OSRM
    console.log(`${tag} A* returned no usable path (reason: ${aStarResult.reason || 'path too short'}). Falling back to OSRM external API...`);

    // Fallback to OSRM
    try {
      const osrmRoute = await getRoute(responderCoords, incidentCoords);
      console.log(`${tag} Route source selected: OSRM (external routing API fallback)`);
      return {
        path: osrmRoute.geometry,
        distanceMeters: osrmRoute.distanceMeters,
        source: 'osrm'
      };
    } catch (osrmErr) {
      console.warn(`${tag} OSRM also failed (${osrmErr.message}). Using straight-line fallback.`);
      return {
        path: [responderCoords, incidentCoords],
        distanceMeters: 0,
        source: 'fallback'
      };
    }
  } catch (error) {
    console.error(`${tag} Unexpected error in responder-to-incident route:`, error);
    return null;
  }
}

// ─── Facility coordinates (demo area) ────────────────────────────────────────

const DEMO_FACILITIES = {
  medical: {
    name: 'Patan Hospital',
    coordinates: [85.3206, 27.6683]  // [lng, lat]
  },
  fire: {
    name: 'Patan Hospital',
    coordinates: [85.3206, 27.6683]
  },
  security: {
    name: 'Metropolitan Police Station, Lagankhel',
    coordinates: [85.3236, 27.6677]
  },
  crime: {
    name: 'Metropolitan Police Station, Lagankhel',
    coordinates: [85.3236, 27.6677]
  },
  natural_disaster: {
    name: 'Metropolitan Police Station, Lagankhel',
    coordinates: [85.3236, 27.6677]
  }
};

/**
 * Returns the recommended facility coordinates for a given emergency type.
 *
 * @param {string} type - Emergency type (medical, fire, security, etc.)
 * @returns {{ name: string, coordinates: [number, number] }}
 */
export function getRecommendedFacility(type) {
  return DEMO_FACILITIES[type] || DEMO_FACILITIES.medical;
}

// ─── A* Routing: Incident → Facility ─────────────────────────────────────────

/**
 * Computes the A* route from an incident to the recommended facility.
 * Falls back to OSRM if A* finds no path.
 *
 * @param {string} emergencyId
 * @param {string} [facilityType] - Override facility type; defaults to emergency.type.
 * @returns {Promise<{ path: Array<[number, number]>, distanceMeters: number, source: string, facility: Object } | null>}
 */
export async function getIncidentToFacilityRoute(emergencyId, facilityType) {
  const tag = `[ROUTE]`;
  try {
    const emergency = await Emergency.findById(emergencyId);

    if (!emergency) {
      console.warn(`${tag} Incident-to-facility: emergency not found for ${emergencyId}`);
      return null;
    }

    const type = facilityType || emergency.type;
    const facility = getRecommendedFacility(type);
    const incidentCoords = emergency.reporterLocation.coordinates;

    console.log(`${tag} Computing incident-to-facility route for emergency ${emergencyId}, type=${type}`);
    console.log(`${tag} Selected facility: ${facility.name} at [${facility.coordinates[0]},${facility.coordinates[1]}]`);

    // Try A* first
    let aStarResult;
    try {
      aStarResult = findAStarRoute(incidentCoords, facility.coordinates);
    } catch (astarErr) {
      console.error(`${tag} A* algorithm threw an exception (bug in algorithm/graph):`, astarErr);
      aStarResult = { found: false, reason: 'exception', startSnap: null, endSnap: null, path: [], distanceMeters: 0, iterations: 0 };
    }

    console.log(`${tag} A* algorithm result: path found=${aStarResult.found}, distance=${aStarResult.distanceMeters}m, waypoints=${aStarResult.path.length}, iterations=${aStarResult.iterations}`);
    if (aStarResult.startSnap) console.log(`${tag} Snap details: start=nodeId=${aStarResult.startSnap.nodeId} (${aStarResult.startSnap.distanceMeters.toFixed(1)}m), end=nodeId=${aStarResult.endSnap.nodeId} (${aStarResult.endSnap.distanceMeters.toFixed(1)}m)`);

    if (aStarResult.found && aStarResult.path.length >= 2) {
      console.log(`${tag} Route source selected: A* (self-implemented shortest path algorithm) to ${facility.name}`);
      return {
        path: aStarResult.path,
        distanceMeters: aStarResult.distanceMeters,
        source: 'astar',
        facility
      };
    }

    // A* failed -- log reason and fall back to OSRM
    console.log(`${tag} A* returned no usable path (reason: ${aStarResult.reason || 'path too short'}). Falling back to OSRM external API...`);

    // Fallback to OSRM
    try {
      const osrmRoute = await getRoute(incidentCoords, facility.coordinates);
      console.log(`${tag} Route source selected: OSRM (external routing API fallback) to ${facility.name}`);
      return {
        path: osrmRoute.geometry,
        distanceMeters: osrmRoute.distanceMeters,
        source: 'osrm',
        facility
      };
    } catch (osrmErr) {
      console.warn(`${tag} OSRM also failed (${osrmErr.message}). Using straight-line fallback.`);
      return {
        path: [incidentCoords, facility.coordinates],
        distanceMeters: 0,
        source: 'fallback',
        facility
      };
    }
  } catch (error) {
    console.error(`${tag} Unexpected error in incident-to-facility route:`, error);
    return null;
  }
}

// ─── HTTP Handlers for A* Routes ─────────────────────────────────────────────

/**
 * @desc    Get A* route from responder to incident
 * @route   GET /api/emergencies/:id/route/responder
 * @access  Private
 */
export async function getResponderRouteHandler(req, res) {
  try {
    const route = await getResponderToIncidentRoute(req.params.id);

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Emergency or assigned responder not found'
      });
    }

    return res.status(200).json({
      success: true,
      geometry: route.path,
      distanceMeters: route.distanceMeters,
      source: route.source
    });
  } catch (error) {
    console.error(`[route][${req.params.id}] getResponderRouteHandler UNEXPECTED ERROR:`, error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * @desc    Get A* route from incident to recommended facility
 * @route   GET /api/emergencies/:id/route/facility
 * @access  Private
 */
export async function getFacilityRouteHandler(req, res) {
  try {
    const route = await getIncidentToFacilityRoute(req.params.id, req.query.facilityType);

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Emergency not found'
      });
    }

    return res.status(200).json({
      success: true,
      geometry: route.path,
      distanceMeters: route.distanceMeters,
      source: route.source,
      facility: route.facility
    });
  } catch (error) {
    console.error(`[route][${req.params.id}] getFacilityRouteHandler UNEXPECTED ERROR:`, error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}