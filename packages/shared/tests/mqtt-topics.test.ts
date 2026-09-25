import { MqttTopicBuilder } from '../src/mqtt-topics';

describe('MqttTopicBuilder', () => {
  const userId = 'usr_102';
  const deviceId = 'dev_sp3918';

  it('builds heartbeat topic correctly', () => {
    expect(MqttTopicBuilder.heartbeat(userId, deviceId)).toBe('users/usr_102/devices/dev_sp3918/heartbeat');
  });

  it('builds command topic correctly', () => {
    expect(MqttTopicBuilder.command(userId, deviceId)).toBe('users/usr_102/devices/dev_sp3918/command');
  });

  it('builds ack topic correctly', () => {
    expect(MqttTopicBuilder.ack(userId, deviceId)).toBe('users/usr_102/devices/dev_sp3918/ack');
  });

  it('builds telemetry topic correctly', () => {
    expect(MqttTopicBuilder.telemetry(userId, deviceId)).toBe('users/usr_102/devices/dev_sp3918/telemetry');
  });

  it('parses valid user device topic', () => {
    const parsed = MqttTopicBuilder.parse('users/usr_102/devices/dev_sp3918/telemetry');
    expect(parsed).toEqual({
      userId: 'usr_102',
      deviceId: 'dev_sp3918',
      channel: 'telemetry'
    });
  });

  it('returns null for invalid topic format', () => {
    expect(MqttTopicBuilder.parse('random/topic/test')).toBeNull();
  });
});
