/**
 * Next.js Instrumentation Hook
 *
 * Placed in src/instrumentation.ts so Next.js 15 picks it up when using the src directory.
 * Bootstraps the MQTT service on server start so that heartbeats and telemetry are
 * captured immediately without waiting for an incoming HTTP request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'edge') {
    console.log('[Instrumentation] Bootstrapping MQTT service at server start...');

    try {
      const { mqttService } = await import('./services/mqtt');
      const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
      console.log(`[Instrumentation] MQTT service initialised → broker: ${brokerUrl}`);

      if (mqttService) {
        console.log('[Instrumentation] MQTT service ready. Listening for device heartbeats.');
      }
    } catch (err) {
      console.error('[Instrumentation] Error initializing MQTT service:', err);
    }
  }
}
