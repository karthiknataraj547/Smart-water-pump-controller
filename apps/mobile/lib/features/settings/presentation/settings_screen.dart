import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/pump/pump_provider.dart';
import '../../provisioning/presentation/ble_provisioning_dialog.dart';

import '../../../core/mqtt/mqtt_realtime_client.dart';
import '../../../core/api/api_client.dart';

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
            _NotificationItem(time: 'Today 06:00', title: 'Secondary Sensor Node Connected', detail: 'Ultrasonic acoustic probe ping 18ms.', isDark: isDark),
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
            Text('Firmware Version: SmartOS v2.5 / RTOS Engine', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            Text('Active Architecture: Spatial UI + Rule-Driven Auto', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
            const SizedBox(height: 10),
            Text('Hardware Nodes: Smart Controller Gateway & Sensor Node', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
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
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => _MqttConfigurationDialog(isDark: isDark),
    );
  }

  void _showRebootConfirmDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Row(
          children: [
            const Icon(Icons.restart_alt_rounded, color: Color(0xFFF59E0B), size: 26),
            const SizedBox(width: 10),
            Text(
              'Remote Hardware Reset',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ],
        ),
        content: Text(
          'This will send a remote REBOOT_DEVICE signal to the ESP32 controller over MQTT.\n\nThe microcontroller will safely de-energize the pump relay and restart automatically without touching any physical buttons.\n\nAre you sure you want to proceed?',
          style: GoogleFonts.plusJakartaSans(fontSize: 12, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await ref.read(pumpProvider.notifier).rebootHardware();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      success
                          ? 'Remote reboot command dispatched to hardware!'
                          : 'Failed to dispatch reboot command. Check connectivity.',
                      style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
                    ),
                    backgroundColor: success ? AppColors.emeraldSuccess : AppColors.crimsonError,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              foregroundColor: Colors.white,
            ),
            child: Text('Reboot Hardware', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800)),
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
        leading: Navigator.canPop(context)
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => Navigator.pop(context),
              )
            : null,
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
                            'Smart Controller Mesh',
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
                  subtitle: 'Pair & provision a Smart Controller gateway',
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
                ValueListenableBuilder<bool>(
                  valueListenable: MqttRealtimeClient.instance.connectionNotifier,
                  builder: (context, isMqttConn, _) {
                    return _SettingsTile(
                      icon: Icons.cloud_sync_rounded,
                      iconColor: isMqttConn ? AppColors.emeraldSuccess : const Color(0xFF3B82F6),
                      title: 'MQTT & Network Broker',
                      subtitle: '${MqttRealtimeClient.instance.brokerHost}:${MqttRealtimeClient.instance.brokerPort} • ${isMqttConn ? "Live Connected" : "Tap to configure"}',
                      isDark: isDark,
                      textPrim: textPrim,
                      textSec: textSec,
                      onTap: () => _showMqttDialog(context, isDark),
                    );
                  },
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
                    activeThumbColor: AppColors.cyanPrimary,
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
                  subtitle: 'SmartOS v2.5 • Dual-Core RTOS • HydroNet',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  onTap: () => _showAboutDialog(context, isDark),
                ),
                Divider(height: 1, color: borderCol),
                _SettingsTile(
                  icon: Icons.restart_alt_rounded,
                  iconColor: const Color(0xFFF59E0B),
                  title: 'Remote Hardware Reset',
                  subtitle: 'Reboot ESP32 remotely over MQTT without pressing physical buttons',
                  isDark: isDark,
                  textPrim: textPrim,
                  textSec: textSec,
                  onTap: () => _showRebootConfirmDialog(context, ref),
                ),
                Divider(height: 1, color: borderCol),
                if (authState.hasClaimedHardware) ...[
                  _SettingsTile(
                    icon: Icons.link_off_rounded,
                    iconColor: AppColors.crimsonError,
                    title: 'Remove / Unpair Device',
                    subtitle: 'Unpair Smart Controller and return to empty view',
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

class _MqttConfigurationDialog extends StatefulWidget {
  final bool isDark;
  const _MqttConfigurationDialog({required this.isDark});

  @override
  State<_MqttConfigurationDialog> createState() => _MqttConfigurationDialogState();
}

class _MqttConfigurationDialogState extends State<_MqttConfigurationDialog> {
  late final TextEditingController _hostCtrl;
  late final TextEditingController _portCtrl;
  late final TextEditingController _userCtrl;
  late final TextEditingController _passCtrl;
  late bool _useTls;
  bool _isSaving = false;
  bool _isSyncing = false;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    final client = MqttRealtimeClient.instance;
    _hostCtrl = TextEditingController(text: client.brokerHost);
    _portCtrl = TextEditingController(text: client.brokerPort.toString());
    _userCtrl = TextEditingController(text: client.username ?? '');
    _passCtrl = TextEditingController(text: client.password ?? '');
    _useTls = client.useTls;
  }

  @override
  void dispose() {
    _hostCtrl.dispose();
    _portCtrl.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    setState(() => _isSaving = true);
    final host = _hostCtrl.text.trim().isEmpty ? 'broker.emqx.io' : _hostCtrl.text.trim();
    final port = int.tryParse(_portCtrl.text.trim()) ?? (_useTls ? 8883 : 1883);
    final user = _userCtrl.text.trim().isEmpty ? null : _userCtrl.text.trim();
    final pass = _passCtrl.text.trim().isEmpty ? null : _passCtrl.text.trim();

    await MqttRealtimeClient.instance.saveAndReconnect(
      host: host,
      port: port,
      username: user,
      password: pass,
      useTls: _useTls,
    );

    if (mounted) {
      setState(() => _isSaving = false);
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'MQTT connection settings saved! Reconnecting...',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
          ),
          backgroundColor: AppColors.emeraldSuccess,
        ),
      );
    }
  }

  Future<void> _handleAutoSync() async {
    setState(() => _isSyncing = true);
    final client = MqttRealtimeClient.instance;
    final success = await client.autoDetectConfig(defaultApiClient);
    if (mounted) {
      setState(() {
        _isSyncing = false;
        _hostCtrl.text = client.brokerHost;
        _portCtrl.text = client.brokerPort.toString();
        _userCtrl.text = client.username ?? '';
        _passCtrl.text = client.password ?? '';
        _useTls = client.useTls;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'MQTT broker settings auto-synchronized from server!'
                : 'Server config endpoint unreachable. Keeping current settings.',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
          ),
          backgroundColor: success ? AppColors.emeraldSuccess : const Color(0xFFF59E0B),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final client = MqttRealtimeClient.instance;

    return Dialog(
      backgroundColor: bgSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.cloud_sync_rounded, color: Color(0xFF3B82F6), size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'MQTT Broker & Auth',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: textPrim,
                          ),
                        ),
                        Text(
                          'Real-time IoT connection configuration',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            color: textSec,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ValueListenableBuilder<bool>(
                    valueListenable: client.connectionNotifier,
                    builder: (context, isConn, _) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isConn
                              ? AppColors.emeraldSuccess.withValues(alpha: 0.15)
                              : AppColors.crimsonError.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isConn
                                ? AppColors.emeraldSuccess.withValues(alpha: 0.4)
                                : AppColors.crimsonError.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: isConn ? AppColors.emeraldSuccess : AppColors.crimsonError,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              isConn ? 'Connected' : 'Offline',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: isConn ? AppColors.emeraldSuccess : AppColors.crimsonError,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Live Diagnostics Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: borderCol),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.sensors_rounded, size: 15, color: AppColors.cyanPrimary),
                        const SizedBox(width: 6),
                        Text(
                          'Hardware Telemetry Stream',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: textPrim,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ValueListenableBuilder<DateTime?>(
                      valueListenable: client.lastPingNotifier,
                      builder: (context, lastPing, _) {
                        final activeSerial = client.activeOnlineSerial ?? 'SP-CTRL-0000';
                        final pingAgo = lastPing != null
                            ? '${DateTime.now().difference(lastPing).inSeconds}s ago'
                            : 'Waiting for heartbeat packet';
                        return Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Node: $activeSerial',
                              style: GoogleFonts.jetBrainsMono(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: textSec,
                              ),
                            ),
                            Text(
                              'Ping: $pingAgo',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                color: lastPing != null ? AppColors.emeraldSuccess : textSec,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Broker Host & Port
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextField(
                      controller: _hostCtrl,
                      style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textPrim),
                      decoration: InputDecoration(
                        labelText: 'Broker Host / IP',
                        labelStyle: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
                        hintText: 'broker.emqx.io',
                        prefixIcon: const Icon(Icons.dns_rounded, size: 18),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: _portCtrl,
                      keyboardType: TextInputType.number,
                      style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textPrim),
                      decoration: InputDecoration(
                        labelText: 'Port',
                        labelStyle: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
                        hintText: '1883',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Username
              TextField(
                controller: _userCtrl,
                style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textPrim),
                decoration: InputDecoration(
                  labelText: 'MQTT Username (Optional)',
                  labelStyle: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
                  hintText: 'Leave empty for public broker',
                  prefixIcon: const Icon(Icons.person_outline_rounded, size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),

              // Password
              TextField(
                controller: _passCtrl,
                obscureText: _obscurePassword,
                style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textPrim),
                decoration: InputDecoration(
                  labelText: 'MQTT Password (Optional)',
                  labelStyle: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
                  hintText: 'Leave empty for public broker',
                  prefixIcon: const Icon(Icons.lock_outline_rounded, size: 18),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                      size: 18,
                    ),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),

              // TLS Toggle
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: borderCol),
                ),
                child: SwitchListTile(
                  title: Text(
                    'Enable TLS / SSL Encryption',
                    style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: textPrim),
                  ),
                  subtitle: Text(
                    _useTls ? 'Connecting securely (Port 8883 default)' : 'Standard unencrypted TCP (Port 1883)',
                    style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                  ),
                  value: _useTls,
                  activeThumbColor: AppColors.cyanPrimary,
                  onChanged: (val) {
                    setState(() {
                      _useTls = val;
                      if (val && _portCtrl.text == '1883') {
                        _portCtrl.text = '8883';
                      } else if (!val && _portCtrl.text == '8883') {
                        _portCtrl.text = '1883';
                      }
                    });
                  },
                ),
              ),
              const SizedBox(height: 16),

              // Actions
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _isSyncing ? null : _handleAutoSync,
                    icon: _isSyncing
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.sync_rounded, size: 16),
                    label: Text(
                      'Auto-Sync',
                      style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text('Cancel', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _isSaving ? null : _handleSave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.cyanPrimary,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isSaving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : Text(
                            'Save & Connect',
                            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 13),
                          ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

