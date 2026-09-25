import { MqttClient } from 'mqtt';
import { CommandPayload, CommandAckPayload, MqttTopicBuilder, CommandType } from '@smartpump/shared';

export interface PendingCommand {
  commandId: string;
  hardwareId: string;
  command: CommandType;
  resolve: (ack: CommandAckPayload) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class CommandDispatcher {
  private pendingCommands = new Map<string, PendingCommand>();

  constructor(private mqttClient: MqttClient) {}

  /**
   * Dispatch a pump or emergency command to MQTT broker and await ACK or timeout
   */
  public async dispatchCommand(
    userId: string,
    hardwareId: string,
    command: CommandType,
    timeoutMs = 5000,
    parameters?: Record<string, unknown>
  ): Promise<CommandAckPayload> {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const topic = MqttTopicBuilder.command(userId, hardwareId);

    const payload: CommandPayload = {
      commandId,
      command,
      issuedByUserId: userId,
      timestamp: Date.now(),
      ...parameters
    };

    return new Promise<CommandAckPayload>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command ${command} timed out after ${timeoutMs}ms waiting for hardware ACK`));
      }, timeoutMs);

      this.pendingCommands.set(commandId, {
        commandId,
        hardwareId,
        command,
        resolve,
        reject,
        timer
      });

      this.mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingCommands.delete(commandId);
          reject(err);
        }
      });
    });
  }

  /**
   * Invoked when an ACK packet arrives on users/{userId}/devices/{deviceId}/ack
   */
  public handleAck(ack: CommandAckPayload): void {
    const pending = this.pendingCommands.get(ack.commandId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingCommands.delete(ack.commandId);

    if (ack.status === 'SUCCESS') {
      pending.resolve(ack);
    } else {
      pending.reject(new Error(ack.errorCode || 'Hardware reported command failure'));
    }
  }
}
