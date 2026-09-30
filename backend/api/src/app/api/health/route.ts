import { NextResponse } from 'next/server';

export async function GET() {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';

  return NextResponse.json(
    {
      status: 'ok',
      service: 'smartpump-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mqtt: {
        broker: brokerUrl,
        note: 'MQTT service initialized at server start via instrumentation hook',
      },
    },
    { status: 200 }
  );
}
