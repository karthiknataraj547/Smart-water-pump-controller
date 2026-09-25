// MQTT Topic Hierarchy Builders and Parsers

export class MqttTopicBuilder {
  static heartbeat(userId: string, deviceId: string): string {
    return `users/${userId}/devices/${deviceId}/heartbeat`;
  }

  static state(userId: string, deviceId: string): string {
    return `users/${userId}/devices/${deviceId}/state`;
  }

  static telemetry(userId: string, deviceId: string): string {
    return `users/${userId}/devices/${deviceId}/telemetry`;
  }

  static command(userId: string, deviceId: string): string {
    return `users/${userId}/devices/${deviceId}/command`;
  }

  static ack(userId: string, deviceId: string): string {
    return `users/${userId}/devices/${deviceId}/ack`;
  }

  static events(userId: string, deviceId: string): string {
    return `users/${userId}/devices/${deviceId}/events`;
  }

  static subnode(userId: string, deviceId: string): string {
    return `users/${userId}/devices/${deviceId}/subnode`;
  }

  static parse(topic: string): { userId?: string; deviceId?: string; channel?: string } | null {
    const parts = topic.split('/');
    if (parts.length === 5 && parts[0] === 'users' && parts[2] === 'devices') {
      return {
        userId: parts[1],
        deviceId: parts[3],
        channel: parts[4]
      };
    }
    return null;
  }
}
