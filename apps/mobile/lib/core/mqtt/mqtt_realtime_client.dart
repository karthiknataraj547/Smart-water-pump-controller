import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

typedef DeviceStatusCallback = void Function(String serialNumber, bool isOnline);
typedef DeviceHeartbeatCallback = void Function(String serialNumber, Map<String, dynamic> data);
typedef DeviceTelemetryCallback = void Function(String serialNumber, Map<String, dynamic> data);

class MqttRealtimeClient {
  static final MqttRealtimeClient instance = MqttRealtimeClient._internal();
  MqttRealtimeClient._internal();

  MqttServerClient? _client;
  bool _isConnected = false;
  Timer? _reconnectTimer;
  Timer? _watchdogTimer;
  bool _isConnecting = false;

  final Map<String, bool> _deviceStatus = {};
  final Map<String, DateTime> _lastSeen = {};

  DeviceStatusCallback? onStatusUpdate;
  DeviceHeartbeatCallback? onHeartbeatUpdate;
  DeviceTelemetryCallback? onTelemetryUpdate;

  bool get isConnected => _isConnected;

  bool hasReceivedStatusFor(String serialNumber) {
    if (_deviceStatus.containsKey(serialNumber)) return true;
    for (final k in _deviceStatus.keys) {
      if (k.contains(serialNumber) || serialNumber.contains(k)) return true;
    }
    return false;
  }

  bool isDeviceOnline(String serialNumber) {
    if (_deviceStatus.containsKey(serialNumber)) {
      return _deviceStatus[serialNumber] ?? false;
    }
    for (final entry in _deviceStatus.entries) {
      if (entry.key.contains(serialNumber) || serialNumber.contains(entry.key)) {
        return entry.value;
      }
    }
    return false;
  }

  Future<void> initialize({
    String broker = 'broker.emqx.io',
    int port = 1883,
  }) async {
    if (_isConnected || _isConnecting) return;
    _isConnecting = true;

    try {
      final clientId = 'sp_app_${DateTime.now().millisecondsSinceEpoch}_${DateTime.now().microsecond % 1000}';
      final client = MqttServerClient(broker, clientId);
      client.port = port;
      client.logging(on: false);
      client.setProtocolV311();
      client.keepAlivePeriod = 20;
      client.autoReconnect = true;
      client.resubscribeOnAutoReconnect = true;

      final connMessage = MqttConnectMessage()
          .withClientIdentifier(clientId)
          .startClean();
      client.connectionMessage = connMessage;

      client.onConnected = _onConnected;
      client.onDisconnected = _onDisconnected;
      client.onAutoReconnected = _onAutoReconnected;

      final status = await client.connect().timeout(
        const Duration(seconds: 8),
        onTimeout: () {
          debugPrint('[MQTT] Connection timeout to $broker:$port');
          return null;
        },
      );

      if (status?.state == MqttConnectionState.connected) {
        _client = client;
        _isConnected = true;
        _isConnecting = false;
        _startWatchdog();
        _subscribeToDeviceTopics();
        _listenToIncomingMessages();
        debugPrint('[MQTT] Real-time MQTT connected successfully to $broker:$port');
      } else {
        _isConnecting = false;
        _scheduleReconnect();
      }
    } catch (e) {
      debugPrint('[MQTT] Failed to initialize connection: $e');
      _isConnecting = false;
      _scheduleReconnect();
    }
  }

  void _onConnected() {
    debugPrint('[MQTT] Connected to EMQX broker successfully.');
    _isConnected = true;
    _isConnecting = false;
    _startWatchdog();
    _subscribeToDeviceTopics();
  }

  void _onDisconnected() {
    debugPrint('[MQTT] Disconnected from EMQX broker.');
    _isConnected = false;
    _isConnecting = false;
    _scheduleReconnect();
  }

  void _onAutoReconnected() {
    debugPrint('[MQTT] Auto-reconnected to EMQX broker.');
    _isConnected = true;
    _subscribeToDeviceTopics();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      if (!_isConnected && !_isConnecting) {
        initialize();
      }
    });
  }

  void _startWatchdog() {
    _watchdogTimer?.cancel();
    // Heartbeat timeout watchdog: if a device marked online doesn't ping for > 15s, mark offline
    _watchdogTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      final now = DateTime.now();
      for (final entry in _lastSeen.entries) {
        final serial = entry.key;
        final last = entry.value;
        if (_deviceStatus[serial] == true && now.difference(last).inSeconds > 15) {
          debugPrint('[MQTT-Watchdog] Device $serial heartbeat timeout (>15s). Marking OFFLINE.');
          _deviceStatus[serial] = false;
          onStatusUpdate?.call(serial, false);
        }
      }
    });
  }

  void _subscribeToDeviceTopics() {
    if (_client == null || !_isConnected) return;
    try {
      _client!.subscribe('users/+/devices/+/status', MqttQos.atLeastOnce);
      _client!.subscribe('users/+/devices/+/heartbeat', MqttQos.atLeastOnce);
      _client!.subscribe('users/+/devices/+/telemetry', MqttQos.atLeastOnce);
      _client!.subscribe('devices/+/status', MqttQos.atLeastOnce);
      _client!.subscribe('devices/+/heartbeat', MqttQos.atLeastOnce);
      _client!.subscribe('devices/+/telemetry', MqttQos.atLeastOnce);
      debugPrint('[MQTT] Subscribed to real-time hardware status & heartbeat topics.');
    } catch (e) {
      debugPrint('[MQTT] Subscription error: $e');
    }
  }

  void _listenToIncomingMessages() {
    _client?.updates?.listen((List<MqttReceivedMessage<MqttMessage>> messages) {
      for (final raw in messages) {
        try {
          final pubMsg = raw.payload as MqttPublishMessage;
          final payloadStr = MqttPublishPayload.bytesToStringAsString(pubMsg.payload.message);
          final topic = raw.topic;

          _handleIncomingMessage(topic, payloadStr);
        } catch (e) {
          debugPrint('[MQTT] Error parsing incoming message: $e');
        }
      }
    });
  }

  void _handleIncomingMessage(String topic, String payload) {
    final parts = topic.split('/');
    String? serialNumber;

    // users/{userId}/devices/{serialNumber}/status
    if (parts.length >= 5 && parts[0] == 'users' && parts[2] == 'devices') {
      serialNumber = parts[3];
    } else if (parts.length >= 3 && parts[0] == 'devices') {
      serialNumber = parts[1];
    }

    if (serialNumber == null || serialNumber.isEmpty) return;

    if (topic.endsWith('/status')) {
      final isOnline = payload.trim().toUpperCase() == 'ONLINE';
      _deviceStatus[serialNumber] = isOnline;
      if (isOnline) {
        _lastSeen[serialNumber] = DateTime.now();
      }
      debugPrint('[MQTT] Live status update: $serialNumber -> ${isOnline ? "ONLINE" : "OFFLINE"}');
      onStatusUpdate?.call(serialNumber, isOnline);
    } else if (topic.endsWith('/heartbeat')) {
      try {
        final data = jsonDecode(payload) as Map<String, dynamic>;
        _deviceStatus[serialNumber] = true;
        _lastSeen[serialNumber] = DateTime.now();
        onStatusUpdate?.call(serialNumber, true);
        onHeartbeatUpdate?.call(serialNumber, data);
      } catch (_) {}
    } else if (topic.endsWith('/telemetry')) {
      try {
        final data = jsonDecode(payload) as Map<String, dynamic>;
        _deviceStatus[serialNumber] = true;
        _lastSeen[serialNumber] = DateTime.now();
        onStatusUpdate?.call(serialNumber, true);
        onTelemetryUpdate?.call(serialNumber, data);
      } catch (_) {}
    }
  }

  /// Send a command to the physical hardware over MQTT
  Future<bool> sendCommand({
    String? userId,
    required String serialNumber,
    required String command,
    Map<String, dynamic>? extraArgs,
  }) async {
    if (_client == null || !_isConnected) {
      await initialize();
      if (!_isConnected) return false;
    }

    try {
      final commandId = 'cmd_${DateTime.now().millisecondsSinceEpoch}_${(DateTime.now().microsecondsSinceEpoch % 1000)}';
      final payloadMap = {
        'command': command,
        'commandId': commandId,
        'timestamp': DateTime.now().toIso8601String(),
        if (extraArgs != null) ...extraArgs,
      };

      final payloadStr = jsonEncode(payloadMap);
      final builder = MqttClientPayloadBuilder();
      builder.addString(payloadStr);

      final payloadData = builder.payload;
      if (payloadData == null) return false;

      // Publish to direct device command topic
      _client!.publishMessage(
        'devices/$serialNumber/command',
        MqttQos.atLeastOnce,
        payloadData,
      );

      // Also publish to user-scoped command topic if userId is available
      if (userId != null && userId.isNotEmpty) {
        _client!.publishMessage(
          'users/$userId/devices/$serialNumber/command',
          MqttQos.atLeastOnce,
          payloadData,
        );
      }

      // Also publish with wildcard user topic
      _client!.publishMessage(
        'users/+/devices/$serialNumber/command',
        MqttQos.atLeastOnce,
        payloadData,
      );

      debugPrint('[MQTT] Command $command published for $serialNumber');
      return true;
    } catch (e) {
      debugPrint('[MQTT] Failed to publish command $command: $e');
      return false;
    }
  }

  /// Remotely reboot the ESP32 hardware without physical buttons
  Future<bool> rebootHardware({String? userId, required String serialNumber}) async {
    return sendCommand(
      userId: userId,
      serialNumber: serialNumber,
      command: 'REBOOT_DEVICE',
    );
  }

  void dispose() {
    _reconnectTimer?.cancel();
    _watchdogTimer?.cancel();
    _client?.disconnect();
    _isConnected = false;
  }
}
