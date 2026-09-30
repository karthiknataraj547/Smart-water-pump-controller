import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/api/api_client.dart';
import 'register_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty) {
      setState(() => _errorMessage = 'Please enter your registered email address.');
      return;
    }
    if (password.isEmpty) {
      setState(() => _errorMessage = 'Please enter your account password.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await ref.read(authProvider.notifier).login(email, password);
      // Navigation is handled automatically by AuthGate observing authProvider
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
          _errorMessage = 'Authentication failed: ${e.toString()}';
          _isLoading = false;
        });
      }
    }
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
                    'Specify the backend server IP or URL. Default is auto-discovery across Wi-Fi and USB.',
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
                        avatar: const Icon(Icons.wifi_rounded, size: 16),
                        label: const Text('192.168.31.53:3001 (Local Server)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        onPressed: () {
                          serverController.text = 'http://192.168.31.53:3001';
                        },
                      ),
                      ActionChip(
                        label: const Text('192.168.31.53:3000 (Backend API)', style: TextStyle(fontSize: 11)),
                        onPressed: () {
                          serverController.text = 'http://192.168.31.53:3000';
                        },
                      ),
                      ActionChip(
                        label: const Text('localhost:3001 (USB)', style: TextStyle(fontSize: 11)),
                        onPressed: () {
                          serverController.text = 'http://localhost:3001';
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

  void _showForgotPasswordDialog(BuildContext context, bool isDark) {
    final emailController = TextEditingController(text: _emailController.text.trim());
    final passController = TextEditingController();
    String? dialogError;
    bool dialogLoading = false;

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
            title: Text(
              'Reset Password',
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w700,
                color: textPrim,
              ),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Enter your registered email and choose a new password.',
                    style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec),
                  ),
                  const SizedBox(height: 16),
                  if (dialogError != null)
                    Container(
                      padding: const EdgeInsets.all(10),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        dialogError!,
                        style: GoogleFonts.plusJakartaSans(color: Colors.redAccent, fontSize: 12),
                      ),
                    ),
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: TextStyle(color: textPrim, fontSize: 14),
                    decoration: const InputDecoration(
                      labelText: 'Registered Email',
                      prefixIcon: Icon(Icons.email_outlined, size: 20),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: passController,
                    obscureText: true,
                    style: TextStyle(color: textPrim, fontSize: 14),
                    decoration: const InputDecoration(
                      labelText: 'New Password (min 8 chars, 1 uppercase, 1 digit)',
                      prefixIcon: Icon(Icons.lock_reset_rounded, size: 20),
                    ),
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
                onPressed: dialogLoading
                    ? null
                    : () async {
                        final em = emailController.text.trim();
                        final pw = passController.text;
                        if (em.isEmpty || !em.contains('@')) {
                          setDialogState(() => dialogError = 'Please enter a valid email.');
                          return;
                        }
                        if (pw.length < 8) {
                          setDialogState(() => dialogError = 'Password must be at least 8 characters.');
                          return;
                        }
                        if (!RegExp(r'[A-Z]').hasMatch(pw) ||
                            !RegExp(r'[a-z]').hasMatch(pw) ||
                            !RegExp(r'[0-9]').hasMatch(pw)) {
                          setDialogState(() => dialogError = 'Must contain uppercase, lowercase, and number.');
                          return;
                        }
                        setDialogState(() {
                          dialogLoading = true;
                          dialogError = null;
                        });
                        try {
                          final messenger = ScaffoldMessenger.of(context);
                          await ref.read(authProvider.notifier).resetPassword(em, pw);
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (mounted) {
                            _passwordController.text = pw;
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Password updated successfully! You can now sign in.'),
                                backgroundColor: Colors.green,
                              ),
                            );
                          }
                        } catch (e) {
                          setDialogState(() {
                            dialogLoading = false;
                            dialogError = e.toString().replaceAll('Exception: ', '');
                          });
                        }
                      },
                child: dialogLoading
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Update Password'),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        actions: [
          // Server Configuration Button
          Container(
            margin: const EdgeInsets.only(right: 8, top: 8),
            decoration: BoxDecoration(
              color: bgSurface,
              shape: BoxShape.circle,
              border: Border.all(color: borderCol),
            ),
            child: IconButton(
              tooltip: 'Server Connection Settings',
              onPressed: () => _showServerConfigDialog(context, isDark),
              icon: Icon(
                Icons.router_rounded,
                color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                size: 20,
              ),
            ),
          ),
          // Theme Toggle Button
          Container(
            margin: const EdgeInsets.only(right: 18, top: 8),
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
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Brand Logo Badge
                Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: AppColors.cyanBlueGradient,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.08),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.water_drop_rounded, size: 40, color: Colors.black),
                  ),
                ),
                const SizedBox(height: 24),

                // Headline
                Center(
                  child: Column(
                    children: [
                      Text(
                        'SmartPump',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: textPrim,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Zero-Trust IoT Water Management',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: textSec,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                Text(
                  'Sign In',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: textPrim,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Enter your credentials to securely manage your water pumps',
                  style: GoogleFonts.plusJakartaSans(fontSize: 12, color: textSec),
                ),
                const SizedBox(height: 20),

                // Error Message Banner (if any)
                if (_errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 18),
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

                // Email Field
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
                  decoration: InputDecoration(
                    labelText: 'Email Address',
                    hintText: 'Enter your registered email',
                    prefixIcon: Icon(Icons.mail_outline_rounded, color: textSec, size: 20),
                  ),
                ),
                const SizedBox(height: 18),

                // Password Field
                TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  style: GoogleFonts.plusJakartaSans(fontSize: 14, color: textPrim),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: 'Enter your password',
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
                  onSubmitted: (_) => _handleLogin(),
                ),
                const SizedBox(height: 12),

                // Forgot Password link
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => _showForgotPasswordDialog(context, isDark),
                    child: Text(
                      'Forgot password?',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Strong Authenticated Sign In Button
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                      foregroundColor: isDark ? Colors.black : Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.5),
                          )
                        : Text(
                            'Sign In',
                            style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
                          ),
                  ),
                ),
                const SizedBox(height: 32),

                // Don't have an account? Create account
                Center(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        "Don't have an account?",
                        style: GoogleFonts.plusJakartaSans(fontSize: 13, color: textSec),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (ctx) => const RegisterScreen()),
                          );
                        },
                        child: Text(
                          'Create account',
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
      ),
    );
  }
}
