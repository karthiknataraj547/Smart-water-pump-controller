import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../shared/dialogs/app_controls_sheet.dart';

class AutomationScreen extends ConsumerStatefulWidget {
  const AutomationScreen({super.key});

  @override
  ConsumerState<AutomationScreen> createState() => _AutomationScreenState();
}

class _AutomationScreenState extends ConsumerState<AutomationScreen> {
  bool _rule1 = true;
  bool _rule2 = true;

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        title: Text(
          'Automation Rules',
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
        foregroundColor: isDark ? Colors.black : Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: Text('New Rule', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          // Hardwired Safety Guard Banner
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.amberGlow,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.amberWarning),
            ),
            child: Row(
              children: [
                const Icon(Icons.shield_rounded, color: AppColors.amberWarning, size: 28),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hardware Dry-Run Interlock',
                        style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: AppColors.amberWarning, fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Active 24/7: Automatically cuts pump contactor if flow rate drops < 1.0 LPM for 20 seconds.',
                        style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // User Rule 1
          _RuleTile(
            title: 'Auto Refill on Low Water',
            condition: 'Tank Level < 30%',
            action: 'START PUMP',
            actionColor: AppColors.emeraldSuccess,
            cooldown: '300s Cooldown',
            isEnabled: _rule1,
            isDark: isDark,
            onChanged: (val) => setState(() => _rule1 = val),
          ),
          const SizedBox(height: 16),

          // User Rule 2
          _RuleTile(
            title: 'Overflow Cutoff Protection',
            condition: 'Tank Level > 90%',
            action: 'STOP PUMP',
            actionColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
            cooldown: 'Immediate',
            isEnabled: _rule2,
            isDark: isDark,
            onChanged: (val) => setState(() => _rule2 = val),
          ),
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}

class _RuleTile extends StatelessWidget {
  final String title;
  final String condition;
  final String action;
  final Color actionColor;
  final String cooldown;
  final bool isEnabled;
  final bool isDark;
  final ValueChanged<bool> onChanged;

  const _RuleTile({
    required this.title,
    required this.condition,
    required this.action,
    required this.actionColor,
    required this.cooldown,
    required this.isEnabled,
    required this.isDark,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: bgSurface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: borderCol),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.03),
            blurRadius: 10,
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
              Text(
                title,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: textPrim),
              ),
              Switch(
                value: isEnabled,
                onChanged: onChanged,
                activeThumbColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: bgElevated,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: borderCol),
                ),
                child: Row(
                  children: [
                    Icon(Icons.tune_rounded, size: 14, color: textSec),
                    const SizedBox(width: 6),
                    Text(condition, style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: textPrim)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Icon(Icons.arrow_forward_rounded, size: 16, color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: actionColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: actionColor),
                ),
                child: Text(
                  action,
                  style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: actionColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text('Safety limit: $cooldown', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec)),
        ],
      ),
    );
  }
}
