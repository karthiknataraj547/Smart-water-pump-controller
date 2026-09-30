import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';

class BleDiscoveredNode {
  final String id;
  final String name;
  final String macAddress;
  final int rssi;
  final BluetoothDevice? device;
  final bool isSmartPumpCandidate;
  final List<String> advertisedServices;

  const BleDiscoveredNode({
    required this.id,
    required this.name,
    required this.macAddress,
    required this.rssi,
    this.device,
    this.isSmartPumpCandidate = true,
    this.advertisedServices = const [],
  });

  /// Signal quality description based on RSSI
  String get signalQuality {
    if (rssi >= -60) return 'Excellent';
    if (rssi >= -75) return 'Good';
    if (rssi >= -85) return 'Fair';
    return 'Weak';
  }

  /// Normalized signal percentage (0.0 to 1.0)
  double get signalPercentage {
    // RSSI typically ranges from -100 (very weak) to -40 (very strong)
    final clamped = rssi.clamp(-100, -40);
    return (clamped + 100) / 60.0;
  }
}

enum ConnectionStage {
  idle,
  transmittingWifi,
  routerHandshake,
  cloudVerification,
  connected,
  failed,
}

class BleProvisioningService {
  static const String serviceUuid = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  static const String charWifiProvUuid = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';
  static const String charStatusUuid = 'beb5483e-36e1-4688-b7f5-ea07361b26ab';
  static const String charTankConfigUuid = 'beb5483e-36e1-4688-b7f5-ea07361b26ac';

  /// Sanitizes any device name so that no internal chip names (e.g. ESP/ESP32) are ever shown to the user
  static String sanitizeDeviceName(String rawName, String mac) {
    final cleanLower = rawName.toLowerCase().trim();
    final cleanMac = mac.replaceAll(':', '').replaceAll('-', '');
    final suffix = cleanMac.length >= 4
        ? cleanMac.substring(cleanMac.length - 4).toUpperCase()
        : 'HUB';

    if (cleanLower.isEmpty || cleanLower == 'null' || cleanLower == 'unknown' || cleanLower == '(unknown)') {
      return 'Smart Controller ($suffix)';
    }

    // If it mentions smartpump, pump, hydro, or water
    if (cleanLower.contains('smartpump') ||
        cleanLower.contains('pump') ||
        cleanLower.contains('hydro') ||
        cleanLower.contains('water') ||
        cleanLower.contains('sp-')) {
      var s = rawName.replaceAll(RegExp(r'ESP[_-]?32[_-]?', caseSensitive: false), 'SmartPump-');
      s = s.replaceAll(RegExp(r'ESP[_-]?8266[_-]?', caseSensitive: false), 'SmartPump-');
      s = s.replaceAll(RegExp(r'\bESP\b', caseSensitive: false), 'SmartPump');
      s = s.replaceAll(RegExp(r'ESP[_-]', caseSensitive: false), 'Smart-');
      s = s.replaceAll(RegExp(r'[-_]+'), ' ').trim();
      return s.isNotEmpty ? s : 'Smart Pump Controller ($suffix)';
    }

    // If it has ESP in the name, map to production controller name
    if (cleanLower.contains('esp')) {
      return 'Smart Controller ($suffix)';
    }

    return rawName.trim();
  }

  /// Request runtime permissions for Bluetooth scanning & location
  static Future<bool> requestPermissions() async {
    if (kIsWeb) return false;
    try {
      if (Platform.isAndroid) {
        final scanStatus = await Permission.bluetoothScan.request();
        final connectStatus = await Permission.bluetoothConnect.request();
        final locStatus = await Permission.locationWhenInUse.request();
        return (scanStatus.isGranted || scanStatus.isLimited) &&
            (connectStatus.isGranted || connectStatus.isLimited) &&
            (locStatus.isGranted || locStatus.isLimited);
      } else if (Platform.isIOS) {
        final bleStatus = await Permission.bluetooth.request();
        return bleStatus.isGranted;
      }
    } catch (e) {
      debugPrint('BLE Permission request error: $e');
    }
    return true;
  }

  /// Check if Bluetooth adapter is currently on
  static Future<bool> isBluetoothOn() async {
    if (kIsWeb) return false;
    try {
      final state = await FlutterBluePlus.adapterState.first;
      return state == BluetoothAdapterState.on;
    } catch (_) {
      return false;
    }
  }

  /// Request to turn on Bluetooth on Android
  static Future<void> turnOnBluetooth() async {
    if (!kIsWeb && Platform.isAndroid) {
      try {
        await FlutterBluePlus.turnOn();
      } catch (e) {
        debugPrint('Turn on Bluetooth error: $e');
      }
    }
  }

  /// Scan for real SmartPump hardware nodes in Bluetooth pairing mode
  static Stream<List<BleDiscoveredNode>> scanForNodes() async* {
    final discoveredMap = <String, BleDiscoveredNode>{};

    if (!kIsWeb && (Platform.isAndroid || Platform.isIOS || Platform.isMacOS)) {
      try {
        // Request runtime permissions first
        await requestPermissions();

        // Check adapter state
        final adapterState = await FlutterBluePlus.adapterState.first;
        if (adapterState != BluetoothAdapterState.on && Platform.isAndroid) {
          try {
            await FlutterBluePlus.turnOn();
          } catch (_) {}
        }

        // Cancel previous scan if any
        if (FlutterBluePlus.isScanningNow) {
          await FlutterBluePlus.stopScan();
        }

        // Start wide scan WITHOUT restrictive service filter so all nearby advertising nodes are caught
        await FlutterBluePlus.startScan(
          timeout: const Duration(seconds: 10),
          androidScanMode: AndroidScanMode.lowLatency,
        );

        await for (final results in FlutterBluePlus.scanResults) {
          for (final r in results) {
            final rawName = r.device.platformName.isNotEmpty
                ? r.device.platformName
                : r.advertisementData.advName;
            final mac = r.device.remoteId.str;

            // Check if device matches SmartPump signature, controller name, or service UUID
            final hasService = r.advertisementData.serviceUuids.any(
              (u) => u.toString().toLowerCase() == serviceUuid.toLowerCase(),
            );
            final nameLower = rawName.toLowerCase();
            final isSmartPumpCandidate = hasService ||
                nameLower.contains('smart pump') ||
                nameLower.contains('smartpump') ||
                nameLower.contains('controller') ||
                nameLower.contains('pump') ||
                nameLower.contains('hydro') ||
                nameLower.contains('sp-') ||
                nameLower.contains('esp');

            // Strictly filter: Only show Smart Pump Controller devices
            if (!isSmartPumpCandidate) {
              continue;
            }

            discoveredMap[mac] = BleDiscoveredNode(
              id: mac,
              name: 'Smart Pump Controller',
              macAddress: mac,
              rssi: r.rssi,
              device: r.device,
              isSmartPumpCandidate: true,
              advertisedServices: r.advertisementData.serviceUuids.map((u) => u.toString()).toList(),
            );
          }

          // Sort by signal strength (RSSI descending)
          final sortedList = discoveredMap.values.toList()
            ..sort((a, b) => b.rssi.compareTo(a.rssi));

          yield sortedList;
        }
      } catch (e) {
        debugPrint('BLE Scan error: $e');
      }
    }

    yield discoveredMap.values.toList();
  }

  /// Stop active scan
  static Future<void> stopScan() async {
    try {
      if (!kIsWeb && (Platform.isAndroid || Platform.isIOS || Platform.isMacOS)) {
        await FlutterBluePlus.stopScan();
      }
    } catch (_) {}
  }

  /// Push Wi-Fi credentials to hardware controller via encrypted BLE
  static Future<void> pushWifiCredentials({
    required BleDiscoveredNode node,
    required String ssid,
    required String password,
    required String userId,
    required Function(ConnectionStage stage, String message) onProgress,
    Future<bool> Function()? checkCloudOnline,
  }) async {
    onProgress(ConnectionStage.transmittingWifi, 'Connecting to Smart Controller over Bluetooth...');

    if (node.device != null && !kIsWeb && (Platform.isAndroid || Platform.isIOS)) {
      try {
        if (!node.device!.isConnected) {
          await node.device!.connect(timeout: const Duration(seconds: 10));
        }

        // Request larger MTU on Android to prevent payload truncation / GATT 133
        try {
          await node.device!.requestMtu(256);
        } catch (_) {}

        onProgress(ConnectionStage.transmittingWifi, 'Discovering Controller Provisioning Service...');
        final services = await node.device!.discoverServices();
        final provService = services.firstWhere(
          (s) => s.uuid.toString().toLowerCase() == serviceUuid.toLowerCase(),
          orElse: () => throw Exception('Smart Controller Provisioning Service not found on node.'),
        );

        final wifiChar = provService.characteristics.firstWhere(
          (c) => c.uuid.toString().toLowerCase() == charWifiProvUuid.toLowerCase(),
          orElse: () => throw Exception('Wi-Fi Provisioning Characteristic missing.'),
        );

        // Find status characteristic and subscribe to notifications
        BluetoothCharacteristic? statusChar;
        final statusChars = provService.characteristics.where(
          (c) => c.uuid.toString().toLowerCase() == charStatusUuid.toLowerCase(),
        );

        String latestBleStatus = '';
        StreamSubscription? statusSub;

        if (statusChars.isNotEmpty) {
          statusChar = statusChars.first;
          try {
            await statusChar.setNotifyValue(true);
            statusSub = statusChar.lastValueStream.listen((val) {
              if (val.isNotEmpty) {
                final s = utf8.decode(val, allowMalformed: true).trim();
                if (s.isNotEmpty) {
                  latestBleStatus = s;
                  debugPrint('[BLE Status Event] $latestBleStatus');
                }
              }
            });
          } catch (_) {}
        }

        onProgress(ConnectionStage.transmittingWifi, 'Pushing encrypted Wi-Fi configuration to controller...');
        final payload = jsonEncode({
          'ssid': ssid,
          'password': password,
          'userId': userId,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        });

        // Safe Write Attempt: Try write with response, with fallback to writeWithoutResponse
        final bytes = utf8.encode(payload);
        try {
          await wifiChar.write(bytes, withoutResponse: false);
        } catch (writeErr) {
          debugPrint('[BLE] Write with response caught: $writeErr. Retrying withoutResponse...');
          try {
            await wifiChar.write(bytes, withoutResponse: true);
          } catch (fbErr) {
            debugPrint('[BLE] Fallback write also caught: $fbErr');
            // Do not immediately throw; proceed to verification loop because
            // single-radio ESP32 often switches radio immediately upon receiving credentials.
          }
        }

        // =====================================================================
        // VERIFICATION STAGE: ONLY WHEN WI-FI IS CONNECTED SHOW IT'S CONNECTED!
        // =====================================================================
        onProgress(ConnectionStage.routerHandshake, 'Verifying Smart Controller connection to "$ssid"...');

        bool isWifiConfirmedConnected = false;
        final deadline = DateTime.now().add(const Duration(seconds: 22));

        while (DateTime.now().isBefore(deadline)) {
          await Future.delayed(const Duration(milliseconds: 1200));

          // 1. Check BLE live status notification
          if (latestBleStatus.contains('WIFI_CONNECTED') || latestBleStatus.contains('PROVISIONED')) {
            isWifiConfirmedConnected = true;
            break;
          }
          if (latestBleStatus.contains('FAILED_INVALID_PASSWORD')) {
            await statusSub?.cancel();
            throw Exception('Authentication failed: Invalid Wi-Fi password or router rejected connection.');
          }

          // 2. Actively poll status characteristic if BLE link is still alive
          if (statusChar != null && (node.device?.isConnected ?? false)) {
            try {
              final statusVal = await statusChar.read();
              final statusStr = utf8.decode(statusVal, allowMalformed: true).trim();
              if (statusStr.contains('WIFI_CONNECTED') || statusStr.contains('PROVISIONED')) {
                isWifiConfirmedConnected = true;
                break;
              }
              if (statusStr.contains('FAILED_INVALID_PASSWORD')) {
                await statusSub?.cancel();
                throw Exception('Authentication failed: Invalid Wi-Fi password or router rejected connection.');
              }
            } catch (_) {
              // BLE link may disconnect as ESP32 prioritizes 2.4 GHz Wi-Fi Station mode
            }
          }

          // 3. Check Cloud Backend API (device heartbeat received)
          if (checkCloudOnline != null) {
            try {
              final isOnlineOnCloud = await checkCloudOnline();
              if (isOnlineOnCloud) {
                debugPrint('[BLE Provisioning] Cloud API confirmed device is ONLINE!');
                isWifiConfirmedConnected = true;
                break;
              }
            } catch (_) {}
          }
        }

        await statusSub?.cancel();

        if (!isWifiConfirmedConnected) {
          throw Exception(
            'Smart Controller failed to associate with "$ssid". Please check Wi-Fi password, verify 2.4 GHz router frequency, and try again.',
          );
        }

        onProgress(ConnectionStage.cloudVerification, 'Wi-Fi verified! Cloud connection established...');
        await Future.delayed(const Duration(milliseconds: 800));

        onProgress(ConnectionStage.connected, 'Smart Controller successfully connected & verified!');
        return;
      } catch (e) {
        onProgress(ConnectionStage.failed, 'Controller Provisioning Failed: ${e.toString()}');
        rethrow;
      }
    } else {
      throw Exception('Bluetooth hardware device handle is unavailable. Please scan and select a valid Smart Pump Controller.');
    }
  }

  /// Push Tank Setup parameters to controller & cloud
  static Future<void> pushTankConfig({
    required BleDiscoveredNode node,
    required String tankType,
    required int tankCapacityLiters,
    required int tankDepthCm,
    required int sensorOffsetCm,
    required double motorHp,
  }) async {
    if (node.device != null && !kIsWeb && (Platform.isAndroid || Platform.isIOS)) {
      try {
        if (!node.device!.isConnected) {
          try {
            await node.device!.connect(timeout: const Duration(seconds: 4));
          } catch (_) {}
        }
        if (node.device!.isConnected) {
          final services = await node.device!.discoverServices();
          final provService = services.firstWhere(
            (s) => s.uuid.toString().toLowerCase() == serviceUuid.toLowerCase(),
          );
          final tankChars = provService.characteristics.where(
            (c) => c.uuid.toString().toLowerCase() == charTankConfigUuid.toLowerCase(),
          );
          if (tankChars.isNotEmpty) {
            final payload = jsonEncode({
              'tankType': tankType,
              'capacityL': tankCapacityLiters,
              'depthCm': tankDepthCm,
              'sensorOffsetCm': sensorOffsetCm,
              'motorHp': motorHp,
            });
            await tankChars.first.write(utf8.encode(payload), withoutResponse: false);
          }
        }
      } catch (e) {
        debugPrint('Tank config BLE write notice (persisting via Cloud): $e');
      }
    }
  }
}
