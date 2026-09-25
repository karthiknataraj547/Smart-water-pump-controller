import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/theme_provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../features/provisioning/presentation/ble_provisioning_dialog.dart';

void showAppControlsBottomSheet(BuildContext context, WidgetRef ref) {
  final isDark = ref.read(themeModeProvider) == ThemeMode.dark;
  final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
  final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
  final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;
  final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
  final authState = ref.read(authProvider);

  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (ctx) => Container(
      decoration: BoxDecoration(
        color: bgSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Settings & Controls',
                style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w800, color: textPrim),
              ),
              IconButton(
                onPressed: () => Navigator.pop(ctx),
                icon: Icon(Icons.close_rounded, color: textSec),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // User profile chip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkElevated : AppColors.lightElevated,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderCol),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: AppColors.cyanPrimary,
                  child: Text(
                    (authState.userName ?? 'U').substring(0, 1).toUpperCase(),
                    style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, color: Colors.black, fontSize: 13),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        authState.userName ?? 'SmartPump Admin',
                        style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13, color: textPrim),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        authState.userEmail ?? 'test@smartpump.io',
                        style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.emeraldSuccess.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Scoped JWT',
                    style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.emeraldSuccess),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Run BLE Provisioning Wizard
          Material(
            color: Colors.transparent,
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.bluetooth_searching_rounded, color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric),
              title: Text(
                'BLE Device Setup Wizard',
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: textPrim),
              ),
              subtitle: Text(
                'Pair & provision an ESP32 hardware node',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
              ),
              onTap: () {
                Navigator.pop(ctx);
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
          ),
          Divider(color: borderCol),

          // Remove Device / Unpair Hardware
          if (authState.hasClaimedHardware) ...[
            Material(
              color: Colors.transparent,
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.link_off_rounded, color: AppColors.crimsonError),
                title: Text(
                  'Remove SmartPump Device',
                  style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.crimsonError),
                ),
                subtitle: Text(
                  'Unpair ESP32 gateway and return to empty view',
                  style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
                ),
                onTap: () {
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
              ),
            ),
            Divider(color: borderCol),
          ],

          // Switch to Empty-Device View
          Material(
            color: Colors.transparent,
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.swap_horiz_rounded, color: AppColors.amberWarning),
              title: Text(
                'Toggle Empty-Device View',
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: textPrim),
              ),
              subtitle: Text(
                'Preview zero-hardware onboarding screen',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
              ),
              onTap: () {
                Navigator.pop(ctx);
                ref.read(authProvider.notifier).toggleHardwareState();
              },
            ),
          ),
          Divider(color: borderCol),

          // Sign Out
          Material(
            color: Colors.transparent,
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.logout_rounded, color: AppColors.crimsonError),
              title: Text(
                'Sign Out',
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.crimsonError),
              ),
              subtitle: Text(
                'Clear active token and return to Login screen',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
              ),
              onTap: () {
                Navigator.pop(ctx);
                ref.read(authProvider.notifier).logout();
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    ),
  );
}
