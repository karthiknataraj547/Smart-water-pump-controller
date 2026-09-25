import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';

class BleProvisioningDialog extends ConsumerStatefulWidget {
  final VoidCallback onCompleted;

  const BleProvisioningDialog({super.key, required this.onCompleted});

  @override
  ConsumerState<BleProvisioningDialog> createState() => _BleProvisioningDialogState();
}

class _BleProvisioningDialogState extends ConsumerState<BleProvisioningDialog> {
  int _currentStep = 0; // 0: Scanning, 1: Select Device, 2: Wi-Fi Setup, 3: Completed
  final String _selectedDevice = 'SmartPump-3918-B';
  final _ssidController = TextEditingController(text: 'Home_WiFi_5G');
  final _passwordController = TextEditingController(text: 'SecureWiFiPass123');
  bool _obscurePassword = true;
  bool _isConnecting = false;

  @override
  void initState() {
    super.initState();
    // Simulate BLE discovery
    Future.delayed(const Duration(milliseconds: 1400), () {
      if (mounted && _currentStep == 0) {
        setState(() => _currentStep = 1);
      }
    });
  }

  @override
  void dispose() {
    _ssidController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _provisionDevice() async {
    setState(() => _isConnecting = true);

    // Simulate BLE handshake & Wi-Fi transmission to ESP32
    await Future.delayed(const Duration(milliseconds: 1800));

    if (mounted) {
      setState(() {
        _isConnecting = false;
        _currentStep = 3;
      });
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

    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
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
          const SizedBox(height: 18),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BLE Device Setup',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: textPrim,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Text(
                    'Step ${_currentStep + 1} of 4',
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
          const SizedBox(height: 16),

          // Step Progress Bar
          Row(
            children: List.generate(4, (index) {
              final isPassed = index <= _currentStep;
              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(right: index < 3 ? 6 : 0),
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
          const SizedBox(height: 24),

          // Dynamic Step Body
          Expanded(child: _buildCurrentStepContent(isDark, textPrim, textSec, borderCol)),
        ],
      ),
    );
  }

  Widget _buildCurrentStepContent(bool isDark, Color textPrim, Color textSec, Color borderCol) {
    switch (_currentStep) {
      case 0:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkElevated : AppColors.lightElevated,
                  shape: BoxShape.circle,
                  border: Border.all(color: borderCol),
                ),
                child: Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  ),
                ),
              ),
              const SizedBox(height: 28),
              Text(
                'Scanning for nearby devices...',
                style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: textPrim),
              ),
              const SizedBox(height: 8),
              Text(
                'Searching for SmartPump Main Nodes in Bluetooth pairing mode',
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec),
              ),
            ],
          ),
        );

      case 1:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Select Discovered Device',
              style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700, color: textPrim),
            ),
            const SizedBox(height: 6),
            Text(
              'Tap the node you wish to provision to your account',
              style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
            ),
            const SizedBox(height: 20),
            Container(
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkElevated : AppColors.lightElevated,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric, width: 1.5),
              ),
              child: Material(
                color: Colors.transparent,
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.cyanGlow : const Color(0x1A2563EB),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.bluetooth_audio_rounded, color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric),
                  ),
                  title: Text(
                    _selectedDevice,
                    style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700, color: textPrim),
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    'Signal: -54 dBm • MAC: 24:6F:28:B2:44:90',
                    style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: Icon(
                    Icons.check_circle_rounded,
                    color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    size: 24,
                  ),
                ),
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: () => setState(() => _currentStep = 2),
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

      case 2:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Configure Wi-Fi Network',
              style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700, color: textPrim),
            ),
            const SizedBox(height: 6),
            Text(
              'Transmitted securely over encrypted BLE link to ESP32',
              style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _ssidController,
              style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
              decoration: InputDecoration(
                labelText: 'Wi-Fi Network Name (SSID)',
                prefixIcon: Icon(Icons.wifi_rounded, color: textSec, size: 20),
              ),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
              decoration: InputDecoration(
                labelText: 'Wi-Fi Password',
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
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _isConnecting ? null : _provisionDevice,
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  foregroundColor: isDark ? Colors.black : Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _isConnecting
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5)),
                          const SizedBox(width: 12),
                          Text('Transmitting Credentials...', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700)),
                        ],
                      )
                    : Text('Connect Device', style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        );

      case 3:
      default:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(
                  color: AppColors.emeraldGlow,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded, color: AppColors.emeraldSuccess, size: 44),
              ),
              const SizedBox(height: 22),
              Text(
                'Device Connected ✓',
                style: GoogleFonts.plusJakartaSans(fontSize: 22, fontWeight: FontWeight.w800, color: textPrim),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
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
                        Expanded(child: Text('Main Node (ESP32):', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec))),
                        const SizedBox(width: 12),
                        Text('● Online', style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.emeraldSuccess)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text('Sub Node (Sensor):', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec))),
                        const SizedBox(width: 12),
                        Text('Waiting...', style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.amberWarning)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 36),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    widget.onCompleted();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    foregroundColor: isDark ? Colors.black : Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text('Finish & Open Dashboard', style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        );
    }
  }
}
