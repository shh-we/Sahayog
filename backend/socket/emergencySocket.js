/**
 * socket/emergencySocket.js
 *
 * RETIRED — legacy notification path.
 *
 * The `notifyNearbyResponders` function previously emitted `new_emergency`
 * as a global broadcast to individual responder rooms using the old
 * client-controlled join mechanism.
 *
 * This is now a no-op stub retained only to prevent import errors from any
 * remaining legacy callers during the transition.  Feature 4 must use
 * `publishDispatchOffer` from `emergencyPublisher.js` instead.
 *
 * DO NOT add logic to this file.  It will be deleted once Feature 4 is complete.
 */

/**
 * @deprecated Use publishDispatchOffer from emergencyPublisher.js instead.
 * This function is a no-op and will be removed with Feature 4.
 */
export function notifyNearbyResponders(_responders, _emergency) {
  // Intentionally empty — retired in Feature 5.
  // Feature 4 will call publishDispatchOffer() for each selected candidate.
}