import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
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

class _BleProvisioningDialogState extends ConsumerState<BleProvisioningDialog>
    with SingleTickerProviderStateMixin {
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
  StreamSubscription? _adapterSubscription;
  BluetoothAdapterState _adapterState = BluetoothAdapterState.unknown;

  late AnimationController _radarController;

  // Wi-Fi Setup Form
  final _ssidController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  // Connecting Stage Status
  ConnectionStage _connectionStage = ConnectionStage.idle;
  String _connectionStatusMessage = 'Initializing secure Bluetooth link...';
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
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();

    _listenAdapterState();
    _startBleScan();
  }

  @override
  void dispose() {
    _radarController.dispose();
    _scanSubscription?.cancel();
    _adapterSubscription?.cancel();
    BleProvisioningService.stopScan();
    _ssidController.dispose();
    _passwordController.dispose();
    _customCapacityController.dispose();
    super.dispose();
  }

  void _listenAdapterState() {
    try {
      _adapterSubscription = FlutterBluePlus.adapterState.listen((state) {
        if (mounted) {
          setState(() => _adapterState = state);
        }
      });
    } catch (_) {}
  }

  void _startBleScan() async {
    setState(() {
      _isScanning = true;
      _discoveredDevices = [];
      _selectedNode = null;
    });

    _scanSubscription?.cancel();
    _scanSubscription = BleProvisioningService.scanForNodes().listen(
      (nodes) {
        if (mounted) {
          setState(() {
            // Strictly only show devices named Smart Pump Controller
            _discoveredDevices = nodes
                .where((n) => n.isSmartPumpCandidate && n.name == 'Smart Pump Controller')
                .toList();
            // Auto-select first matching Smart Controller if not selected
            if (_selectedNode == null && _discoveredDevices.isNotEmpty) {
              _selectedNode = _discoveredDevices.first;
            }
          });
        }
      },
      onError: (err) {
        if (mounted) {
          setState(() => _isScanning = false);
        }
      },
    );

    // Stop scanning animation after 10 seconds
    Future.delayed(const Duration(seconds: 10), () {
      if (mounted) {
        setState(() => _isScanning = false);
      }
    });
  }

  void _beginWifiPushAndVerification() async {
    final ssid = _ssidController.text.trim();
    final password = _passwordController.text;

    if (ssid.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter your 2.4 GHz Wi-Fi network name.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (password.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Wi-Fi password must be at least 8 characters.'),
          behavior: SnackBarBehavior.floating,
        ),
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
      _connectionStatusMessage = 'Pushing Wi-Fi credentials to Smart Controller...';
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

      // Successfully connected!
      if (mounted) {
        setState(() {
          _currentStep = 3; // Connected Stage
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _connectionStage = ConnectionStage.failed;
          _connectionError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  void _finalizeTankSetupAndClaim() async {
    setState(() => _isSavingTankConfig = true);

    try {
      final capacity = _isCustomCapacity
          ? (int.tryParse(_customCapacityController.text.trim()) ?? 1000)
          : _tankCapacityLiters;

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
          SnackBar(
            content: Text('Error saving configuration: $e'),
            behavior: SnackBarBehavior.floating,
          ),
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
      'Discover Controller',
      'Wi-Fi Setup',
      'Pairing Station',
      'Controller Online',
      'System Calibration',
    ];

    return Container(
      height: MediaQuery.of(context).size.height * 0.90,
      decoration: BoxDecoration(
        color: bgSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.6 : 0.15),
            blurRadius: 30,
            offset: const Offset(0, -10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 14, bottom: 8),
              width: 44,
              height: 4.5,
              decoration: BoxDecoration(
                color: borderCol,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      stepTitles[_currentStep],
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: textPrim,
                        letterSpacing: -0.4,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Step ${_currentStep + 1} of 5 • Setup Wizard',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkElevated : AppColors.lightElevated,
                      shape: BoxShape.circle,
                      border: Border.all(color: borderCol),
                    ),
                    child: Icon(Icons.close_rounded, color: textSec, size: 18),
                  ),
                ),
              ],
            ),
          ),

          // 5-Step Visual Stepper Progress Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: List.generate(5, (index) {
                final isPassed = index <= _currentStep;
                final isCurrent = index == _currentStep;
                return Expanded(
                  child: Container(
                    height: isCurrent ? 5 : 4,
                    margin: EdgeInsets.only(right: index < 4 ? 6 : 0),
                    decoration: BoxDecoration(
                      gradient: isPassed
                          ? LinearGradient(
                              colors: isDark
                                  ? [AppColors.cyanPrimary, AppColors.blueElectric]
                                  : [AppColors.blueElectric, const Color(0xFF1D4ED8)],
                            )
                          : null,
                      color: isPassed ? null : borderCol,
                      borderRadius: BorderRadius.circular(3),
                      boxShadow: isCurrent
                          ? [
                              BoxShadow(
                                color: (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                                    .withValues(alpha: 0.45),
                                blurRadius: 6,
                                offset: const Offset(0, 1),
                              ),
                            ]
                          : null,
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 18),

          // Bluetooth Adapter State Alert (if turned off)
          if (_adapterState == BluetoothAdapterState.off)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0x22F59E0B),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.bluetooth_disabled_rounded, color: Color(0xFFF59E0B), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Bluetooth is currently disabled on your phone.',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: textPrim,
                        ),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: BleProvisioningService.turnOnBluetooth,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: Text(
                        'Enable',
                        style: GoogleFonts.plusJakartaSans(fontSize: 11.5, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Dynamic Body for each Step
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: _buildStepContent(isDark, textPrim, textSec, borderCol),
            ),
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

  /// STEP 0: PRODUCTION BLUETOOTH SCANNER
  Widget _buildDiscoveryStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final primaryAccent = isDark ? AppColors.cyanPrimary : AppColors.blueElectric;

    if (_discoveredDevices.isEmpty) {
      return Column(
        children: [
          const SizedBox(height: 14),

          // High-Tech Radar Sonar Visualizer
          Center(
            child: SizedBox(
              width: 140,
              height: 140,
              child: AnimatedBuilder(
                animation: _radarController,
                builder: (context, child) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      // Outer ripple ring
                      if (_isScanning)
                        Container(
                          width: 70 + (_radarController.value * 70),
                          height: 70 + (_radarController.value * 70),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: primaryAccent.withValues(
                                alpha: (1.0 - _radarController.value).clamp(0.0, 0.4),
                              ),
                              width: 2,
                            ),
                          ),
                        ),
                      // Mid ring
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: primaryAccent.withValues(alpha: 0.25),
                            width: 1.5,
                          ),
                        ),
                      ),
                      // Inner core
                      Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: isDark
                                ? [AppColors.cyanGlow, const Color(0x3306B6D4)]
                                : [const Color(0x222563EB), const Color(0x112563EB)],
                          ),
                        ),
                        child: Icon(
                          _isScanning
                              ? Icons.bluetooth_searching_rounded
                              : Icons.bluetooth_disabled_rounded,
                          color: primaryAccent,
                          size: 32,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 18),

          Text(
            _isScanning
                ? 'Scanning for Smart Controllers...'
                : 'No Smart Controllers Found Nearby',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16.5,
              fontWeight: FontWeight.w800,
              color: textPrim,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _isScanning
                ? 'Listening on 2.4GHz Bluetooth LE pairing channels...'
                : 'Make sure your controller is powered on and in pairing mode.',
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(fontSize: 12.5, color: textSec),
          ),
          const SizedBox(height: 20),

          // Hardware Pairing Mode Guide
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.tune_rounded, color: primaryAccent, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'Activating Controller Pairing Mode',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: textPrim,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _buildInstructionRow('1', 'Power on the Smart Pump Controller station.', textSec),
                const SizedBox(height: 8),
                _buildInstructionRow(
                    '2', 'Press and hold the Pairing button for 3 seconds.', textSec),
                const SizedBox(height: 8),
                _buildInstructionRow(
                    '3', 'Status LED blinks once while awaiting connection.', textSec),
                const SizedBox(height: 8),
                _buildInstructionRow(
                    '4', 'Keep phone within 5 meters of the controller.', textSec),
              ],
            ),
          ),

          const Spacer(),

          // Rescan Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _isScanning ? null : _startBleScan,
              icon: _isScanning
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: isDark ? Colors.black : Colors.white,
                      ),
                    )
                  : const Icon(Icons.refresh_rounded, size: 18),
              label: Text(
                _isScanning ? 'Searching Nearby Frequencies...' : 'Scan for Controllers Again',
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryAccent,
                foregroundColor: isDark ? Colors.black : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
      );
    }

    // Devices Found (strictly Smart Pump Controller devices)
    final smartNodes = _discoveredDevices
        .where((d) => d.isSmartPumpCandidate && d.name == 'Smart Pump Controller')
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text(
                  'Smart Pump Controller (${smartNodes.length})',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: textPrim,
                  ),
                ),
                if (_isScanning) ...[
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: primaryAccent),
                  ),
                ],
              ],
            ),
            TextButton.icon(
              onPressed: _isScanning ? null : _startBleScan,
              icon: Icon(Icons.refresh_rounded, size: 14, color: primaryAccent),
              label: Text(
                _isScanning ? 'Scanning...' : 'Rescan',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: primaryAccent,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          'Select your Smart Pump Controller to configure Wi-Fi credentials:',
          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
        ),
        const SizedBox(height: 12),

        Expanded(
          child: ListView(
            physics: const BouncingScrollPhysics(),
            children: [
              ...smartNodes.map((node) => _buildDeviceCard(node, isDark, textPrim, textSec, borderCol, bgElevated, primaryAccent)),
            ],
          ),
        ),

        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _selectedNode == null
                ? null
                : () => setState(() => _currentStep = 1),
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryAccent,
              foregroundColor: isDark ? Colors.black : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              disabledBackgroundColor: borderCol,
            ),
            child: Text(
              _selectedNode != null ? 'Continue to Wi-Fi Setup →' : 'Select Smart Pump Controller',
              style: GoogleFonts.plusJakartaSans(fontSize: 14.5, fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: 10),
      ],
    );
  }

  Widget _buildDeviceCard(
    BleDiscoveredNode node,
    bool isDark,
    Color textPrim,
    Color textSec,
    Color borderCol,
    Color bgElevated,
    Color primaryAccent,
  ) {
    final isSelected = _selectedNode?.macAddress == node.macAddress;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: () => setState(() => _selectedNode = node),
        borderRadius: BorderRadius.circular(18),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: isSelected
                ? (isDark ? AppColors.cyanGlow : const Color(0x182563EB))
                : bgElevated,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isSelected ? primaryAccent : borderCol,
              width: isSelected ? 2 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: primaryAccent.withValues(alpha: 0.2),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              // Controller Icon with Signal Badge
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isSelected
                      ? primaryAccent.withValues(alpha: 0.15)
                      : (isDark ? AppColors.darkSurface : AppColors.lightSurface),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  node.isSmartPumpCandidate
                      ? Icons.sensors_rounded
                      : Icons.bluetooth_rounded,
                  color: isSelected ? primaryAccent : textSec,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),

              // Device Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            node.name,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: textPrim,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (node.isSmartPumpCandidate) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.emeraldSuccess.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'READY',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: AppColors.emeraldSuccess,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Text(
                          'MAC: ${node.macAddress}',
                          style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                        ),
                        const SizedBox(width: 8),
                        Text('•', style: TextStyle(color: textSec, fontSize: 10)),
                        const SizedBox(width: 8),
                        _buildSignalBars(node.rssi, primaryAccent, textSec),
                        const SizedBox(width: 4),
                        Text(
                          '${node.rssi} dBm',
                          style: GoogleFonts.plusJakartaSans(fontSize: 10.5, color: textSec),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Radio Checkmark
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isSelected ? primaryAccent : Colors.transparent,
                  border: Border.all(
                    color: isSelected ? primaryAccent : borderCol,
                    width: 2,
                  ),
                ),
                child: isSelected
                    ? Icon(
                        Icons.check,
                        size: 14,
                        color: isDark ? Colors.black : Colors.white,
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSignalBars(int rssi, Color primaryAccent, Color textSec) {
    int activeBars = 1;
    if (rssi >= -65) {
      activeBars = 4;
    } else if (rssi >= -75) {
      activeBars = 3;
    } else if (rssi >= -85) {
      activeBars = 2;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(4, (i) {
        final height = 4.0 + (i * 2.5);
        final isActive = i < activeBars;
        return Container(
          width: 2.5,
          height: height,
          margin: const EdgeInsets.only(right: 1.5),
          decoration: BoxDecoration(
            color: isActive ? AppColors.emeraldSuccess : textSec.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(1),
          ),
        );
      }),
    );
  }

  Widget _buildInstructionRow(String num, String text, Color textSec) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: AppColors.cyanPrimary.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            num,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              color: AppColors.cyanPrimary,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec, height: 1.4),
          ),
        ),
      ],
    );
  }

  /// STEP 1: WI-FI SETUP FORM
  Widget _buildWifiStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final primaryAccent = isDark ? AppColors.cyanPrimary : AppColors.blueElectric;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Selected Node Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: borderCol),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: primaryAccent.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.memory_rounded, color: primaryAccent, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _selectedNode?.name ?? 'Smart Controller Hub',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13.5,
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
                  child: Text(
                    'Change',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: primaryAccent,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Text(
            'Enter Local Wi-Fi Credentials',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: textPrim,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'The credentials will be transmitted securely over encrypted Bluetooth to the Smart Controller.',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
          ),
          const SizedBox(height: 18),

          // SSID Field
          TextField(
            controller: _ssidController,
            style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
            decoration: InputDecoration(
              labelText: 'Wi-Fi Network Name (SSID)',
              hintText: 'e.g. MyHome_2.4G',
              prefixIcon: Icon(Icons.wifi_rounded, color: textSec, size: 20),
              filled: true,
              fillColor: bgElevated,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: borderCol),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: borderCol),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: primaryAccent, width: 2),
              ),
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
              filled: true,
              fillColor: bgElevated,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: borderCol),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: borderCol),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: primaryAccent, width: 2),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 2.4 GHz Callout
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: primaryAccent.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: primaryAccent.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.wifi_tethering_rounded, size: 18, color: primaryAccent),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Smart Controller requires a 2.4 GHz Wi-Fi band. (5 GHz only networks are not supported by IoT controllers).',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11.5,
                      color: textPrim,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // Submit & Push
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _beginWifiPushAndVerification,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryAccent,
                foregroundColor: isDark ? Colors.black : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: Text(
                'Transmit Wi-Fi to Controller →',
                style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: 14),
        ],
      ),
    );
  }

  /// STEP 2: CONNECTING STAGE (Multi-Stage Live Verification)
  Widget _buildConnectingStageStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final isFailed = _connectionStage == ConnectionStage.failed;
    final primaryAccent = isDark ? AppColors.cyanPrimary : AppColors.blueElectric;
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (isFailed)
            Container(
              width: 88,
              height: 88,
              decoration: const BoxDecoration(
                color: AppColors.crimsonGlow,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.error_outline_rounded,
                  color: AppColors.crimsonError, size: 46),
            )
          else
            Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 92,
                  height: 92,
                  child: CircularProgressIndicator(
                    strokeWidth: 3.5,
                    color: primaryAccent,
                  ),
                ),
                Icon(
                  Icons.sensors_rounded,
                  color: primaryAccent,
                  size: 42,
                ),
              ],
            ),
          const SizedBox(height: 24),

          Text(
            isFailed ? 'Connection Encountered An Error' : 'Configuring Controller Link',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 18.5,
              fontWeight: FontWeight.w800,
              color: textPrim,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              isFailed ? (_connectionError ?? 'Unknown connection error') : _connectionStatusMessage,
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: isFailed ? AppColors.crimsonError : textSec,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 26),

          // 3-Stage Progress Timeline
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              children: [
                _buildStageRow(
                  title: '1. Transmitting credentials over Bluetooth',
                  isDone: _connectionStage.index > ConnectionStage.transmittingWifi.index,
                  isActive: _connectionStage == ConnectionStage.transmittingWifi,
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  primaryAccent: primaryAccent,
                ),
                const Divider(height: 22),
                _buildStageRow(
                  title: '2. Controller connecting to 2.4 GHz Wi-Fi',
                  isDone: _connectionStage.index > ConnectionStage.routerHandshake.index,
                  isActive: _connectionStage == ConnectionStage.routerHandshake,
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  primaryAccent: primaryAccent,
                ),
                const Divider(height: 22),
                _buildStageRow(
                  title: '3. Cloud MQTT handshake & User binding',
                  isDone: _connectionStage.index > ConnectionStage.cloudVerification.index,
                  isActive: _connectionStage == ConnectionStage.cloudVerification,
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  primaryAccent: primaryAccent,
                ),
              ],
            ),
          ),

          const Spacer(),

          if (isFailed)
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: () => setState(() => _currentStep = 1),
                icon: const Icon(Icons.arrow_back_rounded, size: 18),
                label: Text(
                  'Re-check Wi-Fi Credentials',
                  style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryAccent,
                  foregroundColor: isDark ? Colors.black : Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
          const SizedBox(height: 12),
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
    required Color primaryAccent,
  }) {
    Widget icon;
    if (isDone) {
      icon = const Icon(Icons.check_circle_rounded, color: AppColors.emeraldSuccess, size: 22);
    } else if (isActive) {
      icon = SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: primaryAccent,
        ),
      );
    } else {
      icon = Icon(Icons.radio_button_unchecked_rounded, color: textSec.withValues(alpha: 0.4), size: 22);
    }

    return Row(
      children: [
        icon,
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            title,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              fontWeight: isActive || isDone ? FontWeight.w700 : FontWeight.w500,
              color: isDone ? AppColors.emeraldSuccess : (isActive ? textPrim : textSec),
            ),
          ),
        ),
      ],
    );
  }

  /// STEP 3: CONTROLLER VERIFIED & ONLINE
  Widget _buildConnectedStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final primaryAccent = isDark ? AppColors.cyanPrimary : AppColors.blueElectric;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: const BoxDecoration(
              color: AppColors.emeraldGlow,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_rounded, color: AppColors.emeraldSuccess, size: 52),
          ),
          const SizedBox(height: 20),

          Text(
            'Smart Controller Online ✓',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: textPrim,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Smart Pump Gateway is active and securely bound to your User ID.',
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec),
          ),
          const SizedBox(height: 24),

          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Controller Hub:', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec)),
                    Text(
                      _selectedNode?.name ?? 'SmartPump Controller',
                      style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Status:', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec)),
                    Row(
                      children: [
                        const Icon(Icons.circle, color: AppColors.emeraldSuccess, size: 8),
                        const SizedBox(width: 6),
                        Text(
                          'Cloud Verified & Linked',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.emeraldSuccess,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Ownership:', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec)),
                    Text(
                      'Dedicated Single-Tenant',
                      style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: primaryAccent),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const Spacer(),

          // Transition to Tank Setup
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: () => setState(() => _currentStep = 4),
              icon: const Icon(Icons.water_rounded, size: 20),
              label: Text(
                'Configure Tank & Pump Setup →',
                style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryAccent,
                foregroundColor: isDark ? Colors.black : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  /// STEP 4: TANK SETUP INTERFACE
  Widget _buildTankSetupStep(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final primaryAccent = isDark ? AppColors.cyanPrimary : AppColors.blueElectric;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tank & Pump Calibration',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 17.5,
              fontWeight: FontWeight.w800,
              color: textPrim,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Specify your storage tank dimensions for precision acoustic level calculations and safety interlocks.',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec, height: 1.35),
          ),
          const SizedBox(height: 18),

          // 1. Kind / Type of Tank
          Text(
            'Storage Tank Type:',
            style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(16),
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
                  selectedColor: primaryAccent,
                  backgroundColor: bgElevated,
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
                selectedColor: primaryAccent,
                backgroundColor: bgElevated,
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
                filled: true,
                fillColor: bgElevated,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: borderCol),
                ),
              ),
            ),
          ],
          const SizedBox(height: 18),

          // 3. Tank Height / Depth
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
            activeColor: primaryAccent,
            onChanged: (val) => setState(() => _tankDepthCm = val),
          ),
          const SizedBox(height: 14),

          // 4. Motor HP Rating
          Text(
            'Pump Motor Rating:',
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
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isSelected ? primaryAccent : bgElevated,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? primaryAccent : borderCol,
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
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(16),
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
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(16),
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
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: textPrim,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Auto-cuts motor power if flow < 1.0 LPM for 30s to prevent pump burn-out.',
                        style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec, height: 1.3),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _dryRunProtection,
                  activeThumbColor: primaryAccent,
                  onChanged: (val) => setState(() => _dryRunProtection = val),
                ),
              ],
            ),
          ),
          const SizedBox(height: 26),

          // Save & Launch
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isSavingTankConfig ? null : _finalizeTankSetupAndClaim,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryAccent,
                foregroundColor: isDark ? Colors.black : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
