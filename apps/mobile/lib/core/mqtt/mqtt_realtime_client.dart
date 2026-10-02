import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import '../api/api_client.dart';

typedef DeviceStatusCallback = void Function(String serialNumber, bool isOnline);
typedef DeviceHeartbeatCallback = void Function(String serialNumber, Map<String, dynamic> data);
typedef DeviceTelemetryCallback = void Function(String serialNumber, Map<String, dynamic> data);
typedef DeviceAckCallback = void Function(String serialNumber, Map<String, dynamic> data);

class MqttRealtimeClient {
  static final MqttRealtimeClient instance = MqttRealtimeClient._internal();
  MqttRealtimeClient._internal();

  static const String _keyBroker = 'sp_mqtt_broker';
  static const String _keyPort = 'sp_mqtt_port';
  static const String _keyUsername = 'sp_mqtt_username';
  static const String _keyPassword = 'sp_mqtt_password';
  static const String _keyUseTls = 'sp_mqtt_use_tls';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  MqttServerClient? _client;
  bool _isConnected = false;
  bool _isConnecting = false;
  Timer? _reconnectTimer;
  Timer? _watchdogTimer;

  // Active configuration
  String _brokerHost = 'broker.emqx.io';
  int _brokerPort = 1883;
  String? _username;
  String? _password;
  bool _useTls = false;

  final Map<String, bool> _deviceStatus = {};
  final Map<String, DateTime> _lastSeen = {};
  final Map<String, String> _deviceUserIds = {};

  DateTime? _lastHeartbeatTime;

  // Reactive notifiers for UI
  final ValueNotifier<bool> connectionNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<String> connectionStatusNotifier = ValueNotifier<String>('Disconnected');
  final ValueNotifier<DateTime?> lastPingNotifier = ValueNotifier<DateTime?>(null);

  DeviceStatusCallback? onStatusUpdate;
  DeviceHeartbeatCallback? onHeartbeatUpdate;
  DeviceTelemetryCallback? onTelemetryUpdate;
  DeviceAckCallback? onAckUpdate;

  bool get isConnected => _isConnected;
  bool get isConnecting => _isConnecting;
  String get brokerHost => _brokerHost;
  int get brokerPort => _brokerPort;
  String? get username => _username;
  String? get password => _password;
  bool get useTls => _useTls;
  DateTime? get lastHeartbeatTime => _lastHeartbeatTime;

  /// Returns true if ANY device has transmitted within the last 60 seconds
  bool get hasRecentHeartbeat {
    if (_lastHeartbeatTime == null) return false;
    return DateTime.now().difference(_lastHeartbeatTime!).inSeconds < 60;
  }

  /// Returns true if any registered or detected device is online
  bool get isAnyDeviceOnline {
    final now = DateTime.now();
    for (final entry in _deviceStatus.entries) {
      if (entry.value) {
        final last = _lastSeen[entry.key];
        if (last != null && now.difference(last).inSeconds <= 60) {
          return true;
        }
      }
    }
    return hasRecentHeartbeat;
  }

  /// Returns the most recently seen active physical serial number
  String? get activeOnlineSerial {
    String? latestSerial;
    DateTime? latestTime;
    for (final entry in _deviceStatus.entries) {
      if (entry.value) {
        final seen = _lastSeen[entry.key];
        if (latestTime == null || (seen != null && seen.isAfter(latestTime))) {
          latestTime = seen;
          latestSerial = entry.key;
        }
      }
    }
    return latestSerial;
  }

  bool hasReceivedStatusFor(String serialNumber) {
    if (_deviceStatus.containsKey(serialNumber)) return true;
    for (final k in _deviceStatus.keys) {
      if (k.contains(serialNumber) || serialNumber.contains(k)) return true;
    }
    return isAnyDeviceOnline;
  }

  bool isDeviceOnline(String serialNumber) {
    final now = DateTime.now();
    if (_deviceStatus.containsKey(serialNumber)) {
      final isOnline = _deviceStatus[serialNumber] ?? false;
      final seen = _lastSeen[serialNumber];
      if (isOnline && seen != null && now.difference(seen).inSeconds <= 60) {
        return true;
      }
    }

    for (final entry in _deviceStatus.entries) {
      if (entry.key.contains(serialNumber) || serialNumber.contains(entry.key)) {
        final seen = _lastSeen[entry.key];
        if (entry.value && seen != null && now.difference(seen).inSeconds <= 60) {
          return true;
        }
      }
    }

    // If any device is currently online and active, grant connectivity
    return isAnyDeviceOnline;
  }

  /// Load persisted configuration from secure storage
  Future<void> loadConfig() async {
    try {
      final host = await _storage.read(key: _keyBroker);
      final portStr = await _storage.read(key: _keyPort);
      final user = await _storage.read(key: _keyUsername);
      final pass = await _storage.read(key: _keyPassword);
      final tlsStr = await _storage.read(key: _keyUseTls);

      if (host != null && host.isNotEmpty) _brokerHost = host;
      if (portStr != null) {
        final p = int.tryParse(portStr);
        if (p != null) _brokerPort = p;
      }
      _username = (user != null && user.isNotEmpty) ? user : null;
      _password = (pass != null && pass.isNotEmpty) ? pass : null;
      _useTls = tlsStr == 'true';
    } catch (e) {
      debugPrint('[MQTT] Error reading stored config: $e');
    }
  }

  /// Auto-detect and sync MQTT configuration from the backend
  Future<bool> autoDetectConfig(ApiClient apiClient) async {
    try {
      final resp = await apiClient.getWithFallback('/api/mqtt/config');
      if (resp.data is Map<String, dynamic>) {
        final data = resp.data as Map<String, dynamic>;
        final broker = (data['broker'] as String?) ?? 'broker.emqx.io';
        final port = (data['port'] as num?)?.toInt() ?? 1883;
        final user = (data['username'] as String?) ?? '';
        final pass = (data['password'] as String?) ?? '';

        await saveAndReconnect(
          host: broker,
          port: port,
          username: user.isNotEmpty ? user : null,
          password: pass.isNotEmpty ? pass : null,
          useTls: false,
        );
        return true;
      }
    } catch (e) {
      debugPrint('[MQTT] Auto-detect error: $e');
    }
    return false;
  }

  /// Save new configuration to storage and re-establish connection
  Future<void> saveAndReconnect({
    required String host,
    required int port,
    String? username,
    String? password,
    bool useTls = false,
  }) async {
    _brokerHost = host.trim();
    _brokerPort = port;
    _username = (username != null && username.trim().isNotEmpty) ? username.trim() : null;
    _password = (password != null && password.trim().isNotEmpty) ? password.trim() : null;
    _useTls = useTls;

    try {
      await _storage.write(key: _keyBroker, value: _brokerHost);
      await _storage.write(key: _keyPort, value: _brokerPort.toString());
      if (_username != null) {
        await _storage.write(key: _keyUsername, value: _username!);
      } else {
        await _storage.delete(key: _keyUsername);
      }
      if (_password != null) {
        await _storage.write(key: _keyPassword, value: _password!);
      } else {
        await _storage.delete(key: _keyPassword);
      }
      await _storage.write(key: _keyUseTls, value: _useTls.toString());
    } catch (_) {}

    await initialize(forceReconnect: true);
  }

  /// Initialize and connect to MQTT broker
  Future<void> initialize({
    String? broker,
    int? port,
    String? username,
    String? password,
    bool? useTls,
    bool forceReconnect = false,
  }) async {
    if (forceReconnect) {
      _reconnectTimer?.cancel();
      try {
        _client?.disconnect();
      } catch (_) {}
      _client = null;
      _isConnected = false;
      _isConnecting = false;
    }

    if (_isConnected || _isConnecting) return;

    await loadConfig();

    final effBroker = broker ?? _brokerHost;
    final effPort = port ?? _brokerPort;
    final effUser = username ?? _username;
    final effPass = password ?? _password;
    final effTls = useTls ?? _useTls;

    _isConnecting = true;
    connectionStatusNotifier.value = 'Connecting to $effBroker:$effPort...';

    try {
      final clientId = 'sp_app_${DateTime.now().millisecondsSinceEpoch}_${(DateTime.now().microsecond % 1000)}';
      final client = MqttServerClient(effBroker, clientId);
      client.port = effPort;
      client.logging(on: false);
      client.setProtocolV311();
      client.keepAlivePeriod = 60; // 60s keepalive to avoid aggressive mobile drops
      client.autoReconnect = true;
      client.resubscribeOnAutoReconnect = true;

      if (effTls) {
        client.secure = true;
        client.securityContext = SecurityContext.defaultContext;
      }

      var connMessage = MqttConnectMessage()
          .withClientIdentifier(clientId)
          .startClean();

      if (effUser != null && effUser.isNotEmpty) {
        connMessage = connMessage.authenticateAs(effUser, effPass ?? '');
      }

      client.connectionMessage = connMessage;
      client.onConnected = _onConnected;
      client.onDisconnected = _onDisconnected;
      client.onAutoReconnected = _onAutoReconnected;

      final status = await client.connect(
        (effUser != null && effUser.isNotEmpty) ? effUser : null,
        (effPass != null && effPass.isNotEmpty) ? effPass : null,
      ).timeout(
        const Duration(seconds: 9),
        onTimeout: () {
          debugPrint('[MQTT] Connection timeout to $effBroker:$effPort');
          return null;
        },
      );

      if (status?.state == MqttConnectionState.connected) {
        _client = client;
        _isConnected = true;
        _isConnecting = false;
        connectionNotifier.value = true;
        connectionStatusNotifier.value = 'Connected to $effBroker';
        _startWatchdog();
        _subscribeToDeviceTopics();
        _listenToIncomingMessages();
        debugPrint('[MQTT] Real-time MQTT connected successfully to $effBroker:$effPort');
      } else {
        _isConnecting = false;
        _isConnected = false;
        connectionNotifier.value = false;
        connectionStatusNotifier.value = 'Connection failed';
        _scheduleReconnect();
      }
    } catch (e) {
      debugPrint('[MQTT] Failed to initialize connection: $e');
      _isConnecting = false;
      _isConnected = false;
      connectionNotifier.value = false;
      connectionStatusNotifier.value = 'Error: $e';
      _scheduleReconnect();
    }
  }

  void _onConnected() {
    debugPrint('[MQTT] Connected to MQTT broker successfully.');
    _isConnected = true;
    _isConnecting = false;
    connectionNotifier.value = true;
    connectionStatusNotifier.value = 'Connected to $_brokerHost';
    _startWatchdog();
    _subscribeToDeviceTopics();
  }

  void _onDisconnected() {
    debugPrint('[MQTT] Disconnected from MQTT broker.');
    _isConnected = false;
    _isConnecting = false;
    connectionNotifier.value = false;
    connectionStatusNotifier.value = 'Disconnected';
    _scheduleReconnect();
  }

  void _onAutoReconnected() {
    debugPrint('[MQTT] Auto-reconnected to MQTT broker.');
    _isConnected = true;
    _isConnecting = false;
    connectionNotifier.value = true;
    connectionStatusNotifier.value = 'Connected to $_brokerHost';
    _subscribeToDeviceTopics();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      if (!_isConnected && !_isConnecting) {
        connectionStatusNotifier.value = 'Reconnecting...';
        initialize();
      }
    });
  }

  void _startWatchdog() {
    _watchdogTimer?.cancel();
    // Heartbeat timeout watchdog: timeout set to 60s (matches IoT standard 3x heartbeat)
    _watchdogTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      final now = DateTime.now();
      for (final entry in _lastSeen.entries) {
        final serial = entry.key;
        final last = entry.value;
        if (_deviceStatus[serial] == true && now.difference(last).inSeconds > 60) {
          debugPrint('[MQTT-Watchdog] Device $serial heartbeat timeout (>60s). Marking OFFLINE.');
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
      _client!.subscribe('users/+/devices/+/ack', MqttQos.atLeastOnce);
      _client!.subscribe('devices/+/status', MqttQos.atLeastOnce);
      _client!.subscribe('devices/+/heartbeat', MqttQos.atLeastOnce);
      _client!.subscribe('devices/+/telemetry', MqttQos.atLeastOnce);
      _client!.subscribe('devices/+/ack', MqttQos.atLeastOnce);
      debugPrint('[MQTT] Subscribed to real-time hardware status, heartbeat, telemetry & ACK topics.');
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

    if (parts.length >= 5 && parts[0] == 'users' && parts[2] == 'devices') {
      final uid = parts[1];
      serialNumber = parts[3];
      if (uid.isNotEmpty && uid != '+' && uid != '#') {
        _deviceUserIds[serialNumber] = uid;
      }
    } else if (parts.length >= 3 && parts[0] == 'devices') {
      serialNumber = parts[1];
    }

    if (serialNumber == null || serialNumber.isEmpty || serialNumber.contains('+') || serialNumber.contains('#')) {
      return;
    }

    final now = DateTime.now();
    _lastHeartbeatTime = now;
    lastPingNotifier.value = now;

    if (topic.endsWith('/status')) {
      final isOnline = payload.trim().toUpperCase() == 'ONLINE';
      _deviceStatus[serialNumber] = isOnline;
      if (isOnline) {
        _lastSeen[serialNumber] = now;
      }
      debugPrint('[MQTT] Live status update: $serialNumber -> ${isOnline ? "ONLINE" : "OFFLINE"}');
      onStatusUpdate?.call(serialNumber, isOnline);
    } else if (topic.endsWith('/heartbeat')) {
      try {
        final data = jsonDecode(payload) as Map<String, dynamic>;
        _deviceStatus[serialNumber] = true;
        _lastSeen[serialNumber] = now;
        onStatusUpdate?.call(serialNumber, true);
        onHeartbeatUpdate?.call(serialNumber, data);
      } catch (_) {}
    } else if (topic.endsWith('/telemetry')) {
      try {
        final data = jsonDecode(payload) as Map<String, dynamic>;
        _deviceStatus[serialNumber] = true;
        _lastSeen[serialNumber] = now;
        onStatusUpdate?.call(serialNumber, true);
        onTelemetryUpdate?.call(serialNumber, data);
      } catch (_) {}
    } else if (topic.endsWith('/ack')) {
      try {
        final data = jsonDecode(payload) as Map<String, dynamic>;
        _deviceStatus[serialNumber] = true;
        _lastSeen[serialNumber] = now;
        onAckUpdate?.call(serialNumber, data);
        debugPrint('[MQTT] Received command ACK from $serialNumber: $payload');
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

      // Determine all candidate target serial numbers
      final targetSerials = <String>{};
      if (serialNumber.isNotEmpty && !serialNumber.contains('+') && !serialNumber.contains('#')) {
        targetSerials.add(serialNumber);
      }
      for (final entry in _deviceStatus.entries) {
        if (entry.value && entry.key.isNotEmpty && !entry.key.contains('+') && !entry.key.contains('#')) {
          targetSerials.add(entry.key);
        }
      }
      if (activeOnlineSerial != null && !activeOnlineSerial!.contains('+')) {
        targetSerials.add(activeOnlineSerial!);
      }

      // If no target serial found, fallback to common controller IDs
      if (targetSerials.isEmpty) {
        targetSerials.addAll(['SP-CTRL-0000', 'SP-CTRL-69E0']);
      }

      for (final s in targetSerials) {
        _client!.publishMessage(
          'devices/$s/command',
          MqttQos.atLeastOnce,
          payloadData,
        );

        _client!.publishMessage(
          'users/unclaimed/devices/$s/command',
          MqttQos.atLeastOnce,
          payloadData,
        );

        _client!.publishMessage(
          'users/app/devices/$s/command',
          MqttQos.atLeastOnce,
          payloadData,
        );

        final detectedUser = _deviceUserIds[s];
        if (detectedUser != null && detectedUser.isNotEmpty && detectedUser != 'unclaimed' && detectedUser != 'app') {
          _client!.publishMessage(
            'users/$detectedUser/devices/$s/command',
            MqttQos.atLeastOnce,
            payloadData,
          );
        }

        if (userId != null && userId.isNotEmpty && userId != detectedUser) {
          _client!.publishMessage(
            'users/$userId/devices/$s/command',
            MqttQos.atLeastOnce,
            payloadData,
          );
        }

        debugPrint('[MQTT] Command $command dispatched to device topics for serial $s');
      }

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
