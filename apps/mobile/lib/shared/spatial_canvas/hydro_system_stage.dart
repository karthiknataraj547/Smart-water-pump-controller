import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';

class HydroSystemStage extends StatefulWidget {
  final bool isRunning;
  final bool isStarting;
  final int motorRpm;
  final double tankLevelPct;
  final double flowRateLpm;
  final bool isDarkMode;
  final VoidCallback? onTogglePump;

  const HydroSystemStage({
    super.key,
    required this.isRunning,
    this.isStarting = false,
    required this.motorRpm,
    required this.tankLevelPct,
    required this.flowRateLpm,
    required this.isDarkMode,
    this.onTogglePump,
  });

  @override
  State<HydroSystemStage> createState() => _HydroSystemStageState();
}

class _HydroSystemStageState extends State<HydroSystemStage> with TickerProviderStateMixin {
  late AnimationController _waveController;
  late AnimationController _rotationController;
  final List<_StageBubble> _tankBubbles = [];
  final List<_PipePulse> _pipePulses = [];
  final math.Random _random = math.Random();

  @override
  void initState() {
    super.initState();

    // 1. Water waves and bubbling animation controller (2.2s loop)
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();

    // 2. High-speed motor impeller rotation controller (1.0s loop)
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat();

    // Pre-populate ambient reservoir bubbles
    for (int i = 0; i < 18; i++) {
      _tankBubbles.add(_StageBubble(
        x: 0.15 + _random.nextDouble() * 0.7,
        y: _random.nextDouble(),
        size: 1.8 + _random.nextDouble() * 3.2,
        speed: 0.2 + _random.nextDouble() * 0.4,
        wobbleSpeed: 2.5 + _random.nextDouble() * 3.5,
      ));
    }

    // Pre-populate pipe fluid pulses
    for (int i = 0; i < 6; i++) {
      _pipePulses.add(_PipePulse(
        progress: (i / 6.0),
        size: 2.5 + _random.nextDouble() * 2.0,
      ));
    }
  }

  @override
  void dispose() {
    _waveController.dispose();
    _rotationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final totalWidth = constraints.maxWidth;
        // Responsive allocation between Motor, Conduit, and Tank
        final motorSize = (totalWidth * 0.42).clamp(135.0, 165.0);
        final tankWidth = (totalWidth * 0.38).clamp(120.0, 150.0);
        const stageHeight = 205.0;

        return AnimatedBuilder(
          animation: Listenable.merge([_waveController, _rotationController]),
          builder: (context, child) {
            return SizedBox(
              width: totalWidth,
              height: stageHeight,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // 1. CENTRIFUGAL PUMP MOTOR WITH ROTATING IMPELLER
                  GestureDetector(
                    onTap: widget.onTogglePump,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CustomPaint(
                          size: Size(motorSize, motorSize),
                          painter: _HighFidelityMotorPainter(
                            rotationValue: _rotationController.value,
                            isRunning: widget.isRunning,
                            isStarting: widget.isStarting,
                            isDarkMode: widget.isDarkMode,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: widget.isRunning ? AppColors.emeraldSuccess : const Color(0xFF94A3B8),
                                shape: BoxShape.circle,
                                boxShadow: widget.isRunning
                                    ? [const BoxShadow(color: AppColors.emeraldGlow, blurRadius: 4, spreadRadius: 1)]
                                    : null,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              widget.isRunning ? '${widget.motorRpm} RPM' : '0 RPM',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: widget.isRunning
                                    ? (widget.isDarkMode ? AppColors.cyanPrimary : AppColors.blueElectric)
                                    : (widget.isDarkMode ? Colors.white70 : Colors.black87),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          widget.isRunning ? 'Tap to Stop' : 'Tap to Start',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: widget.isDarkMode ? Colors.white38 : Colors.black45,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // 2. TRANSPARENT HYDRAULIC CONDUIT PIPE (CONNECTS MOTOR TO TANK)
                  Expanded(
                    child: CustomPaint(
                      size: const Size(double.infinity, 90),
                      painter: _ConduitFlowPainter(
                        flowProgress: _waveController.value,
                        isRunning: widget.isRunning,
                        flowRateLpm: widget.flowRateLpm,
                        isDarkMode: widget.isDarkMode,
                        pulses: _pipePulses,
                      ),
                    ),
                  ),

                  // 3. ACRYLIC VOLUMETRIC RESERVOIR WATER TANK
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CustomPaint(
                        size: Size(tankWidth, 160),
                        painter: _HighFidelityTankPainter(
                          waveValue: _waveController.value,
                          tankLevelPct: widget.tankLevelPct,
                          flowRateLpm: widget.flowRateLpm,
                          isRunning: widget.isRunning,
                          isDarkMode: widget.isDarkMode,
                          bubbles: _tankBubbles,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${widget.tankLevelPct.toInt()}% • ${(widget.tankLevelPct * 10).toInt()}L',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: widget.isDarkMode ? AppColors.cyanPrimary : AppColors.blueElectric,
                        ),
                      ),
                      Text(
                        'Reservoir Level',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: widget.isDarkMode ? Colors.white38 : Colors.black45,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// =========================================================================
// 1. HIGH-FIDELITY MOTOR & IMPELLER PAINTER
// =========================================================================
class _HighFidelityMotorPainter extends CustomPainter {
  final double rotationValue;
  final bool isRunning;
  final bool isStarting;
  final bool isDarkMode;

  _HighFidelityMotorPainter({
    required this.rotationValue,
    required this.isRunning,
    required this.isStarting,
    required this.isDarkMode,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final outerRadius = size.width * 0.46;

    // 1. Ambient Stator Electromagnetic Glow
    if (isRunning) {
      final glowPaint = Paint()
        ..color = AppColors.emeraldSuccess.withValues(alpha: 0.35)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 16);
      canvas.drawCircle(center, outerRadius + 2, glowPaint);
    }

    // 2. Cast Stator Motor Housing (Outer Metallic Rim with Cooling Grooves)
    final statorPaint = Paint()
      ..shader = SweepGradient(
        colors: isRunning
            ? [
                const Color(0xFF10B981),
                const Color(0xFF065F46),
                const Color(0xFF34D399),
                const Color(0xFF047857),
                const Color(0xFF10B981),
              ]
            : [
                isDarkMode ? const Color(0xFF475569) : const Color(0xFF94A3B8),
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                isDarkMode ? const Color(0xFF475569) : const Color(0xFF94A3B8),
              ],
        transform: GradientRotation(rotationValue * 2 * math.pi),
      ).createShader(Rect.fromCircle(center: center, radius: outerRadius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.5;

    canvas.drawCircle(center, outerRadius - 3, statorPaint);

    // Stator Bolt Fasteners (8 bolts)
    final boltPaint = Paint()
      ..color = isDarkMode ? Colors.white30 : Colors.black26
      ..style = PaintingStyle.fill;
    for (int i = 0; i < 8; i++) {
      final angle = (i / 8) * 2 * math.pi;
      final bx = center.dx + (outerRadius - 3) * math.cos(angle);
      final by = center.dy + (outerRadius - 3) * math.sin(angle);
      canvas.drawCircle(Offset(bx, by), 2.2, boltPaint);
    }

    // 3. Volute Fluid Chamber Background
    final chamberPaint = Paint()
      ..shader = RadialGradient(
        colors: isRunning
            ? [
                isDarkMode ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5),
                isDarkMode ? const Color(0xFF022C22) : const Color(0xFFA7F3D0),
                isDarkMode ? const Color(0xFF0B192C) : const Color(0xFFE0F2FE),
              ]
            : [
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
              ],
      ).createShader(Rect.fromCircle(center: center, radius: outerRadius - 7))
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, outerRadius - 7, chamberPaint);

    // 4. Dynamic Fluid Vortex Eddies (When Running)
    if (isRunning) {
      final eddyPaint = Paint()
        ..color = const Color(0xFF34D399).withValues(alpha: 0.3)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;

      for (int i = 0; i < 3; i++) {
        final startAngle = (rotationValue * 2 * math.pi * 1.5) + (i * 2 * math.pi / 3);
        final r = (outerRadius - 16) * (0.6 + i * 0.15);
        canvas.drawArc(Rect.fromCircle(center: center, radius: r), startAngle, math.pi * 0.7, false, eddyPaint);
      }
    }

    // 5. 6-Blade Curved Industrial Bronze Impeller
    final impellerRadius = outerRadius * 0.65;
    final vaneRotation = isRunning ? (rotationValue * 2 * math.pi * 2.5) : 0.0;
    const vaneCount = 6;

    for (int i = 0; i < vaneCount; i++) {
      final angle = vaneRotation + (i * 2 * math.pi / vaneCount);
      _drawImpellerVane(canvas, center, impellerRadius, angle, isRunning);
    }

    // 6. Central Bearing Hub & Tactile Contactor Core
    final hubRadius = outerRadius * 0.35;

    final hubPaint = Paint()
      ..shader = RadialGradient(
        colors: isRunning
            ? [
                const Color(0xFF10B981),
                const Color(0xFF065F46),
                const Color(0xFF022C22),
              ]
            : [
                isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFF94A3B8),
              ],
      ).createShader(Rect.fromCircle(center: center, radius: hubRadius))
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, hubRadius, hubPaint);

    final hubBorder = Paint()
      ..color = isRunning ? AppColors.emeraldSuccess : (isDarkMode ? AppColors.darkBorder : AppColors.lightBorder)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawCircle(center, hubRadius, hubBorder);

    // 7. Mechanical Power Contactor Icon
    if (isStarting) {
      final startPaint = Paint()
        ..color = AppColors.cyanPrimary
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.8
        ..strokeCap = StrokeCap.round;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: hubRadius - 6),
        rotationValue * 2 * math.pi,
        math.pi * 1.3,
        false,
        startPaint,
      );
    } else {
      final iconPaint = Paint()
        ..color = isRunning ? Colors.white : (isDarkMode ? Colors.white60 : Colors.black54)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: 12),
        -math.pi * 0.7,
        math.pi * 1.4,
        false,
        iconPaint,
      );
      canvas.drawLine(
        Offset(center.dx, center.dy - 14),
        Offset(center.dx, center.dy - 5),
        iconPaint,
      );
    }
  }

  void _drawImpellerVane(Canvas canvas, Offset center, double radius, double angle, bool isRunning) {
    final vanePaint = Paint()
      ..shader = LinearGradient(
        colors: isRunning
            ? [
                const Color(0xFF6EE7B7),
                const Color(0xFF059669),
                const Color(0xFF064E3B),
              ]
            : [
                isDarkMode ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
              ],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round;

    final path = Path();
    final startR = radius * 0.35;
    final endR = radius;

    final x1 = center.dx + startR * math.cos(angle);
    final y1 = center.dy + startR * math.sin(angle);

    final x2 = center.dx + endR * math.cos(angle + 0.42);
    final y2 = center.dy + endR * math.sin(angle + 0.42);

    final cpX = center.dx + (startR + endR) * 0.5 * math.cos(angle + 0.15);
    final cpY = center.dy + (startR + endR) * 0.5 * math.sin(angle + 0.15);

    path.moveTo(x1, y1);
    path.quadraticBezierTo(cpX, cpY, x2, y2);
    canvas.drawPath(path, vanePaint);
  }

  @override
  bool shouldRepaint(covariant _HighFidelityMotorPainter oldDelegate) {
    return oldDelegate.rotationValue != rotationValue ||
        oldDelegate.isRunning != isRunning ||
        oldDelegate.isStarting != isStarting ||
        oldDelegate.isDarkMode != isDarkMode;
  }
}

// =========================================================================
// 2. CONDUIT FLOW PAINTER (TRANSPARENT PRESSURE PIPE FROM MOTOR TO TANK)
// =========================================================================
class _PipePulse {
  double progress;
  double size;

  _PipePulse({required this.progress, required this.size});

  void update(double delta) {
    progress += delta;
    if (progress > 1.0) progress -= 1.0;
  }
}

class _ConduitFlowPainter extends CustomPainter {
  final double flowProgress;
  final bool isRunning;
  final double flowRateLpm;
  final bool isDarkMode;
  final List<_PipePulse> pulses;

  _ConduitFlowPainter({
    required this.flowProgress,
    required this.isRunning,
    required this.flowRateLpm,
    required this.isDarkMode,
    required this.pulses,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final startY = size.height * 0.5;
    final startX = 2.0;
    final endX = size.width - 2.0;
    const pipeHeight = 16.0;

    final pipeRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(startX, startY - (pipeHeight / 2), endX - startX, pipeHeight),
      const Radius.circular(8),
    );

    // 1. Pipe Glass Background
    final pipeBg = Paint()
      ..color = (isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0)).withValues(alpha: 0.7)
      ..style = PaintingStyle.fill;
    canvas.drawRRect(pipeRect, pipeBg);

    // 2. High-Pressure Liquid Flow Stream (When Running)
    if (isRunning) {
      final waterStreamPaint = Paint()
        ..shader = LinearGradient(
          colors: [
            const Color(0xFF10B981).withValues(alpha: 0.8),
            AppColors.cyanPrimary.withValues(alpha: 0.9),
            const Color(0xFF0284C7).withValues(alpha: 0.8),
          ],
        ).createShader(pipeRect.outerRect)
        ..style = PaintingStyle.fill;

      canvas.drawRRect(pipeRect, waterStreamPaint);

      // Liquid Pulses along conduit
      final pulsePaint = Paint()..color = Colors.white.withValues(alpha: 0.75);
      for (final p in pulses) {
        p.update(0.025);
        final px = startX + (endX - startX) * p.progress;
        canvas.drawCircle(Offset(px, startY), p.size, pulsePaint);
      }

      // Chevron Flow Direction Indicator
      final chevronPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.85)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0
        ..strokeCap = StrokeCap.round;

      final arrowX = startX + (endX - startX) * ((flowProgress * 2) % 1.0);
      final arrowPath = Path();
      arrowPath.moveTo(arrowX - 4, startY - 4);
      arrowPath.lineTo(arrowX + 2, startY);
      arrowPath.lineTo(arrowX - 4, startY + 4);
      canvas.drawPath(arrowPath, chevronPaint);
    }

    // 3. Pipe Glass Rim Outline
    final pipeBorder = Paint()
      ..color = isRunning
          ? AppColors.cyanPrimary.withValues(alpha: 0.6)
          : (isDarkMode ? AppColors.darkBorder : const Color(0xFFCBD5E1))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6;
    canvas.drawRRect(pipeRect, pipeBorder);
  }

  @override
  bool shouldRepaint(covariant _ConduitFlowPainter oldDelegate) {
    return oldDelegate.flowProgress != flowProgress ||
        oldDelegate.isRunning != isRunning ||
        oldDelegate.isDarkMode != isDarkMode;
  }
}

// =========================================================================
// 3. HIGH-FIDELITY TANK PAINTER (VOLUMETRIC LIQUID DYNAMICS & WATERFALL)
// =========================================================================
class _StageBubble {
  double x;
  double y;
  final double size;
  final double speed;
  final double wobbleSpeed;

  _StageBubble({
    required this.x,
    required this.y,
    required this.size,
    required this.speed,
    required this.wobbleSpeed,
  });

  void update(double delta) {
    y -= speed * delta;
    if (y < 0) {
      y = 1.0;
      x = 0.15 + math.Random().nextDouble() * 0.7;
    }
  }
}

class _HighFidelityTankPainter extends CustomPainter {
  final double waveValue;
  final double tankLevelPct;
  final double flowRateLpm;
  final bool isRunning;
  final bool isDarkMode;
  final List<_StageBubble> bubbles;

  _HighFidelityTankPainter({
    required this.waveValue,
    required this.tankLevelPct,
    required this.flowRateLpm,
    required this.isRunning,
    required this.isDarkMode,
    required this.bubbles,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const padX = 14.0;
    const padY = 12.0;
    final tankW = size.width - (padX * 2);
    final tankH = size.height - (padY * 2);

    final tankRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(padX, padY, tankW, tankH),
      const Radius.circular(20),
    );

    // 1. Ambient Glass Glow
    if (isRunning) {
      final glowPaint = Paint()
        ..color = AppColors.cyanPrimary.withValues(alpha: 0.25)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14);
      canvas.drawRRect(tankRRect, glowPaint);
    }

    // 2. Tank Interior Glass Background
    final interiorPaint = Paint()
      ..color = isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9)
      ..style = PaintingStyle.fill;
    canvas.drawRRect(tankRRect, interiorPaint);

    // 3. Compute Water Height & Top Surface
    final waterLevelFraction = (tankLevelPct / 100.0).clamp(0.0, 1.0);
    final maxWaterH = tankH - 6;
    final waterH = maxWaterH * waterLevelFraction;
    final waterTop = (padY + tankH - 3) - waterH;

    canvas.save();
    canvas.clipRRect(tankRRect);

    // 4. Fluid Harmonic Waves (Dual Layer)
    if (tankLevelPct > 1.0) {
      final waveAmp = isRunning ? 5.5 : 2.0;

      // Deep Back Wave
      final backWave = Path();
      backWave.moveTo(padX, padY + tankH);
      backWave.lineTo(padX + tankW, padY + tankH);
      backWave.lineTo(padX + tankW, waterTop);

      for (double x = padX + tankW; x >= padX; x -= 2) {
        final rel = (x - padX) / tankW;
        final y = waterTop + math.sin((rel * 2 * math.pi) + (waveValue * 2 * math.pi) + math.pi) * (waveAmp * 0.7);
        backWave.lineTo(x, y);
      }
      backWave.close();

      final backWavePaint = Paint()
        ..color = (isDarkMode ? AppColors.blueElectric : const Color(0xFF2563EB)).withValues(alpha: 0.4)
        ..style = PaintingStyle.fill;
      canvas.drawPath(backWave, backWavePaint);

      // Foreground Wave with Rich Electric Aqua Gradient
      final frontWave = Path();
      frontWave.moveTo(padX, padY + tankH);
      frontWave.lineTo(padX + tankW, padY + tankH);
      frontWave.lineTo(padX + tankW, waterTop);

      for (double x = padX + tankW; x >= padX; x -= 2) {
        final rel = (x - padX) / tankW;
        final y = waterTop + math.sin((rel * 2 * math.pi) + (waveValue * 2 * math.pi)) * waveAmp;
        frontWave.lineTo(x, y);
      }
      frontWave.close();

      final waterGradient = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: isDarkMode
            ? [
                AppColors.cyanPrimary.withValues(alpha: 0.9),
                const Color(0xFF0284C7).withValues(alpha: 0.92),
                const Color(0xFF0369A1).withValues(alpha: 0.98),
              ]
            : [
                const Color(0xFF38BDF8).withValues(alpha: 0.88),
                const Color(0xFF0284C7).withValues(alpha: 0.92),
                const Color(0xFF1D4ED8).withValues(alpha: 0.98),
              ],
      );

      final frontWavePaint = Paint()
        ..shader = waterGradient.createShader(Rect.fromLTWH(padX, waterTop, tankW, waterH))
        ..style = PaintingStyle.fill;
      canvas.drawPath(frontWave, frontWavePaint);

      // Surface Crest Highlight Line
      final crestPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;
      canvas.drawPath(frontWave, crestPaint);

      // Floating Aeration Micro-Bubbles
      final bubblePaint = Paint()..color = Colors.white.withValues(alpha: 0.5);
      for (final b in bubbles) {
        b.update(0.018);
        final by = (padY + tankH - 6) - (b.y * waterH);
        if (by > waterTop) {
          final bx = padX + (b.x * tankW) + math.sin(waveValue * b.wobbleSpeed * 2 * math.pi) * 2.5;
          canvas.drawCircle(Offset(bx, by), b.size, bubblePaint);
        }
      }
    }

    // 5. Inflow Waterfall Stream from the overhead pipe (When Running)
    if (isRunning && flowRateLpm > 0.5) {
      final streamX = padX + (tankW * 0.35);
      final streamPaint = Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.cyanPrimary, Color(0xFF38BDF8), Colors.transparent],
        ).createShader(Rect.fromLTWH(streamX - 2.5, padY, 5, tankH))
        ..strokeWidth = 4.0
        ..strokeCap = StrokeCap.round;

      canvas.drawLine(
        Offset(streamX, padY),
        Offset(streamX, math.max(waterTop + 6, padY + 12)),
        streamPaint,
      );

      // Splash ripples at water surface contact point
      if (waterTop > padY + 12) {
        final ripplePaint = Paint()
          ..color = Colors.white.withValues(alpha: 0.8)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5;
        canvas.drawOval(
          Rect.fromCenter(center: Offset(streamX, waterTop + 2), width: 16, height: 5),
          ripplePaint,
        );
      }
    }

    // 6. Cylindrical Glass Specular Reflection Highlight (Left Curved Edge)
    final reflectionPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          Colors.white.withValues(alpha: isDarkMode ? 0.25 : 0.4),
          Colors.transparent,
        ],
      ).createShader(Rect.fromLTWH(padX + 2, padY + 4, 12, tankH - 8));

    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(padX + 3, padY + 5, 8, tankH - 10), const Radius.circular(6)),
      reflectionPaint,
    );

    canvas.restore();

    // 7. Outer Acrylic Tank Frame
    final tankBorder = Paint()
      ..color = isDarkMode ? AppColors.darkBorder : const Color(0xFFCBD5E1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;
    canvas.drawRRect(tankRRect, tankBorder);

    // 8. Laser Graduation Scale (Right Edge)
    final tickPaint = Paint()
      ..color = isDarkMode ? const Color(0xFF64748B) : const Color(0xFF94A3B8)
      ..strokeWidth = 1.2;

    for (int p = 0; p <= 100; p += 25) {
      final ty = (padY + tankH - 3) - (maxWaterH * (p / 100.0));
      final isMajor = p == 0 || p == 50 || p == 100;
      final tLen = isMajor ? 8.0 : 4.0;
      canvas.drawLine(
        Offset(padX + tankW - 3, ty),
        Offset(padX + tankW - 3 - tLen, ty),
        tickPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _HighFidelityTankPainter oldDelegate) {
    return oldDelegate.waveValue != waveValue ||
        oldDelegate.tankLevelPct != tankLevelPct ||
        oldDelegate.isRunning != isRunning ||
        oldDelegate.flowRateLpm != flowRateLpm ||
        oldDelegate.isDarkMode != isDarkMode;
  }
}
