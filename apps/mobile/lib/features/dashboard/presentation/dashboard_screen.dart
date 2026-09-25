import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/pump/pump_provider.dart';
import '../../../shared/dialogs/app_controls_sheet.dart';
import '../../../shared/spatial_canvas/tank_pump_flow_canvas.dart';
import 'widgets/dashboard_analytics_curve_card.dart';

class DashboardScreen extends ConsumerWidget {
  final void Function(int)? onNavigateTab;

  const DashboardScreen({super.key, this.onNavigateTab});

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  void _handleEmergencyStop(BuildContext context, WidgetRef ref) {
    ref.read(pumpProvider.notifier).emergencyShutdown();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.crimsonError,
        behavior: SnackBarBehavior.floating,
        content: Row(
          children: [
            const Icon(Icons.report_problem_rounded, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'EMERGENCY SCRAM TRIPPED! Pump power isolated.',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _handleClearEmergency(BuildContext context, WidgetRef ref) {
    final isDark = ref.read(themeModeProvider) == ThemeMode.dark;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? AppColors.darkSurface : AppColors.lightSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.lock_reset_rounded, color: AppColors.cyanPrimary),
            const SizedBox(width: 10),
            Text(
              'Clear Safety Interlock?',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 16),
            ),
          ],
        ),
        content: Text(
          'Ensure the pump casing is primed, suction line is submerged, and lines are depressurized before restoring power.',
          style: GoogleFonts.plusJakartaSans(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(pumpProvider.notifier).clearEmergencyLockout();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.cyanPrimary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text('Authorize Reset', style: GoogleFonts.plusJakartaSans(color: Colors.black, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  void _showAutoCutoffDialog(BuildContext context, WidgetRef ref, PumpState pump, bool isDark) {
    int selectedMinutes = pump.remoteAutoCutoffMinutes;
    bool isEnabled = pump.isRemoteAutoCutoffEnabled;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
          final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
          final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
          final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

          return Container(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
            decoration: BoxDecoration(
              color: bgSurface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              border: Border.all(color: borderCol),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: borderCol,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Remote Auto Cutoff',
                      style: GoogleFonts.plusJakartaSans(fontSize: 17, fontWeight: FontWeight.w800, color: textPrim),
                    ),
                    Switch(
                      value: isEnabled,
                      activeColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                      onChanged: (val) {
                        setSheetState(() => isEnabled = val);
                      },
                    ),
                  ],
                ),
                Text(
                  'Stops pump coil and dispatches alert if continuous runtime reaches threshold.',
                  style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                ),
                const SizedBox(height: 18),
                Text(
                  'Maximum continuous runtime',
                  style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700, color: textPrim),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [15, 30, 45, 60].map((mins) {
                    final isSel = selectedMinutes == mins;
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setSheetState(() => selectedMinutes = mins),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: isSel
                                ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                                : (isDark ? AppColors.darkElevated : AppColors.lightElevated),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isSel ? Colors.transparent : borderCol),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '$mins min',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: isSel ? (isDark ? Colors.black : Colors.white) : textSec,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      ref.read(pumpProvider.notifier).setRemoteAutoCutoffEnabled(isEnabled);
                      ref.read(pumpProvider.notifier).setRemoteAutoCutoffMinutes(selectedMinutes);
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: isDark ? AppColors.darkElevated : AppColors.lightElevated,
                          content: Text(
                            isEnabled
                                ? 'Auto Cutoff set to $selectedMinutes minutes.'
                                : 'Auto Cutoff is disabled.',
                            style: GoogleFonts.plusJakartaSans(color: textPrim, fontWeight: FontWeight.w600),
                          ),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(
                      'Save Configuration',
                      style: GoogleFonts.plusJakartaSans(
                        color: isDark ? Colors.black : Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;
    final pump = ref.watch(pumpProvider);

    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        titleSpacing: 20,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _getGreeting(),
              style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: textSec),
            ),
            Row(
              children: [
                Text(
                  'Smart Pump',
                  style: GoogleFonts.plusJakartaSans(fontSize: 19, fontWeight: FontWeight.w900, color: textPrim, letterSpacing: -0.5),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 7,
                  height: 7,
                  decoration: const BoxDecoration(
                    color: AppColors.emeraldSuccess,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: AppColors.emeraldGlow, blurRadius: 4, spreadRadius: 1)],
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  'System Online',
                  style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Theme Toggle Button (Light / Dark)
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

          // Settings Button
          Container(
            margin: const EdgeInsets.only(right: 18),
            decoration: BoxDecoration(
              color: bgSurface,
              shape: BoxShape.circle,
              border: Border.all(color: borderCol),
            ),
            child: IconButton(
              tooltip: 'Settings & Hardware Config',
              onPressed: () => showAppControlsBottomSheet(context, ref),
              icon: Icon(Icons.settings_outlined, color: textSec, size: 20),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Emergency Active Warning Banner
            if (pump.isEmergencyStopped) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.crimsonGlow,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.crimsonError, width: 1.5),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, color: AppColors.crimsonError, size: 30),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Hardware Lockout Engaged', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: AppColors.crimsonError, fontSize: 13)),
                          const SizedBox(height: 2),
                          Text('Pump relay locked open. Power isolated.', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => _handleClearEmergency(context, ref),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.cyanPrimary,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text('Reset', style: GoogleFonts.plusJakartaSans(color: Colors.black, fontWeight: FontWeight.w800, fontSize: 12)),
                    ),
                  ],
                ),
              ),
            ],

            // =========================================================
            // =========================================================
            // 1. PRIMARY HERO PUMP CARD
            //    1) Big Tank + Small Motor Canvas (Top Pipe Inflow)
            //    2) Run Time Counter & Daily Cycles Element
            //    3) Modes Selector [ MANUAL | AUTO ]
            //    4) Start / Stop Buttons (Manual only) / Automation Banner (Auto)
            //    5) Emergency Stop Button (Both modes)
            // =========================================================
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: bgSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: borderCol, width: 1.0),
                boxShadow: [
                  BoxShadow(
                    color: isDark ? Colors.black.withValues(alpha: 0.25) : Colors.black.withValues(alpha: 0.03),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Spatial 3D Tank & Pump Flow Canvas
                  TankPumpFlowCanvas(
                    isRunning: pump.isRunning,
                    isStarting: pump.isStarting,
                    motorRpm: pump.motorRpm,
                    tankLevelPct: pump.tankLevelPct,
                    flowRateLpm: pump.flowRateLpm,
                    isDarkMode: isDark,
                  ),
                  const SizedBox(height: 12),

                  // 2. RUN TIME COUNTER & CYCLES ELEMENT
                  Row(
                    children: [
                      // RUN TIME COUNTER
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
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
                                  Icon(Icons.timer_outlined, size: 13, color: pump.isRunning ? const Color(0xFFF59E0B) : textSec),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      'RUN TIME COUNTER',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w800,
                                        color: textSec,
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  pump.isRunning ? pump.activeRunTime : '00:00:00 Standby',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: pump.isRunning ? const Color(0xFFF59E0B) : textPrim,
                                    fontFeatures: const [FontFeature.tabularFigures()],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // CYCLES ELEMENT
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
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
                                  Icon(Icons.repeat_rounded, size: 13, color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      'DAILY CYCLES',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w800,
                                        color: textSec,
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Row(
                                  children: [
                                    Text(
                                      '${pump.dailyCycleCount}',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w900,
                                        color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Cycles',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: textPrim,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Avg 18m',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                        color: textSec,
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
                  const SizedBox(height: 12),

                  // 3. MODES SELECTOR: [ MANUAL | AUTO ]
                  Container(
                    height: 44,
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: bgElevated,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: borderCol),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => ref.read(pumpProvider.notifier).setMode(PumpMode.manual),
                            child: Container(
                              decoration: BoxDecoration(
                                color: pump.mode == PumpMode.manual
                                    ? (isDark ? AppColors.darkSurface : Colors.white)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(11),
                                boxShadow: pump.mode == PumpMode.manual
                                    ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4)]
                                    : null,
                                border: pump.mode == PumpMode.manual
                                    ? Border.all(color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric, width: 1.2)
                                    : null,
                              ),
                              alignment: Alignment.center,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.touch_app_rounded,
                                    size: 15,
                                    color: pump.mode == PumpMode.manual
                                        ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                                        : textSec,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'MANUAL',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      fontWeight: pump.mode == PumpMode.manual ? FontWeight.w800 : FontWeight.w600,
                                      color: pump.mode == PumpMode.manual
                                          ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                                          : textSec,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => ref.read(pumpProvider.notifier).setMode(PumpMode.auto),
                            child: Container(
                              decoration: BoxDecoration(
                                color: pump.mode == PumpMode.auto
                                    ? (isDark ? AppColors.darkSurface : Colors.white)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(11),
                                boxShadow: pump.mode == PumpMode.auto
                                    ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4)]
                                    : null,
                                border: pump.mode == PumpMode.auto
                                    ? Border.all(color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric, width: 1.2)
                                    : null,
                              ),
                              alignment: Alignment.center,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.tune_rounded,
                                    size: 15,
                                    color: pump.mode == PumpMode.auto
                                        ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                                        : textSec,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'AUTO',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      fontWeight: pump.mode == PumpMode.auto ? FontWeight.w800 : FontWeight.w600,
                                      color: pump.mode == PumpMode.auto
                                          ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                                          : textSec,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // 4. START / STOP CONTROLS (ONLY IN MANUAL MODE!)
                  if (pump.mode == PumpMode.manual) ...[
                    Row(
                      children: [
                        // START BUTTON
                        Expanded(
                          child: SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: (!pump.isRunning && !pump.isEmergencyStopped && !pump.isStarting)
                                  ? () => ref.read(pumpProvider.notifier).startPump()
                                  : null,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                                foregroundColor: isDark ? Colors.black : Colors.white,
                                elevation: pump.isRunning ? 0 : 3,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                              child: pump.isStarting
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        const Icon(Icons.play_arrow_rounded, size: 20),
                                        const SizedBox(width: 4),
                                        Text('START', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                                      ],
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),

                        // STOP BUTTON
                        Expanded(
                          child: SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: (pump.isRunning && !pump.isEmergencyStopped)
                                  ? () => ref.read(pumpProvider.notifier).stopPump()
                                  : null,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEF4444),
                                foregroundColor: Colors.white,
                                elevation: pump.isRunning ? 3 : 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.stop_rounded, size: 20),
                                  const SizedBox(width: 4),
                                  Text('STOP', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ] else ...[
                    // AUTO MODE BANNER (NO START/STOP BUTTONS!)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: (isDark ? AppColors.cyanPrimary : AppColors.blueElectric).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: (isDark ? AppColors.cyanPrimary : AppColors.blueElectric).withValues(alpha: 0.3),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.tune_rounded,
                                size: 16,
                                color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'Controlled by: Automation Rules',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Tank < 30% → ON  •  Tank > 90% → OFF  •  Cutoff: ${pump.remoteAutoCutoffMinutes}m',
                            style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // 5. EMERGENCY STOP BUTTON (AVAILABLE IN BOTH MODES!)
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: pump.isEmergencyStopped
                          ? () => _handleClearEmergency(context, ref)
                          : () => _handleEmergencyStop(context, ref),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: pump.isEmergencyStopped
                            ? const Color(0xFFF59E0B)
                            : AppColors.crimsonError,
                        foregroundColor: Colors.white,
                        elevation: 3,
                        shadowColor: AppColors.crimsonError.withValues(alpha: 0.4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            pump.isEmergencyStopped ? Icons.lock_reset_rounded : Icons.power_off_rounded,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            pump.isEmergencyStopped ? 'RESET SAFETY INTERLOCK' : '🛑 EMERGENCY STOP',
                            style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // =========================================================
            // 2. DASHBOARD INFORMATION CARDS (THE 4 PRIMARY METRICS)
            // =========================================================
            Row(
              children: [
                // WATER LEVEL: 72% | 720 / 1000 L
                Expanded(
                  child: _DashboardMetricCard(
                    title: 'WATER LEVEL',
                    value: '${pump.tankLevelPct.toInt()}%',
                    subtitle: '${(pump.tankLevelPct * 10).toInt()} / 1000 L',
                    icon: Icons.water_drop_rounded,
                    accentColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    isDark: isDark,
                  ),
                ),
                const SizedBox(width: 12),

                // TDS: 245 ppm | Normal
                Expanded(
                  child: _DashboardMetricCard(
                    title: 'TDS',
                    value: '${pump.tdsPpm} ppm',
                    subtitle: 'Normal Potable',
                    icon: Icons.biotech_rounded,
                    accentColor: AppColors.tealAccent,
                    isDark: isDark,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                // PUMPED TODAY: 1,280 L | ↑ 8%
                Expanded(
                  child: _DashboardMetricCard(
                    title: 'PUMPED TODAY',
                    value: '1,280 L',
                    subtitle: '↑ 8% vs yesterday',
                    icon: Icons.local_drink_rounded,
                    accentColor: const Color(0xFF3B82F6),
                    isDark: isDark,
                  ),
                ),
                const SizedBox(width: 12),

                // AUTO CUTOFF: ● ENABLED | 45 min limit (Tappable to configure)
                Expanded(
                  child: GestureDetector(
                    onTap: () => _showAutoCutoffDialog(context, ref, pump, isDark),
                    child: _DashboardMetricCard(
                      title: 'AUTO CUTOFF',
                      value: pump.isRemoteAutoCutoffEnabled ? '● ENABLED' : '○ DISABLED',
                      subtitle: '${pump.remoteAutoCutoffMinutes} min limit (tap ⚙)',
                      icon: Icons.timer_outlined,
                      accentColor: pump.isRemoteAutoCutoffEnabled ? AppColors.emeraldSuccess : const Color(0xFFF59E0B),
                      isDark: isDark,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // =========================================================
            // 3. DASHBOARD ANALYTICS CURVE QUICK CARD (SINGLE PARAMETER)
            // =========================================================
            DashboardAnalyticsCurveCard(
              pump: pump,
              isDark: isDark,
              onOpenTelemetry: () => onNavigateTab?.call(3),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

// -------------------------------------------------------------
// REUSABLE DASHBOARD WIDGETS
// -------------------------------------------------------------
class _DashboardMetricCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color accentColor;
  final bool isDark;

  const _DashboardMetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.accentColor,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bgSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderCol),
        boxShadow: [
          BoxShadow(
            color: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: textSec,
                  letterSpacing: 0.5,
                ),
              ),
              Icon(icon, size: 16, color: accentColor),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: textPrim,
              letterSpacing: -0.5,
            ),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: textSec),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
