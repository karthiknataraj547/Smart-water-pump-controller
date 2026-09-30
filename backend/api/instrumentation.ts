/**
 * Next.js Instrumentation Hook
 *
 * This file runs ONCE when the Next.js server starts, on the Node.js runtime.
 * It bootstraps the MQTT service so that the backend is subscribed to device
 * heartbeats from the moment the server starts — not just after the first
 * HTTP request that happens to import the MQTT module.
 *
 * Without this, devices appear OFFLINE because heartbeat messages from the
 * ESP32 arrive on the MQTT broker but the backend isn't listening yet.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Run on Node.js runtime — skip Edge runtime only.
  // In dev mode, NEXT_RUNTIME may be undefined; in production it is 'nodejs'.
  // Either way we want to run — just not in Edge functions.
  if (process.env.NEXT_RUNTIME !== 'edge') {
    console.log('[Instrumentation] Bootstrapping MQTT service at server start...');

    // Dynamic import so this never runs in Edge runtime
    const { mqttService } = await import('./src/services/mqtt');

    // Force the module to evaluate — the mqttService singleton is created and
    // listeners are registered as a side-effect of the module import above.
    // Log the broker URL for visibility.
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
    console.log(`[Instrumentation] MQTT service initialised → broker: ${brokerUrl}`);

    // Verify the raw client exists (non-null check keeps TS happy)
    if (mqttService) {
      console.log('[Instrumentation] MQTT service ready. Device heartbeats will be processed immediately.');
    }
  }
}
