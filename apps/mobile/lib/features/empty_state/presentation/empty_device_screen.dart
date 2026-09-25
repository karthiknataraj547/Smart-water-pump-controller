import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../provisioning/presentation/ble_provisioning_dialog.dart';

class EmptyDeviceScreen extends ConsumerWidget {
  final VoidCallback onDeviceAdded;

  const EmptyDeviceScreen({super.key, required this.onDeviceAdded});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
        title: Text('Smart Pump', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: textPrim)),
        actions: [
          // Theme Toggle Button
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
          // Logout Button
          Container(
            margin: const EdgeInsets.only(right: 18),
            decoration: BoxDecoration(
              color: bgSurface,
              shape: BoxShape.circle,
              border: Border.all(color: borderCol),
            ),
            child: IconButton(
              tooltip: 'Sign Out',
              onPressed: () => ref.read(authProvider.notifier).logout(),
              icon: Icon(Icons.logout_rounded, color: textSec, size: 20),
            ),
          ),
        ],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Circular Pulse Halo with Disconnected Device Icon
              Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  color: bgElevated,
                  shape: BoxShape.circle,
                  border: Border.all(color: borderCol, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: isDark ? Colors.black.withValues(alpha: 0.3) : Colors.black.withValues(alpha: 0.04),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.sensors_off_rounded,
                  size: 52,
                  color: textSec,
                ),
              ),
              const SizedBox(height: 32),

              Text(
                'No device connected',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: textPrim,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Connect your first hardware node to monitor tank levels, live flow rates, and automate pump cycles.',
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  color: textSec,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 40),

              // Main Add Device Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (ctx) => BleProvisioningDialog(
                        onCompleted: onDeviceAdded,
                      ),
                    );
                  },
                  icon: Icon(Icons.add_rounded, color: isDark ? Colors.black : Colors.white, size: 22),
                  label: Text(
                    'Connect your first device',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.black : Colors.white,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Fast Demo Skip Button
              TextButton.icon(
                onPressed: onDeviceAdded,
                icon: Icon(Icons.arrow_forward_rounded, size: 16, color: textSec),
                label: Text(
                  'Explore Demo Dashboard with Simulated Node',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: textSec,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
