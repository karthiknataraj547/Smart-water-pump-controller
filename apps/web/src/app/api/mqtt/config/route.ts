import { NextResponse } from 'next/server';

/**
 * GET /api/mqtt/config
 * Exposes the active MQTT broker host, ports, and authentication configuration
 * for mobile and edge nodes so they connect to the exact same broker.
 */
export async function GET() {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
  let host = 'broker.emqx.io';
  let port = 1883;

  try {
    const parsed = new URL(brokerUrl.replace('mqtt://', 'http://').replace('mqtts://', 'https://'));
    host = parsed.hostname || 'broker.emqx.io';
    port = parsed.port ? parseInt(parsed.port, 10) : 1883;
  } catch (_) {}

  const username = process.env.MQTT_USERNAME || '';
  const password = process.env.MQTT_PASSWORD || '';
  const hasAuth = username.length > 0;

  return NextResponse.json({
    broker: host,
    port,
    tlsPort: 8883,
    wsPort: 8083,
    username,
    password,
    authRequired: hasAuth,
    serverTimestamp: new Date().toISOString()
  });
}
