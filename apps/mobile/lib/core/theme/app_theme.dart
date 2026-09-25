import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Professional, engineering-grade design tokens for the Smart Water Pump ecosystem.
/// Inspired by industrial SCADA, Tesla Energy, and Linear precision interfaces.
class AppColors {
  // === DARK PALETTE (Deep Obsidian / Graphite Slate) ===
  static const darkBg = Color(0xFF0A0E17);
  static const darkSurface = Color(0xFF111827);
  static const darkElevated = Color(0xFF1A2438);
  static const darkBorder = Color(0xFF22304A);
  static const darkBorderSubtle = Color(0xFF1A253A);

  static const darkTextPrimary = Color(0xFFF8FAFC);
  static const darkTextSecondary = Color(0xFF94A3B8);
  static const darkTextMuted = Color(0xFF64748B);

  // === LIGHT PALETTE (Apple Studio Clean Slate) ===
  static const lightBg = Color(0xFFF8FAFC);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightElevated = Color(0xFFF1F5F9);
  static const lightBorder = Color(0xFFE2E8F0);
  static const lightBorderSubtle = Color(0xFFEEF2F6);

  static const lightTextPrimary = Color(0xFF0F172A);
  static const lightTextSecondary = Color(0xFF475569);
  static const lightTextMuted = Color(0xFF94A3B8);

  // Backward-compatible aliases
  static const surface = darkSurface;
  static const surfaceElevated = darkElevated;
  static const border = darkBorder;
  static const textPrimary = darkTextPrimary;
  static const textSecondary = darkTextSecondary;
  static const textMuted = darkTextMuted;
  static const success = emeraldSuccess;
  static const successGlow = emeraldGlow;
  static const warning = amberWarning;
  static const error = crimsonError;
  static const errorGlow = crimsonGlow;

  // === ACCENT BRAND COLORS (Calibrated Precision Industrial Palette) ===
  static const cyanPrimary = Color(0xFF38BDF8); // Precision Sky 400 (calm, crisp, high legibility)
  static const cyanGlow = Color(0x1F38BDF8);
  static const blueElectric = Color(0xFF0284C7); // Sky 600
  static const blueGlow = Color(0x1F0284C7);
  static const indigoData = Color(0xFF6366F1); // Indigo 500
  static const tealAccent = Color(0xFF0D9488); // Teal 600

  static const emeraldSuccess = Color(0xFF10B981); // Emerald 500
  static const emeraldGlow = Color(0x1F10B981);
  static const amberWarning = Color(0xFFF59E0B); // Amber 500
  static const amberGlow = Color(0x1FF59E0B);
  static const crimsonError = Color(0xFFEF4444); // Red 500
  static const crimsonDark = Color(0xFFDC2626); // Red 600
  static const crimsonGlow = Color(0x28EF4444);

  // Gradients
  static const cyanBlueGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF38BDF8), Color(0xFF0284C7)],
  );

  static const pumpRunningGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF10B981), Color(0xFF059669)],
  );

  static const dangerGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
  );
}

class AppTheme {
  static ThemeData get darkTheme {
    final base = ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.darkBg,
      primaryColor: AppColors.cyanPrimary,
      cardColor: AppColors.darkSurface,
      dividerColor: AppColors.darkBorder,
    );

    return base.copyWith(
      textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
        bodyColor: AppColors.darkTextPrimary,
        displayColor: AppColors.darkTextPrimary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          color: AppColors.darkTextPrimary,
          fontSize: 19,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkElevated,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.darkBorder, width: 1.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.darkBorder, width: 1.0),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.cyanPrimary, width: 1.5),
        ),
        labelStyle: GoogleFonts.plusJakartaSans(color: AppColors.darkTextSecondary, fontSize: 13),
        hintStyle: GoogleFonts.plusJakartaSans(color: AppColors.darkTextMuted, fontSize: 13),
      ),
      colorScheme: const ColorScheme.dark(
        primary: AppColors.cyanPrimary,
        surface: AppColors.darkSurface,
        error: AppColors.crimsonError,
      ),
    );
  }

  static ThemeData get lightTheme {
    final base = ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.lightBg,
      primaryColor: AppColors.blueElectric,
      cardColor: AppColors.lightSurface,
      dividerColor: AppColors.lightBorder,
    );

    return base.copyWith(
      textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
        bodyColor: AppColors.lightTextPrimary,
        displayColor: AppColors.lightTextPrimary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          color: AppColors.lightTextPrimary,
          fontSize: 19,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.lightElevated,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.lightBorder, width: 1.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.lightBorder, width: 1.0),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.blueElectric, width: 1.5),
        ),
        labelStyle: GoogleFonts.plusJakartaSans(color: AppColors.lightTextSecondary, fontSize: 13),
        hintStyle: GoogleFonts.plusJakartaSans(color: AppColors.lightTextMuted, fontSize: 13),
      ),
      colorScheme: const ColorScheme.light(
        primary: AppColors.blueElectric,
        surface: AppColors.lightSurface,
        error: AppColors.crimsonError,
      ),
    );
  }
}
