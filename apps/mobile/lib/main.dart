import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_provider.dart';
import 'core/auth/auth_provider.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/empty_state/presentation/empty_device_screen.dart';
import 'features/dashboard/presentation/dashboard_screen.dart';
import 'features/hardware/presentation/hardware_screen.dart';
import 'features/pump_control/presentation/pump_control_screen.dart';
import 'features/telemetry/presentation/telemetry_screen.dart';
import 'features/settings/presentation/settings_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: SmartPumpApp()));
}

class SmartPumpApp extends ConsumerWidget {
  const SmartPumpApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp(
      title: 'Smart Water Pump Controller',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      home: const AuthGate(),
    );
  }
}

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    // 0. Restoring persisted session
    if (authState.isRestoring) {
      return const Scaffold(
        backgroundColor: AppColors.darkBg,
        body: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              color: AppColors.cyanPrimary,
              strokeWidth: 2,
            ),
          ),
        ),
      );
    }

    // 1. Unauthenticated -> Show Login Screen
    if (!authState.isAuthenticated) {
      return const LoginScreen();
    }

    // 2. Authenticated but No Device Claimed -> Show Empty Device Wizard
    if (!authState.hasClaimedHardware) {
      return EmptyDeviceScreen(
        onDeviceAdded: () {
          ref.read(authProvider.notifier).claimHardware();
        },
      );
    }

    // 3. Authenticated with Device -> Full Dashboard Navigation Shell
    return const MainNavigationShell();
  }
}

class MainNavigationShell extends ConsumerStatefulWidget {
  const MainNavigationShell({super.key});

  @override
  ConsumerState<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends ConsumerState<MainNavigationShell> {
  int _currentIndex = 0;

  late final List<Widget> _screens = [
    DashboardScreen(onNavigateTab: (idx) => setState(() => _currentIndex = idx)),
    const HardwareScreen(),
    const PumpControlScreen(),
    const TelemetryScreen(),
    SettingsScreen(onNavigateTab: (idx) => setState(() => _currentIndex = idx)),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = ref.watch(themeModeProvider) == ThemeMode.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
          border: Border(
            top: BorderSide(
              color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
              width: 1.0,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.05),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          backgroundColor: Colors.transparent,
          elevation: 0,
          selectedItemColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
          unselectedItemColor: isDark ? AppColors.darkTextMuted : AppColors.lightTextMuted,
          selectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 11),
          unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w500, fontSize: 11),
          type: BottomNavigationBarType.fixed,
          onTap: (index) {
            setState(() => _currentIndex = index);
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.speed_rounded),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.memory_rounded),
              label: 'Device',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.water_drop_rounded),
              label: 'Pump',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.insights_rounded),
              label: 'Telemetry',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.settings_rounded),
              label: 'Settings',
            ),
          ],
        ),
      ),
    );
  }
}
