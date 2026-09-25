import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../shared/dialogs/app_controls_sheet.dart';

class HardwareScreen extends ConsumerStatefulWidget {
  const HardwareScreen({super.key});

  @override
  ConsumerState<HardwareScreen> createState() => _HardwareScreenState();
}

class _HardwareScreenState extends ConsumerState<HardwareScreen> {
  bool _isMainNodeExpanded = false;

  void _confirmRemoveDevice(BuildContext context) {
    final isDark = ref.read(themeModeProvider) == ThemeMode.dark;
    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: AppColors.crimsonGlow,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.link_off_rounded, color: AppColors.crimsonError, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Remove Device?',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 18, color: textPrim),
              ),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to unpair "SmartPump Station"? Both the Main Gateway Node and Sub Sensor Node will be removed from your account, and the app will return to the setup wizard.',
          style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Cancel',
              style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: textSec),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(authProvider.notifier).removeHardware();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  backgroundColor: AppColors.crimsonError,
                  behavior: SnackBarBehavior.floating,
                  content: Text(
                    'Device removed. Returned to onboarding.',
                    style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.crimsonError,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            child: Text(
              'Remove Device',
              style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        title: Text(
          'Device Topology',
          style: GoogleFonts.plusJakartaSans(color: textPrim, fontWeight: FontWeight.w800, fontSize: 20),
        ),
        actions: [
          // Theme Toggle Button beside Settings
          Container(
            margin: const EdgeInsets.only(right: 6),
            decoration: BoxDecoration(
              color: bgSurface,
              shape: BoxShape.circle,
              border: Border.all(color: borderCol),
            ),
            child: IconButton(
              tooltip: isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme',
              onPressed: () => ref.read(themeModeProvider.notifier).toggleTheme(),
              icon: Icon(
                isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                color: isDark ? AppColors.cyanPrimary : const Color(0xFFEAB308),
                size: 20,
              ),
            ),
          ),
          Container(
            margin: const EdgeInsets.only(right: 18),
            decoration: BoxDecoration(
              color: bgSurface,
              shape: BoxShape.circle,
              border: Border.all(color: borderCol),
            ),
            child: IconButton(
              tooltip: 'Settings & Controls',
              onPressed: () => showAppControlsBottomSheet(context, ref),
              icon: Icon(Icons.settings_outlined, color: textSec, size: 20),
            ),
          ),
        ],
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        children: [
          // === UNIFIED DUAL-NODE MESH CARD (MAIN NODE + SUB NODE IN ONE CARD) ===
          Container(
            decoration: BoxDecoration(
              color: bgSurface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: borderCol),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Header of the Unified Card
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          gradient: AppColors.cyanBlueGradient,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 6, offset: const Offset(0, 2)),
                          ],
                        ),
                        child: const Icon(Icons.hub_rounded, color: Colors.black, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'SmartPump Station',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: textPrim,
                                letterSpacing: -0.3,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              'Dual-Node Mesh Topology',
                              style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec, fontWeight: FontWeight.w500),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Network Link Quality Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.emeraldSuccess.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.emeraldSuccess.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: AppColors.emeraldSuccess,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              'SYNCED',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: AppColors.emeraldSuccess,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                Divider(color: borderCol, height: 1),

                // Dual Node Summaries Side-by-Side (Online/Offline Status Only at first)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      // --- MAIN NODE (GATEWAY) ---
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
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
                                  Icon(Icons.router_rounded, size: 16, color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'Main Node',
                                      style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'ESP32 Gateway',
                                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 10),
                              // Online / Offline Status Pill
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.emeraldSuccess.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppColors.emeraldSuccess.withValues(alpha: 0.4)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                        color: AppColors.emeraldSuccess,
                                        shape: BoxShape.circle,
                                        boxShadow: [BoxShadow(color: AppColors.emeraldGlow, blurRadius: 4, spreadRadius: 1)],
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'ONLINE',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.emeraldSuccess,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),

                      // --- SUB NODE (SENSOR POD) ---
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
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
                                  const Icon(Icons.sensors_rounded, size: 16, color: AppColors.tealAccent),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'Sub Node',
                                      style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: textPrim),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Sensor Pod',
                                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 10),
                              // Online / Offline Status Pill
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.emeraldSuccess.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppColors.emeraldSuccess.withValues(alpha: 0.4)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                        color: AppColors.emeraldSuccess,
                                        shape: BoxShape.circle,
                                        boxShadow: [BoxShadow(color: AppColors.emeraldGlow, blurRadius: 4, spreadRadius: 1)],
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'ONLINE',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.emeraldSuccess,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Collapsible Deep Telemetry & Diagnostics (After opening it)
                InkWell(
                  onTap: () => setState(() => _isMainNodeExpanded = !_isMainNodeExpanded),
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white.withValues(alpha: 0.02) : Colors.black.withValues(alpha: 0.02),
                      border: Border(top: BorderSide(color: borderCol)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              _isMainNodeExpanded ? Icons.visibility_off_outlined : Icons.tune_rounded,
                              size: 16,
                              color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _isMainNodeExpanded ? 'Hide Node Diagnostics' : 'Tap to View Deep Diagnostics',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                              ),
                            ),
                          ],
                        ),
                        Icon(
                          _isMainNodeExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                          color: textSec,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),

                // Expanded Section: Detailed diagnostics for both nodes
                if (_isMainNodeExpanded) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Main Node Details
                        Text(
                          'MAIN NODE TELEMETRY (GATEWAY)',
                          style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: textSec, letterSpacing: 0.8),
                        ),
                        const SizedBox(height: 10),
                        _DiagRow(label: 'Chip Model', value: 'ESP32-WROOM-32E (240MHz)', textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'Wi-Fi Network', value: 'Home_WiFi_5G (-54 dBm)', textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'MQTT Broker', value: 'Mosquitto 2.0 (TLS Active)', isAccent: true, textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'Pump Relay Pin', value: 'GPIO 26 (Contactor Energized)', textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'Firmware Revision', value: 'v1.2.4 (Latest OTA Build)', textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'Gateway Uptime', value: '4 days, 12 hrs, 40 mins', textSec: textSec, textPrim: textPrim),

                        const SizedBox(height: 16),
                        Divider(color: borderCol),
                        const SizedBox(height: 12),

                        // Sub Node Details
                        Text(
                          'SUB NODE TELEMETRY (SENSOR POD)',
                          style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: textSec, letterSpacing: 0.8),
                        ),
                        const SizedBox(height: 10),
                        _DiagRow(label: 'Chip Model', value: 'ESP32-C3 RISC-V Ultra-Low-Power', textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'Mesh Protocol', value: 'ESP-NOW Direct Peer (2ms Latency)', isAccent: true, textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'Battery Pack', value: '87% (3.92V Li-ion Cell)', isSuccess: true, textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'RSSI Signal', value: '-62 dBm (Excellent Coverage)', textSec: textSec, textPrim: textPrim),
                        _DiagRow(label: 'Packet Reliability', value: '99.98% (Zero Retransmissions)', textSec: textSec, textPrim: textPrim),

                        const SizedBox(height: 18),
                        Divider(color: borderCol),
                        const SizedBox(height: 14),

                        // REMOVE DEVICE BUTTON
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: OutlinedButton.icon(
                            onPressed: () => _confirmRemoveDevice(context),
                            icon: const Icon(Icons.delete_outline_rounded, color: AppColors.crimsonError, size: 20),
                            label: Text(
                              'Remove Device from Account',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.crimsonError,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: AppColors.crimsonError.withValues(alpha: 0.5)),
                              backgroundColor: AppColors.crimsonError.withValues(alpha: 0.06),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // === REMOVE DEVICE ACCORDION / BUTTON WHEN COLLAPSED ===
          if (!_isMainNodeExpanded) ...[
            Container(
              decoration: BoxDecoration(
                color: bgSurface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: borderCol),
              ),
              child: Material(
                color: Colors.transparent,
                child: ListTile(
                  onTap: () => _confirmRemoveDevice(context),
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.crimsonError.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.link_off_rounded, color: AppColors.crimsonError, size: 20),
                  ),
                  title: Text(
                    'Remove SmartPump Device',
                    style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.crimsonError),
                  ),
                  subtitle: Text(
                    'Unpair hardware and return to setup wizard',
                    style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.crimsonError),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // === SENSOR SUITE MATRIX CARD ===
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: bgSurface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: borderCol),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.03),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.sensors_rounded, size: 18, color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric),
                        const SizedBox(width: 8),
                        Text(
                          'Connected Sensors',
                          style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: textPrim),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.cyanPrimary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '3 Active',
                        style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.cyanPrimary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _SensorRow(
                  icon: Icons.water_drop_outlined,
                  name: 'Ultrasonic Water Level',
                  model: 'JSN-SR04T Waterproof',
                  status: 'Active • 120ms',
                  pin: 'D5 / D6',
                  isDark: isDark,
                ),
                Divider(color: borderCol, height: 18),
                _SensorRow(
                  icon: Icons.speed_rounded,
                  name: 'Hall Effect Flow Meter',
                  model: 'YF-S201 Turbine (1-30 LPM)',
                  status: 'Active • 12.4 L/min',
                  pin: 'D2 (Interrupt)',
                  isDark: isDark,
                ),
                Divider(color: borderCol, height: 18),
                _SensorRow(
                  icon: Icons.biotech_outlined,
                  name: 'Analog TDS Purity Probe',
                  model: 'Total Dissolved Solids Sensor',
                  status: 'Calibrated • 185 PPM',
                  pin: 'A0 ADC',
                  isDark: isDark,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _DiagRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isAccent;
  final bool isSuccess;
  final Color textSec;
  final Color textPrim;

  const _DiagRow({
    required this.label,
    required this.value,
    this.isAccent = false,
    this.isSuccess = false,
    required this.textSec,
    required this.textPrim,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec, fontWeight: FontWeight.w500)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: isAccent
                    ? AppColors.cyanPrimary
                    : (isSuccess ? AppColors.emeraldSuccess : textPrim),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SensorRow extends StatelessWidget {
  final IconData icon;
  final String name;
  final String model;
  final String status;
  final String pin;
  final bool isDark;

  const _SensorRow({
    required this.icon,
    required this.name,
    required this.model,
    required this.status,
    required this.pin,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkElevated : AppColors.lightElevated,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: AppColors.cyanPrimary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: textPrim),
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                '$model • $pin',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(
          status,
          style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.emeraldSuccess),
        ),
      ],
    );
  }
}
