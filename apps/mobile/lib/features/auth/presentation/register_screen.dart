import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/api/api_client.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _mobileController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _mobileController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _showServerConfigDialog(BuildContext context, bool isDark) async {
    final currentCustom = await defaultApiClient.getCustomServerUrl();
    final activeUrl = defaultApiClient.activeBaseUrl;
    final serverController = TextEditingController(text: currentCustom ?? activeUrl);
    String? statusMsg;
    bool isSuccess = false;
    bool isTesting = false;

    if (!context.mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final surface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
          final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
          final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

          return AlertDialog(
            backgroundColor: surface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                Icon(Icons.router_rounded, color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric, size: 24),
                const SizedBox(width: 10),
                Text(
                  'Server Connection',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w700,
                    color: textPrim,
                    fontSize: 18,
                  ),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Specify backend server IP or URL. Auto-discovery tries Wi-Fi and USB.',
                    style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: serverController,
                    style: TextStyle(color: textPrim, fontSize: 13),
                    decoration: InputDecoration(
                      labelText: 'Backend URL / IP',
                      hintText: 'http://192.168.31.55:3000',
                      prefixIcon: const Icon(Icons.link_rounded, size: 20),
                      suffixIcon: IconButton(
                        icon: isTesting
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.bolt_rounded, size: 20),
                        tooltip: 'Test Connection',
                        onPressed: isTesting
                            ? null
                            : () async {
                                setDialogState(() {
                                  isTesting = true;
                                  statusMsg = null;
                                });
                                final target = serverController.text.trim();
                                final ok = await defaultApiClient.testServerUrl(target);
                                setDialogState(() {
                                  isTesting = false;
                                  isSuccess = ok;
                                  statusMsg = ok
                                      ? 'Server is ONLINE and reachable!'
                                      : 'Unable to reach server. Please check IP and Wi-Fi.';
                                });
                              },
                      ),
                    ),
                  ),
                  if (statusMsg != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSuccess
                            ? Colors.green.withValues(alpha: 0.15)
                            : Colors.red.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSuccess
                              ? Colors.green.withValues(alpha: 0.4)
                              : Colors.red.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isSuccess ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded,
                            size: 16,
                            color: isSuccess ? Colors.green : Colors.redAccent,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              statusMsg!,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isSuccess ? Colors.green : Colors.redAccent,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Text(
                    'Quick Presets:',
                    style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: textSec),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      ActionChip(
                        avatar: const Icon(Icons.cloud_done_rounded, size: 16),
                        label: const Text('Vercel Cloud (Anywhere)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        onPressed: () {
                          serverController.text = 'https://smart-water-pump-controller.vercel.app';
                        },
                      ),
                      ActionChip(
                        label: const Text('192.168.31.55:3000 (Local Wi-Fi)', style: TextStyle(fontSize: 11)),
                        onPressed: () {
                          serverController.text = 'http://192.168.31.55:3000';
                        },
                      ),
                      ActionChip(
                        label: const Text('localhost:3000 (USB)', style: TextStyle(fontSize: 11)),
                        onPressed: () {
                          serverController.text = 'http://localhost:3000';
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text('Cancel', style: TextStyle(color: textSec)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                  foregroundColor: isDark ? Colors.black : Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () async {
                  final target = serverController.text.trim();
                  final messenger = ScaffoldMessenger.of(context);
                  await defaultApiClient.setCustomServerUrl(target);
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) {
                    setState(() {
                      _errorMessage = null;
                    });
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text('Server endpoint updated to: $target'),
                        backgroundColor: Colors.teal,
                      ),
                    );
                  }
                },
                child: const Text('Save Endpoint'),
              ),
            ],
          );
        },
      ),
    );
  }

  void _handleRegister() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final mobile = _mobileController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (name.isEmpty) {
      setState(() => _errorMessage = 'Please enter your full name.');
      return;
    }
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _errorMessage = 'Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setState(() => _errorMessage = 'Password must be at least 8 characters.');
      return;
    }
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      setState(() => _errorMessage = 'Password must contain at least one uppercase letter (A-Z).');
      return;
    }
    if (!RegExp(r'[a-z]').hasMatch(password)) {
      setState(() => _errorMessage = 'Password must contain at least one lowercase letter (a-z).');
      return;
    }
    if (!RegExp(r'[0-9]').hasMatch(password)) {
      setState(() => _errorMessage = 'Password must contain at least one number (0-9).');
      return;
    }
    if (password != confirmPassword) {
      setState(() => _errorMessage = 'Passwords do not match.');
      return;
    }

    final cleanMobile = mobile.replaceAll(RegExp(r'[^\d+]'), '');

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await ref.read(authProvider.notifier).register(
            email: email,
            password: password,
            fullName: name,
            phoneNumber: cleanMobile.isNotEmpty ? cleanMobile : null,
          );

      if (mounted) {
        Navigator.pop(context); // Return to root shell which now displays EmptyDeviceScreen
      }
    } on AuthException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.message;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Registration failed: ${e.toString()}';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded, color: textPrim, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            tooltip: 'Server Connection Settings',
            onPressed: () => _showServerConfigDialog(context, isDark),
            icon: Icon(
              Icons.router_rounded,
              color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
              size: 20,
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Create Account',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: textPrim,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Register your IoT profile to isolate and manage your pump nodes',
                style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec),
              ),
              const SizedBox(height: 24),

              // Error Banner
              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.crimsonGlow,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.crimsonError.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.error_outline_rounded, color: AppColors.crimsonError, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.crimsonError,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (_errorMessage!.contains('reach') ||
                          _errorMessage!.contains('network') ||
                          _errorMessage!.contains('connect') ||
                          _errorMessage!.contains('server')) ...[
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton.icon(
                              style: TextButton.styleFrom(
                                foregroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                visualDensity: VisualDensity.compact,
                              ),
                              onPressed: () => _showServerConfigDialog(context, isDark),
                              icon: const Icon(Icons.settings_ethernet_rounded, size: 16),
                              label: const Text(
                                'Change Server IP / Test',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),

              // Full Name
              TextField(
                controller: _nameController,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
                decoration: InputDecoration(
                  labelText: 'Full Name',
                  hintText: 'John Doe',
                  prefixIcon: Icon(Icons.person_outline_rounded, color: textSec, size: 20),
                ),
              ),
              const SizedBox(height: 16),

              // Email
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
                decoration: InputDecoration(
                  labelText: 'Email Address',
                  hintText: 'name@example.com',
                  prefixIcon: Icon(Icons.mail_outline_rounded, color: textSec, size: 20),
                ),
              ),
              const SizedBox(height: 16),

              // Mobile Phone
              TextField(
                controller: _mobileController,
                keyboardType: TextInputType.phone,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
                decoration: InputDecoration(
                  labelText: 'Mobile Phone (Optional)',
                  hintText: '+91 98765 43210',
                  prefixIcon: Icon(Icons.phone_outlined, color: textSec, size: 20),
                ),
              ),
              const SizedBox(height: 16),

              // Password
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
                decoration: InputDecoration(
                  labelText: 'Password',
                  helperText: 'Min 8 chars, 1 uppercase, 1 lowercase & 1 number',
                  helperStyle: GoogleFonts.plusJakartaSans(fontSize: 11, color: textSec),
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
              const SizedBox(height: 16),

              // Confirm Password
              TextField(
                controller: _confirmPasswordController,
                obscureText: _obscurePassword,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
                decoration: InputDecoration(
                  labelText: 'Confirm Password',
                  prefixIcon: Icon(Icons.lock_outline_rounded, color: textSec, size: 20),
                ),
              ),
              const SizedBox(height: 28),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleRegister,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    foregroundColor: isDark ? Colors.black : Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                      : Text(
                          'Create Account & Continue',
                          style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
                        ),
                ),
              ),
              const SizedBox(height: 24),

              // Back to Login
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Already have an account?', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec)),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text(
                        'Sign In',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
