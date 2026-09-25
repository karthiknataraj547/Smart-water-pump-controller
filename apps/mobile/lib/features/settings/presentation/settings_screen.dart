import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../provisioning/presentation/ble_provisioning_dialog.dart';

class SettingsScreen extends ConsumerWidget {
  final Function(int)? onNavigateTab;

  const SettingsScreen({super.key, this.onNavigateTab});

  void _showNotificationsDialog(BuildContext context, bool isDark) {
    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Row(
          children: [
            const Icon(Icons.notifications_active_rounded, color: AppColors.cyanPrimary),
            const SizedBox(width: 10),
            Text(
              'System Alert Logs',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _NotificationItem(time: 'Just now', title: 'Auto Cutoff Safety Armed', detail: '45 minute continuous runtime guard active.', isDark: isDark),
            const Divider(height: 16),
            _NotificationItem(time: '18m ago', title: 'Pump Inflow Started', detail: 'Automated level cycle triggered at 30% capacity.', isDark: isDark),
            const Divider(height: 16),
            _NotificationItem(time: 'Today 06:00', title: 'ESP32 Sub-Node Connected', detail: 'Ultrasonic acoustic probe ping 18ms.', isDark: isDark),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.cyanPrimary),
            child: Text('Close', style: GoogleFonts.plusJakartaSans(color: Colors.black, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context, bool isDark) {
    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Row(
          children: [
            const Icon(Icons.water_drop_rounded, color: AppColors.cyanPrimary),
            const SizedBox(width: 10),
            Text('About SmartPump', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Smart Water Pump Controller', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13, color: textPrim)),
            const SizedBox(height: 4),
            Text('Mobile App Version: 2.5.0 (Enterprise IoT)', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            Text('Firmware Version: ESP-IDF v5.2 / FreeRTOS', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            Text('Active Architecture: Spatial UI + Rule-Driven Auto', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            const SizedBox(height: 10),
            Text('Hardware Nodes: ESP32-WROOM Gateway & Sub-Node', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.cyanPrimary),
            child: Text('OK', style: GoogleFonts.plusJakartaSans(color: Colors.black, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  void _showMqttDialog(BuildContext context, bool isDark) {
    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Row(
          children: [
            const Icon(Icons.cloud_sync_rounded, color: AppColors.cyanPrimary),
            const SizedBox(width: 10),
            Text('MQTT Broker Settings', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Broker Host: broker.emqx.io / mqtt.smartpump.io', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700, color: textPrim)),
            const SizedBox(height: 4),
            Text('Port: 8883 (TLS Mutual Authentication)', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            Text('Keep Alive: 60s ping heartbeat', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            Text('QoS Level: 1 (Guaranteed Delivery)', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.emeraldSuccess.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('● TLS Handshake Active', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.emeraldSuccess)),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.cyanPrimary),
            child: Text('Save & Close', style: GoogleFonts.plusJakartaSans(color: Colors.black, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;
    final authState = ref.watch(authProvider);

    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        title: Text(
          'Settings & System',
          style: GoogleFonts.plusJakartaSans(color: textPrim, fontWeight: FontWeight.w800, fontSize: 20),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 18),
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
        ],
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        children: [
          // 1. User Profile Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: bgSurface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: borderCol),
              boxShadow: [
                BoxShadow(
                  color: isDark ? Colors.black.withValues(alpha: 0.25) : Colors.black.withValues(alpha: 0.04),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  child: Text(
                    (authState.userName ?? 'K').substring(0, 1).toUpperCase(),
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w900,
                      color: isDark ? Colors.black : Colors.white,
                      fontSize: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        authState.userName ?? 'SmartPump Administrator',
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: textPrim,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        authState.userEmail ?? 'admin@smartpump.io',
                        style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.emeraldSuccess.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.emeraldSuccess.withValues(alpha: 0.4)),
                            ),
                            child: Text(
                              '● JWT Active',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: AppColors.emeraldSuccess,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'ESP32 Gateway Mesh',
                            style: GoogleFonts.plusJakartaSans(fontSize: 10, color: textSec, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Section 1: Hardware & Device Provisioning
          Text(
            'DEVICE & CONNECTIVITY',
            style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: textSec, letterSpacing: 0.8),
          ),
          const SizedBox(height: 10),

          Container(
            decoration: BoxDecoration(
              color: bgSurface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              children: [
                _SettingsTile(
                  icon: Icons.bluetooth_searching_rounded,
                  iconColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  title: 'BLE Device Setup Wizard',
                  subtitle: 'Pair & provision an ESP32 hardware gateway',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (bctx) => BleProvisioningDialog(
                        onCompleted: () {
                          ref.read(authProvider.notifier).claimHardware();
                        },
                      ),
                    );
                  },
                ),
                Divider(height: 1, color: borderCol),
                _SettingsTile(
                  icon: Icons.memory_rounded,
                  iconColor: const Color(0xFF10B981),
                  title: 'Device Topology & Diagnostics',
                  subtitle: 'Inspect Main Node & Sub-Node status',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  onTap: () {
                    if (onNavigateTab != null) {
                      onNavigateTab!(1); // Go to Device tab
                    }
                  },
                ),
                Divider(height: 1, color: borderCol),
                _SettingsTile(
                  icon: Icons.cloud_sync_rounded,
                  iconColor: const Color(0xFF3B82F6),
                  title: 'MQTT & Network Broker',
                  subtitle: 'broker.emqx.io:8883 (TLS Encrypted)',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  onTap: () => _showMqttDialog(context, isDark),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Section 2: Automation & Notifications
          Text(
            'SYSTEM & CONTROLS',
            style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: textSec, letterSpacing: 0.8),
          ),
          const SizedBox(height: 10),

          Container(
            decoration: BoxDecoration(
              color: bgSurface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              children: [
                _SettingsTile(
                  icon: Icons.psychology_rounded,
                  iconColor: const Color(0xFFF59E0B),
                  title: 'Automation Rules Engine',
                  subtitle: 'Manage tank triggers, overflow cutoffs & schedules',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  onTap: () {
                    if (onNavigateTab != null) {
                      onNavigateTab!(2); // Go to Pump tab (which contains rules)
                    }
                  },
                ),
                Divider(height: 1, color: borderCol),
                _SettingsTile(
                  icon: Icons.notifications_active_outlined,
                  iconColor: const Color(0xFF8B5CF6),
                  title: 'Alerts & Alarm Logs',
                  subtitle: 'View historical dry-run cutoffs & telemetry events',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  onTap: () => _showNotificationsDialog(context, isDark),
                ),
                Divider(height: 1, color: borderCol),
                _SettingsTile(
                  icon: isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                  iconColor: isDark ? AppColors.cyanPrimary : const Color(0xFFEAB308),
                  title: isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme',
                  subtitle: 'Current theme: ${isDark ? "Dark OLED High-Tech" : "Clean Light Hydraulic"}',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  trailing: Switch(
                    value: isDark,
                    activeColor: AppColors.cyanPrimary,
                    onChanged: (val) => ref.read(themeModeProvider.notifier).toggleTheme(),
                  ),
                  onTap: () => ref.read(themeModeProvider.notifier).toggleTheme(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Section 3: Hardware Management & Danger Zone
          Text(
            'DEVICE MANAGEMENT & DANGER ZONE',
            style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.crimsonError, letterSpacing: 0.8),
          ),
          const SizedBox(height: 10),

          Container(
            decoration: BoxDecoration(
              color: bgSurface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              children: [
                _SettingsTile(
                  icon: Icons.info_outline_rounded,
                  iconColor: textSec,
                  title: 'Firmware & Software Info',
                  subtitle: 'ESP-IDF v5.2 • FreeRTOS • SmartPump v2.5.0',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  onTap: () => _showAboutDialog(context, isDark),
                ),
                Divider(height: 1, color: borderCol),
                if (authState.hasClaimedHardware) ...[
                  _SettingsTile(
                    icon: Icons.link_off_rounded,
                    iconColor: AppColors.crimsonError,
                    title: 'Remove / Unpair Device',
                    subtitle: 'Unpair ESP32 gateway and return to empty view',
                    isDark: isDark,
                    textPrim: AppColors.crimsonError,
                    textSec: textSec,
                    onTap: () {
                      _showRemoveConfirmDialog(context, ref);
                    },
                  ),
                  Divider(height: 1, color: borderCol),
                ],
                _SettingsTile(
                  icon: Icons.logout_rounded,
                  iconColor: AppColors.crimsonError,
                  title: 'Sign Out',
                  subtitle: 'Clear authentication token and lock station',
                  isDark: isDark,
                  textPrim: AppColors.crimsonError,
                  textSec: textSec,
                  onTap: () {
                    ref.read(authProvider.notifier).logout();
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  void _showRemoveConfirmDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: AppColors.crimsonError, size: 28),
            const SizedBox(width: 10),
            Text(
              'Unpair Device?',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 17),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to unpair SmartPump Station? This will clear active node configurations.',
          style: GoogleFonts.plusJakartaSans(fontSize: 12.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(authProvider.notifier).removeHardware();
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.crimsonError),
            child: Text('Unpair', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final bool isDark;
  final Color textPrim;
  final Color textSec;
  final Widget? trailing;
  final VoidCallback onTap;

  const _SettingsTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.isDark,
    required this.textPrim,
    required this.textSec,
    this.trailing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        title: Text(
          title,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: textPrim,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            color: textSec,
          ),
        ),
        trailing: trailing ?? Icon(Icons.chevron_right_rounded, size: 18, color: textSec),
      ),
    );
  }
}

class _NotificationItem extends StatelessWidget {
  final String time;
  final String title;
  final String detail;
  final bool isDark;

  const _NotificationItem({
    required this.time,
    required this.title,
    required this.detail,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 4),
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
            color: AppColors.cyanPrimary,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700, color: textPrim)),
                  Text(time, style: GoogleFonts.plusJakartaSans(fontSize: 10, color: textSec)),
                ],
              ),
              const SizedBox(height: 2),
              Text(detail, style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            ],
          ),
        ),
      ],
    );
  }
}
