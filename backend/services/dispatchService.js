export const startDispatchCalls = [];

/**
 * Start the dispatch process for a reported emergency.
 * This is a placeholder interface for Feature 4's dispatch & escalation engine.
 * 
 * @param {string} emergencyId - The ID of the emergency to dispatch.
 */
export async function startDispatch(emergencyId) {
  startDispatchCalls.push(emergencyId.toString());
  console.log(`[Feature 4 Placeholder] Starting dispatch process for emergency: ${emergencyId}`);
}
