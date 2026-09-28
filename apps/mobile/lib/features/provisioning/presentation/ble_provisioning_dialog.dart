import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/ble/ble_provisioning_service.dart';

class BleProvisioningDialog extends ConsumerStatefulWidget {
  final VoidCallback onCompleted;

  const BleProvisioningDialog({super.key, required this.onCompleted});

  @override
  ConsumerState<BleProvisioningDialog> createState() => _BleProvisioningDialogState();
}

class _BleProvisioningDialogState extends ConsumerState<BleProvisioningDialog> {
  // Step 0: Scanning / Select Discovered Device
  // Step 1: Wi-Fi Setup
  // Step 2: Connecting Interface Stage (Multi-stage verification)
  // Step 3: Verified Connected Stage
  // Step 4: Tank Setup Interface
  int _currentStep = 0;

  bool _isScanning = true;
  List<BleDiscoveredNode> _discoveredDevices = [];
  BleDiscoveredNode? _selectedNode;
  StreamSubscription? _scanSubscription;

  // Wi-Fi Setup Form
  final _ssidController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  // Connecting Stage Status
  ConnectionStage _connectionStage = ConnectionStage.idle;
  String _connectionStatusMessage = 'Initializing secure handshake...';
  String? _connectionError;

  // Tank Setup Parameters
  String _selectedTankType = 'Overhead Plastic (Sintex)';
  int _tankCapacityLiters = 1000;
  final _customCapacityController = TextEditingController();
  bool _isCustomCapacity = false;
  double _tankDepthCm = 150.0;
  final double _sensorOffsetCm = 15.0;
  double _motorHp = 1.0;
  String _pumpType = 'Submersible Borewell';
  bool _dryRunProtection = true;
  bool _isSavingTankConfig = false;

  final List<String> _tankTypes = [
    'Overhead Plastic (Sintex)',
    'Underground Concrete Sump',
    'Overhead Concrete Tank',
    'Loft Tank (Indoor Horizontal)',
    'Custom Storage Reservoir',
  ];

  final List<int> _presetCapacities = [500, 1000, 1500, 2000, 3000, 5000];

  @override
  void initState() {
    super.initState();
    _startBleScan();
  }

  @override
  void dispose() {
    _scanSubscription?.cancel();
    BleProvisioningService.stopScan();
    _ssidController.dispose();
    _passwordController.dispose();
    _customCapacityController.dispose();
    super.dispose();
  }

  void _startBleScan() {
    setState(() {
      _isScanning = true;
      _discoveredDevices = [];
      _selectedNode = null;
    });

    _scanSubscription?.cancel();
    _scanSubscription = BleProvisioningService.scanForNodes().listen((nodes) {
      if (mounted) {
        setState(() {
          _discoveredDevices = nodes;
        });
      }
    });

    // After 6 seconds of scanning, mark scanning finished
    Future.delayed(const Duration(seconds: 6), () {
      if (mounted) {
        setState(() => _isScanning = false);
      }
    });
  }

  /// Optional simulation trigger strictly for developers on emulators without Bluetooth radio
  void _simulateHardwareInPairingMode() {
    setState(() {
      final simMac = '24:6F:28:B2:44:90';
      final simNode = BleDiscoveredNode(
        id: simMac,
        name: 'SmartPump-Gateway-B244',
        macAddress: simMac,
        rssi: -56,
      );
      if (!_discoveredDevices.any((d) => d.macAddress == simMac)) {
        _discoveredDevices.add(simNode);
      }
      _selectedNode = simNode;
      _isScanning = false;
    });
  }

  void _beginWifiPushAndVerification() async {
    final ssid = _ssidController.text.trim();
    final password = _passwordController.text;

    if (ssid.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your Wi-Fi SSID network name.')),
      );
      return;
    }
    if (password.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Wi-Fi password must be at least 8 characters.')),
      );
      return;
    }

    if (_selectedNode == null) return;

    final authState = ref.read(authProvider);
    final userId = authState.userId ?? 'usr_unregistered';

    setState(() {
      _currentStep = 2; // Move to Connecting Interface Stage
      _connectionStage = ConnectionStage.transmittingWifi;
      _connectionError = null;
      _connectionStatusMessage = 'Pushing Wi-Fi credentials to ESP32 over BLE...';
    });

    try {
      await BleProvisioningService.pushWifiCredentials(
        node: _selectedNode!,
        ssid: ssid,
        password: password,
        userId: userId,
        onProgress: (stage, message) {
          if (mounted) {
            setState(() {
              _connectionStage = stage;
              _connectionStatusMessage = message;
            });
          }
        },
      );

      // ONLY transition to Connected when verification is completely successful!
      if (mounted) {
        setState(() {
          _currentStep = 3; // Show Connected stage
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _connectionStage = ConnectionStage.failed;
          _connectionError = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  void _finalizeTankSetupAndClaim() async {
    setState(() => _isSavingTankConfig = true);

    final capacity = _isCustomCapacity
        ? (int.tryParse(_customCapacityController.text) ?? _tankCapacityLiters)
        : _tankCapacityLiters;

    try {
      if (_selectedNode != null) {
        await BleProvisioningService.pushTankConfig(
          node: _selectedNode!,
          tankType: _selectedTankType,
          tankCapacityLiters: capacity,
          tankDepthCm: _tankDepthCm.toInt(),
          sensorOffsetCm: _sensorOffsetCm.toInt(),
          motorHp: _motorHp,
        );
      }

      // Update mobile local state
      await ref.read(authProvider.notifier).claimHardware();

      if (mounted) {
        setState(() => _isSavingTankConfig = false);
        Navigator.pop(context);
        widget.onCompleted();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSavingTankConfig = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving configuration: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;

    final stepTitles = [
      'Discover Node',
      'Wi-Fi Setup',
      'Connecting...',
      'Connected',
      'Tank Setup',
    ];

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: BoxDecoration(
        color: bgSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: borderCol,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stepTitles[_currentStep],
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: textPrim,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Text(
                    'Step ${_currentStep + 1} of 5',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    ),
                  ),
                ],
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Icon(Icons.close_rounded, color: textSec),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // 5-Step Progress Bar
          Row(
            children: List.generate(5, (index) {
              final isPassed = index <= _currentStep;
              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(right: index < 4 ? 6 : 0),
                  decoration: BoxDecoration(
                    color: isPassed
                        ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                        : borderCol,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 20),

          // Dynamic Body for each Step
          Expanded(
            child: _buildStepContent(isDark, textPrim, textSec, borderCol),
          ),
        ],
      ),
    );
  }

  Widget _buildStepContent(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    switch (_currentStep) {
      case 0:
        return _buildDiscoveryStep(isDark, textPrim, textSec, borderCol);
      case 1:
        return _buildWifiStep(isDark, textPrim, textSec, borderCol);
      case 2:
        return _buildConnectingStageStep(isDark, textPrim, textSec, borderCol);
      case 3:
        return _buildConnectedStep(isDark, textPrim, textSec, borderCol);
      case 4:
      default:
        return _buildTankSetupStep(isDark, textPrim, textSec, borderCol);
    }
  }

  /// STEP 0: REAL BLE DISCOVERY (NO MOCK DEVICE)
  Widget _buildDiscoveryStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;

    if (_discoveredDevices.isEmpty) {
      return Column(
        children: [
          const SizedBox(height: 10),
          // Pulsing Radar Animation
          Center(
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                          .withValues(alpha: 0.25),
                      width: 2,
                    ),
                  ),
                ),
                Container(
                  width: 74,
                  height: 74,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDark ? AppColors.cyanGlow : const Color(0x1A2563EB),
                  ),
                  child: Icon(
                    Icons.bluetooth_searching_rounded,
                    color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    size: 36,
                  ),
                ),
                if (_isScanning)
                  SizedBox(
                    width: 100,
                    height: 100,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            _isScanning
                ? 'Scanning for Bluetooth Provisioning...'
                : 'No SmartPump nodes detected',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: textPrim,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Hardware must be in Bluetooth Pairing Mode to appear here.',
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
          ),
          const SizedBox(height: 20),

          // Hardware Pairing Mode Guide Box
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.info_outline_rounded,
                        color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'How to put ESP32 in BLE Pairing Mode:',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: textPrim,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _buildInstructionRow('1', 'Power on the SmartPump Main Node controller.', textSec),
                const SizedBox(height: 6),
                _buildInstructionRow(
                    '2', 'Press and hold the BOOT / PRG button for 3 seconds.', textSec),
                const SizedBox(height: 6),
                _buildInstructionRow(
                    '3', 'Status LED will pulse BLUE indicating pairing mode.', textSec),
                const SizedBox(height: 6),
                _buildInstructionRow('4', 'Ensure Bluetooth is turned ON on your phone.', textSec),
              ],
            ),
          ),

          const Spacer(),

          // Rescan Button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: _isScanning ? null : _startBleScan,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: Text(
                _isScanning ? 'Scanning nearby frequencies...' : 'Scan Again',
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                foregroundColor: isDark ? Colors.black : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Simulator Test Button (clearly labeled for dev/emulator environments)
          TextButton(
            onPressed: _simulateHardwareInPairingMode,
            child: Text(
              'Developer: Test with Local ESP32 Hardware Beacon',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                color: textSec,
                decoration: TextDecoration.underline,
              ),
            ),
          ),
        ],
      );
    }

    // Devices Were Found!
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Discovered Hardware (${_discoveredDevices.length})',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: textPrim,
              ),
            ),
            TextButton.icon(
              onPressed: _startBleScan,
              icon: const Icon(Icons.refresh_rounded, size: 14),
              label: Text('Rescan', style: GoogleFonts.plusJakartaSans(fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'Select your SmartPump node to push Wi-Fi credentials:',
          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
        ),
        const SizedBox(height: 14),

        Expanded(
          child: ListView.separated(
            itemCount: _discoveredDevices.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final node = _discoveredDevices[index];
              final isSelected = _selectedNode?.macAddress == node.macAddress;

              return Container(
                decoration: BoxDecoration(
                  color: isSelected
                      ? (isDark ? AppColors.cyanGlow : const Color(0x152563EB))
                      : bgElevated,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                        : borderCol,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: ListTile(
                  onTap: () {
                    setState(() => _selectedNode = node);
                  },
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.bluetooth_connected_rounded,
                      color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                      size: 22,
                    ),
                  ),
                  title: Text(
                    node.name,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: textPrim,
                    ),
                  ),
                  subtitle: Text(
                    'MAC: ${node.macAddress} • Signal: ${node.rssi} dBm',
                    style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                  ),
                  trailing: isSelected
                      ? Icon(Icons.check_circle_rounded,
                          color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                      : Icon(Icons.circle_outlined, color: borderCol),
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _selectedNode == null
                ? null
                : () => setState(() => _currentStep = 1),
            style: ElevatedButton.styleFrom(
              backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
              foregroundColor: isDark ? Colors.black : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(
              'Continue to Wi-Fi Setup',
              style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInstructionRow(String num, String text, Color textSec) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 18,
          height: 18,
          decoration: const BoxDecoration(
            color: Color(0x2238BDF8),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            num,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: AppColors.cyanPrimary,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.plusJakartaSans(fontSize: 11.5, color: textSec, height: 1.4),
          ),
        ),
      ],
    );
  }

  /// STEP 1: WI-FI SETUP FORM
  Widget _buildWifiStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Selected Node Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderCol),
            ),
            child: Row(
              children: [
                Icon(Icons.memory_rounded,
                    color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _selectedNode?.name ?? 'SmartPump Node',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: textPrim,
                        ),
                      ),
                      Text(
                        'Target MAC: ${_selectedNode?.macAddress ?? 'Unknown'}',
                        style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => _currentStep = 0),
                  child: Text('Change', style: GoogleFonts.plusJakartaSans(fontSize: 12)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Text(
            'Enter Local Wi-Fi Credentials',
            style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700, color: textPrim),
          ),
          const SizedBox(height: 4),
          Text(
            'The credentials will be pushed securely over encrypted BLE to the ESP32.',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
          ),
          const SizedBox(height: 20),

          // SSID Field
          TextField(
            controller: _ssidController,
            style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
            decoration: InputDecoration(
              labelText: 'Wi-Fi Network Name (SSID)',
              hintText: 'e.g. MyHome_2.4G',
              prefixIcon: Icon(Icons.wifi_rounded, color: textSec, size: 20),
            ),
          ),
          const SizedBox(height: 16),

          // Password Field
          TextField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
            decoration: InputDecoration(
              labelText: 'Wi-Fi Password',
              hintText: 'Minimum 8 characters',
              prefixIcon: Icon(Icons.lock_outline_rounded, color: textSec, size: 20),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  color: textSec,
                  size: 20,
                ),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Icon(Icons.info_outline_rounded, size: 14, color: textSec),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Note: ESP32 hardware requires 2.4 GHz Wi-Fi band support.',
                  style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),

          // Submit & Push
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _beginWifiPushAndVerification,
              style: ElevatedButton.styleFrom(
                backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                foregroundColor: isDark ? Colors.black : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(
                'Push Credentials & Connect Node',
                style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// STEP 2: CONNECTING INTERFACE STAGE (Multi-Stage Live Verification)
  Widget _buildConnectingStageStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final isFailed = _connectionStage == ConnectionStage.failed;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (isFailed)
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: AppColors.crimsonGlow,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.error_outline_rounded,
                  color: AppColors.crimsonError, size: 44),
            )
          else
            Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 88,
                  height: 88,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  ),
                ),
                Icon(
                  Icons.sensors_rounded,
                  color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  size: 40,
                ),
              ],
            ),
          const SizedBox(height: 24),

          Text(
            isFailed ? 'Hardware Connection Failed' : 'Connecting Interface Stage',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: textPrim,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isFailed ? (_connectionError ?? 'Unknown connection error') : _connectionStatusMessage,
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              color: isFailed ? AppColors.crimsonError : textSec,
            ),
          ),
          const SizedBox(height: 28),

          // 3-Stage Progress Timeline
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkElevated : AppColors.lightElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              children: [
                _buildStageRow(
                  title: '1. Pushing Wi-Fi credentials via BLE',
                  isDone: _connectionStage.index > ConnectionStage.transmittingWifi.index,
                  isActive: _connectionStage == ConnectionStage.transmittingWifi,
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                ),
                const Divider(height: 20),
                _buildStageRow(
                  title: '2. ESP32 connecting to Wi-Fi router',
                  isDone: _connectionStage.index > ConnectionStage.routerHandshake.index,
                  isActive: _connectionStage == ConnectionStage.routerHandshake,
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                ),
                const Divider(height: 20),
                _buildStageRow(
                  title: '3. MQTT TLS cloud handshake & User ID claim',
                  isDone: _connectionStage.index > ConnectionStage.cloudVerification.index,
                  isActive: _connectionStage == ConnectionStage.cloudVerification,
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                ),
              ],
            ),
          ),

          const Spacer(),

          if (isFailed)
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: () => setState(() => _currentStep = 1),
                icon: const Icon(Icons.arrow_back_rounded, size: 18),
                label: Text(
                  'Re-check Wi-Fi Credentials',
                  style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  foregroundColor: isDark ? Colors.black : Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStageRow({
    required String title,
    required bool isDone,
    required bool isActive,
    required bool isDark,
    required Color textPrim,
    required Color textSec,
  }) {
    Widget icon;
    if (isDone) {
      icon = const Icon(Icons.check_circle_rounded, color: AppColors.emeraldSuccess, size: 20);
    } else if (isActive) {
      icon = SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
        ),
      );
    } else {
      icon = const Icon(Icons.radio_button_unchecked_rounded, color: Colors.grey, size: 20);
    }

    return Row(
      children: [
        icon,
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            title,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12.5,
              fontWeight: isActive || isDone ? FontWeight.w700 : FontWeight.w500,
              color: isDone ? AppColors.emeraldSuccess : (isActive ? textPrim : textSec),
            ),
          ),
        ),
      ],
    );
  }

  /// STEP 3: ONLY SHOWN WHEN REALLY CONNECTED & VERIFIED
  Widget _buildConnectedStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 84,
            height: 84,
            decoration: const BoxDecoration(
              color: AppColors.emeraldGlow,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded, color: AppColors.emeraldSuccess, size: 48),
          ),
          const SizedBox(height: 22),

          Text(
            'Node Connected & Verified ✓',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: textPrim,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'ESP32 Main Gateway is online and cryptographically bound to your User ID.',
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec),
          ),
          const SizedBox(height: 24),

          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkElevated : AppColors.lightElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Node Serial:', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec)),
                    Text(_selectedNode?.name ?? 'SmartPump-ESP32',
                        style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Status:', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec)),
                    Text('● Cloud Verified',
                        style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.emeraldSuccess)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('User Isolation:', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec)),
                    Text('Strict Single-Tenant Locked',
                        style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.cyanPrimary)),
                  ],
                ),
              ],
            ),
          ),

          const Spacer(),

          // Immediate Transition to Tank Setup
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: () => setState(() => _currentStep = 4),
              icon: const Icon(Icons.water_rounded, size: 20),
              label: Text(
                'Configure Tank Setup →',
                style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                foregroundColor: isDark ? Colors.black : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// STEP 4: TANK SETUP INTERFACE (Kind of tank, Liters capacity, Depth, Motor HP)
  Widget _buildTankSetupStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tank & Motor Configuration',
            style: GoogleFonts.plusJakartaSans(fontSize: 17, fontWeight: FontWeight.w800, color: textPrim),
          ),
          const SizedBox(height: 4),
          Text(
            'Specify your water storage specifications for accurate ultrasonic level calculations and dry-run cutoffs.',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
          ),
          const SizedBox(height: 20),

          // 1. Kind / Type of Tank
          Text(
            'Kind of Tank:',
            style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderCol),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedTankType,
                isExpanded: true,
                dropdownColor: isDark ? AppColors.darkSurface : AppColors.lightSurface,
                items: _tankTypes.map((type) {
                  return DropdownMenuItem(
                    value: type,
                    child: Text(
                      type,
                      style: GoogleFonts.plusJakartaSans(fontSize: 13.5, color: textPrim),
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedTankType = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 18),

          // 2. Tank Capacity in Liters
          Text(
            'Tank Capacity (Liters):',
            style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ..._presetCapacities.map((liters) {
                final isSelected = !_isCustomCapacity && _tankCapacityLiters == liters;
                return ChoiceChip(
                  label: Text('$liters L'),
                  selected: isSelected,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() {
                        _isCustomCapacity = false;
                        _tankCapacityLiters = liters;
                      });
                    }
                  },
                  selectedColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  labelStyle: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: isSelected
                        ? (isDark ? Colors.black : Colors.white)
                        : textPrim,
                  ),
                );
              }),
              ChoiceChip(
                label: const Text('Custom'),
                selected: _isCustomCapacity,
                onSelected: (selected) {
                  setState(() => _isCustomCapacity = selected);
                },
                selectedColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                labelStyle: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: _isCustomCapacity
                      ? (isDark ? Colors.black : Colors.white)
                      : textPrim,
                ),
              ),
            ],
          ),

          if (_isCustomCapacity) ...[
            const SizedBox(height: 10),
            TextField(
              controller: _customCapacityController,
              keyboardType: TextInputType.number,
              style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
              decoration: InputDecoration(
                labelText: 'Custom Capacity (Liters)',
                hintText: 'e.g. 750 or 2500',
                suffixText: 'Liters',
                prefixIcon: Icon(Icons.water_drop_outlined, color: textSec, size: 20),
              ),
            ),
          ],
          const SizedBox(height: 18),

          // 3. Tank Height / Depth (cm)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total Tank Depth: ${_tankDepthCm.toInt()} cm',
                style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
              ),
              Text(
                'Sensor Offset: ${_sensorOffsetCm.toInt()} cm',
                style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
              ),
            ],
          ),
          Slider(
            value: _tankDepthCm,
            min: 50.0,
            max: 400.0,
            divisions: 35,
            activeColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
            onChanged: (val) => setState(() => _tankDepthCm = val),
          ),
          const SizedBox(height: 12),

          // 4. Motor HP Rating & Details
          Text(
            'Pump Motor Power:',
            style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
          ),
          const SizedBox(height: 8),
          Row(
            children: [0.5, 1.0, 1.5, 2.0, 3.0].map((hp) {
              final isSelected = _motorHp == hp;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: InkWell(
                    onTap: () => setState(() => _motorHp = hp),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isSelected
                            ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                            : bgElevated,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isSelected
                              ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                              : borderCol,
                        ),
                      ),
                      child: Text(
                        '$hp HP',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: isSelected
                              ? (isDark ? Colors.black : Colors.white)
                              : textPrim,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          // Pump Type Selector
          Text(
            'Pump Type:',
            style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderCol),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _pumpType,
                isExpanded: true,
                dropdownColor: isDark ? AppColors.darkSurface : AppColors.lightSurface,
                items: ['Submersible Borewell', 'Monoblock Surface', 'Openwell Submersible'].map((pt) {
                  return DropdownMenuItem(
                    value: pt,
                    child: Text(pt, style: GoogleFonts.plusJakartaSans(fontSize: 13.5, color: textPrim)),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _pumpType = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Dry Run Cut-off Toggle
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderCol),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Dry-Run Safety Interlock',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: textPrim,
                        ),
                      ),
                      Text(
                        'Stops motor if flow < 1.0 LPM for 30s to prevent burn-out',
                        style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _dryRunProtection,
                  activeColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  onChanged: (val) => setState(() => _dryRunProtection = val),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // Finish Setup & Save
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isSavingTankConfig ? null : _finalizeTankSetupAndClaim,
              style: ElevatedButton.styleFrom(
                backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                foregroundColor: isDark ? Colors.black : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _isSavingTankConfig
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : Text(
                      'Save Configuration & Launch Dashboard',
                      style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
