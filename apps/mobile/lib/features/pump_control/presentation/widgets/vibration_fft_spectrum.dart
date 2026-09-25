import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_theme.dart';

class VibrationFftSpectrum extends StatefulWidget {
  final bool isRunning;
  final double vibrationMms;
  final double motorTempC;
  final bool isDark;

  const VibrationFftSpectrum({
    super.key,
    required this.isRunning,
    required this.vibrationMms,
    required this.motorTempC,
    required this.isDark,
  });

  @override
  State<VibrationFftSpectrum> createState() => _VibrationFftSpectrumState();
}

class _VibrationFftSpectrumState extends State<VibrationFftSpectrum> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  final List<double> _baseHeights = [
    0.15, 0.22, 0.38, 0.85, 0.42, 0.28, 0.35, 0.65, 0.48, 0.25, 0.30, 0.55, 0.32, 0.18, 0.24, 0.12
  ];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bgElevated = widget.isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final borderCol = widget.isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = widget.isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = widget.isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: widget.isDark ? AppColors.darkSurface : AppColors.lightSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderCol),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with ISO Rating Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.emeraldSuccess.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.graphic_eq_rounded, color: AppColors.emeraldSuccess, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Vibration FFT Analysis',
                        style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w800, color: textPrim),
                      ),
                      Text(
                        'ISO 10816-3 Class A Baseline',
                        style: GoogleFonts.plusJakartaSans(fontSize: 10, color: textSec, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.emeraldSuccess.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.emeraldSuccess.withValues(alpha: 0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.emeraldSuccess, shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    Text(
                      '${widget.vibrationMms} mm/s RMS',
                      style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.emeraldSuccess),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 16-band FFT Spectrum Oscilloscope Visualizer
          Container(
            height: 70,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderCol),
            ),
            child: AnimatedBuilder(
              animation: _animController,
              builder: (context, child) {
                return Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: List.generate(_baseHeights.length, (index) {
                    final base = _baseHeights[index];
                    final dynamicFactor = widget.isRunning
                        ? math.sin((_animController.value * math.pi) + (index * 0.4)).abs() * 0.35
                        : 0.05;
                    final heightFrac = (widget.isRunning ? (base + dynamicFactor) : 0.08).clamp(0.06, 1.0);

                    final isPeak = index == 3 || index == 7; // 1X Shaft & 2X Line harmonics

                    return Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          width: 12,
                          height: 48 * heightFrac,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            gradient: LinearGradient(
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                              colors: widget.isRunning
                                  ? (isPeak
                                      ? [const Color(0xFF059669), const Color(0xFF34D399), AppColors.cyanPrimary]
                                      : [const Color(0xFF047857), const Color(0xFF10B981)])
                                  : [Colors.grey.shade600, Colors.grey.shade400],
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
                );
              },
            ),
          ),
          const SizedBox(height: 6),

          // Frequency Axis Labels
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('10 Hz', style: GoogleFonts.plusJakartaSans(fontSize: 9, color: textSec, fontWeight: FontWeight.w600)),
                Text('47.5 Hz (1X Shaft)', style: GoogleFonts.plusJakartaSans(fontSize: 9, color: widget.isDark ? AppColors.cyanPrimary : AppColors.blueElectric, fontWeight: FontWeight.w700)),
                Text('100 Hz (2X Line)', style: GoogleFonts.plusJakartaSans(fontSize: 9, color: const Color(0xFF10B981), fontWeight: FontWeight.w700)),
                Text('500 Hz', style: GoogleFonts.plusJakartaSans(fontSize: 9, color: textSec, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Thermal Dissipation Progress Gauge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Stator Winding Heat Dissipation',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w700, color: textSec),
              ),
              Text(
                '${widget.motorTempC}°C / 75°C Trip',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: textPrim),
              ),
            ],
          ),
          const SizedBox(height: 8),

          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: (widget.motorTempC / 75.0).clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: bgElevated,
              valueColor: AlwaysStoppedAnimation<Color>(
                widget.motorTempC > 65
                    ? AppColors.crimsonError
                    : (widget.motorTempC > 50 ? const Color(0xFFF59E0B) : const Color(0xFF10B981)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
