import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';

class TankPumpFlowCanvas extends StatefulWidget {
  final bool isRunning;
  final bool isStarting;
  final int motorRpm;
  final double tankLevelPct;
  final double flowRateLpm;
  final bool isDarkMode;
  final VoidCallback? onTogglePump;

  const TankPumpFlowCanvas({
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
  State<TankPumpFlowCanvas> createState() => _TankPumpFlowCanvasState();
}

class _TankPumpFlowCanvasState extends State<TankPumpFlowCanvas> with TickerProviderStateMixin {
  late AnimationController _flowController;
  late AnimationController _rotationController;
  final List<_TravelingPulse> _travelingPulses = [];
  final List<_TankBubble> _tankBubbles = [];
  final math.Random _random = math.Random();

  @override
  void initState() {
    super.initState();

    // 1. Water travel & wave animation controller
    _flowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();

    // 2. Motor impeller rotation controller
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat();

    // Traveling water particles inside the overhead conduit
    for (int i = 0; i < 9; i++) {
      _travelingPulses.add(_TravelingPulse(
        progress: i / 9.0,
        size: 2.8 + _random.nextDouble() * 2.2,
      ));
    }

    // Ambient tank bubbles
    for (int i = 0; i < 20; i++) {
      _tankBubbles.add(_TankBubble(
        x: 0.10 + _random.nextDouble() * 0.8,
        y: _random.nextDouble(),
        size: 1.8 + _random.nextDouble() * 2.8,
        speed: 0.15 + _random.nextDouble() * 0.35,
        wobbleSpeed: 2.0 + _random.nextDouble() * 3.0,
      ));
    }
  }

  @override
  void dispose() {
    _flowController.dispose();
    _rotationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        const height = 205.0;

        return GestureDetector(
          onTap: widget.onTogglePump,
          child: AnimatedBuilder(
            animation: Listenable.merge([_flowController, _rotationController]),
            builder: (context, child) {
              return SizedBox(
                width: width,
                height: height,
                child: CustomPaint(
                  size: Size(width, height),
                  painter: _TankPumpFlowPainter(
                    flowProgress: _flowController.value,
                    rotationProgress: _rotationController.value,
                    isRunning: widget.isRunning,
                    isStarting: widget.isStarting,
                    motorRpm: widget.motorRpm,
                    tankLevelPct: widget.tankLevelPct,
                    flowRateLpm: widget.flowRateLpm,
                    isDarkMode: widget.isDarkMode,
                    pulses: _travelingPulses,
                    bubbles: _tankBubbles,
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _TravelingPulse {
  double progress;
  double size;

  _TravelingPulse({required this.progress, required this.size});

  void update(double delta) {
    progress += delta;
    if (progress > 1.0) progress -= 1.0;
  }
}

class _TankBubble {
  double x;
  double y;
  double size;
  double speed;
  double wobbleSpeed;

  _TankBubble({
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
      x = 0.10 + math.Random().nextDouble() * 0.8;
    }
  }
}

class _TankPumpFlowPainter extends CustomPainter {
  final double flowProgress;
  final double rotationProgress;
  final bool isRunning;
  final bool isStarting;
  final int motorRpm;
  final double tankLevelPct;
  final double flowRateLpm;
  final bool isDarkMode;
  final List<_TravelingPulse> pulses;
  final List<_TankBubble> bubbles;

  _TankPumpFlowPainter({
    required this.flowProgress,
    required this.rotationProgress,
    required this.isRunning,
    required this.isStarting,
    required this.motorRpm,
    required this.tankLevelPct,
    required this.flowRateLpm,
    required this.isDarkMode,
    required this.pulses,
    required this.bubbles,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;

    // =========================================================================
    // 1. DIMENSIONS & PROPORTIONS:
    //    - FIRST: TANK IS BIG (Left side ~54% of width)
    //    - MOTOR IS SMALL (Right side, compact radius ~24)
    //    - PIPE: Connects from motor discharge up and enters from TOP of tank
    // =========================================================================
    final tankW = width * 0.54;
    const tankLeft = 14.0;
    const tankTop = 32.0;
    final tankH = height - 58.0;

    const motorRadius = 24.0;
    final motorCenterX = width - 42.0;
    final motorCenterY = height * 0.62;

    // Inlet on top of tank (65% across the tank width)
    final tankInletX = tankLeft + (tankW * 0.65);
    const pipeTopY = 14.0;
    final motorDischargeX = motorCenterX - 4.0;
    final motorDischargeY = motorCenterY - motorRadius;

    // 1. Draw connecting pipe from motor up to top of tank
    _drawOverheadConnectingPipe(
      canvas,
      motorDischargeX: motorDischargeX,
      motorDischargeY: motorDischargeY,
      pipeTopY: pipeTopY,
      tankInletX: tankInletX,
      tankInletY: tankTop + 4.0,
      pipeThickness: 13.0,
    );

    // 2. Draw Big Volumetric Water Tank (Left Side)
    _drawBigWaterTank(
      canvas,
      tankLeft,
      tankTop,
      tankW,
      tankH,
      tankInletX,
    );

    // 3. Draw Compact Small Motor Unit (Right Side)
    _drawSmallMotorUnit(
      canvas,
      motorCenterX,
      motorCenterY,
      motorRadius,
    );

    // 4. Draw Telemetry Labels underneath
    _drawTelemetryLabels(canvas, tankLeft + (tankW / 2), motorCenterX, width, height);
  }

  /// Draws the conduit pipe routing from small motor up, across, and down into the TOP of the big tank
  void _drawOverheadConnectingPipe(
    Canvas canvas, {
    required double motorDischargeX,
    required double motorDischargeY,
    required double pipeTopY,
    required double tankInletX,
    required double tankInletY,
    required double pipeThickness,
  }) {
    // Pipe centerline path:
    // Motor discharge -> up to (motorDischargeX, pipeTopY) -> left to (tankInletX, pipeTopY) -> down into tank (tankInletX, tankInletY)
    final centerlinePath = Path();
    centerlinePath.moveTo(motorDischargeX, motorDischargeY);
    centerlinePath.lineTo(motorDischargeX, pipeTopY + 8.0);
    // Smooth top-right elbow bend
    centerlinePath.quadraticBezierTo(motorDischargeX, pipeTopY, motorDischargeX - 8.0, pipeTopY);
    // Horizontal run
    centerlinePath.lineTo(tankInletX + 8.0, pipeTopY);
    // Smooth top-left elbow bend into tank
    centerlinePath.quadraticBezierTo(tankInletX, pipeTopY, tankInletX, pipeTopY + 8.0);
    // Vertical run down into tank top
    centerlinePath.lineTo(tankInletX, tankInletY);

    // 1. Outer Pipe Conduit Casing
    final pipeBgPaint = Paint()
      ..color = (isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0)).withValues(alpha: 0.85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = pipeThickness
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(centerlinePath, pipeBgPaint);

    // 2. Water Stream traveling inside pipe
    if (isRunning) {
      final waterGlow = Paint()
        ..color = AppColors.cyanPrimary.withValues(alpha: 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = pipeThickness + 3.0
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
      canvas.drawPath(centerlinePath, waterGlow);

      final waterStreamPaint = Paint()
        ..shader = const LinearGradient(
          colors: [
            Color(0xFF10B981),
            AppColors.cyanPrimary,
            Color(0xFF0284C7),
          ],
        ).createShader(Rect.fromLTRB(tankInletX - 10, pipeTopY - 10, motorDischargeX + 10, motorDischargeY + 10))
        ..style = PaintingStyle.stroke
        ..strokeWidth = pipeThickness - 2.8
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      canvas.drawPath(centerlinePath, waterStreamPaint);

      // Traveling Fluid Pulses / Droplets along the path metrics
      final pathMetrics = centerlinePath.computeMetrics().toList();
      if (pathMetrics.isNotEmpty) {
        final metric = pathMetrics.first;
        final totalLen = metric.length;

        final pulsePaint = Paint()..color = Colors.white.withValues(alpha: 0.9);
        for (final p in pulses) {
          p.update(0.028);
          // Flow direction: motor discharge (distance 0) -> tank inlet (distance totalLen)
          final dist = p.progress * totalLen;
          final tangent = metric.getTangentForOffset(dist);
          if (tangent != null) {
            canvas.drawCircle(tangent.position, p.size, pulsePaint);
          }
        }

        // Directional Chevrons along pipe showing flow direction
        final chevronPaint = Paint()
          ..color = Colors.white.withValues(alpha: 0.95)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.0
          ..strokeCap = StrokeCap.round;

        for (int i = 0; i < 4; i++) {
          final frac = (flowProgress + (i * 0.25)) % 1.0;
          final dist = frac * totalLen;
          final tangent = metric.getTangentForOffset(dist);
          if (tangent != null) {
            final pos = tangent.position;
            final angle = tangent.angle;
            canvas.save();
            canvas.translate(pos.dx, pos.dy);
            canvas.rotate(angle);
            final arrow = Path();
            arrow.moveTo(-3, -3.5);
            arrow.lineTo(3, 0);
            arrow.lineTo(-3, 3.5);
            canvas.drawPath(arrow, chevronPaint);
            canvas.restore();
          }
        }
      }
    }

    // 3. Pipe Outer Metallic Border
    final pipeBorder = Paint()
      ..color = isRunning
          ? AppColors.cyanPrimary.withValues(alpha: 0.8)
          : (isDarkMode ? AppColors.darkBorder : const Color(0xFF94A3B8))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(centerlinePath, pipeBorder);

    // Flange coupling at tank inlet
    final flangePaint = Paint()
      ..color = isDarkMode ? const Color(0xFF64748B) : const Color(0xFF94A3B8)
      ..style = PaintingStyle.fill;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(tankInletX - 9, tankInletY - 5, 18, 6),
        const Radius.circular(2),
      ),
      flangePaint,
    );
  }

  /// Draws the Big Acrylic Tank on the Left Side
  void _drawBigWaterTank(
    Canvas canvas,
    double left,
    double top,
    double width,
    double height,
    double inletX,
  ) {
    final tankRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(left, top, width, height),
      const Radius.circular(18),
    );

    // 1. Tank Glow
    if (isRunning) {
      final glowPaint = Paint()
        ..color = AppColors.cyanPrimary.withValues(alpha: 0.22)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14);
      canvas.drawRRect(tankRRect, glowPaint);
    }

    // 2. Interior Glass Backdrop
    final interiorPaint = Paint()
      ..color = isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC)
      ..style = PaintingStyle.fill;
    canvas.drawRRect(tankRRect, interiorPaint);

    // 3. Water Volume & Level Computation
    final waterLevelFraction = (tankLevelPct / 100.0).clamp(0.0, 1.0);
    final maxWaterH = height - 6;
    final waterH = maxWaterH * waterLevelFraction;
    final waterTop = (top + height - 3) - waterH;

    canvas.save();
    canvas.clipRRect(tankRRect);

    // 4. Water Wave Surface & Fluid Volume
    if (tankLevelPct > 1.0) {
      final waveAmp = isRunning ? 4.5 : 1.8;

      final wavePath = Path();
      wavePath.moveTo(left, top + height);
      wavePath.lineTo(left + width, top + height);
      wavePath.lineTo(left + width, waterTop);

      for (double x = left + width; x >= left; x -= 2) {
        final rel = (x - left) / width;
        final y = waterTop + math.sin((rel * 2 * math.pi) + (flowProgress * 2 * math.pi)) * waveAmp;
        wavePath.lineTo(x, y);
      }
      wavePath.close();

      final waterGradient = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: isDarkMode
            ? [
                AppColors.cyanPrimary.withValues(alpha: 0.92),
                const Color(0xFF0284C7).withValues(alpha: 0.95),
                const Color(0xFF0369A1).withValues(alpha: 0.98),
              ]
            : [
                const Color(0xFF38BDF8).withValues(alpha: 0.88),
                const Color(0xFF0284C7).withValues(alpha: 0.94),
                const Color(0xFF1D4ED8).withValues(alpha: 0.98),
              ],
      );

      final waterPaint = Paint()
        ..shader = waterGradient.createShader(Rect.fromLTWH(left, waterTop, width, waterH))
        ..style = PaintingStyle.fill;
      canvas.drawPath(wavePath, waterPaint);

      // Crest line
      final crestPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.8)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;
      canvas.drawPath(wavePath, crestPaint);

      // Bubbles floating inside the reservoir
      final bubblePaint = Paint()..color = Colors.white.withValues(alpha: 0.5);
      for (final b in bubbles) {
        b.update(0.018);
        final by = (top + height - 4) - (b.y * waterH);
        if (by > waterTop) {
          final bx = left + (b.x * width) + math.sin(flowProgress * b.wobbleSpeed * 2 * math.pi) * 2;
          canvas.drawCircle(Offset(bx, by), b.size, bubblePaint);
        }
      }
    }

    // 5. WATER POURING DOWN FROM TOP OF TANK (When Pump is Running)
    if (isRunning && flowRateLpm > 0.5) {
      final cascadePaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.cyanPrimary,
            const Color(0xFF38BDF8),
            Colors.white.withValues(alpha: 0.9),
          ],
        ).createShader(Rect.fromLTWH(inletX - 4, top, 8, math.max(10, waterTop - top)))
        ..strokeWidth = 4.5
        ..strokeCap = StrokeCap.round;

      // Vertical waterfall pouring into the tank
      canvas.drawLine(
        Offset(inletX, top + 2),
        Offset(inletX, math.max(waterTop + 4, top + 14)),
        cascadePaint,
      );

      // Secondary fine stream
      final subStreamPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.75)
        ..strokeWidth = 2.0
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(
        Offset(inletX + 3, top + 6),
        Offset(inletX + 2, math.max(waterTop + 2, top + 16)),
        subStreamPaint,
      );

      // Splash ripples at contact point with water surface
      if (waterTop > top + 10) {
        final ripplePaint = Paint()
          ..color = Colors.white.withValues(alpha: 0.85)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6;
        canvas.drawOval(
          Rect.fromCenter(center: Offset(inletX, waterTop + 2), width: 22, height: 6),
          ripplePaint,
        );
        canvas.drawOval(
          Rect.fromCenter(center: Offset(inletX, waterTop + 3), width: 12, height: 3.5),
          ripplePaint,
        );
      }
    }

    // 6. Cylindrical Glass Specular Highlight (Left Edge)
    final reflectionPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [Colors.white.withValues(alpha: isDarkMode ? 0.22 : 0.35), Colors.transparent],
      ).createShader(Rect.fromLTWH(left + 2, top + 4, 14, height - 8));
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(left + 2, top + 4, 8, height - 8), const Radius.circular(6)), reflectionPaint);

    canvas.restore();

    // 7. Tank Glass Border
    final tankBorder = Paint()
      ..color = isDarkMode ? AppColors.darkBorder : const Color(0xFFCBD5E1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;
    canvas.drawRRect(tankRRect, tankBorder);

    // 8. Laser Measurement Scale on Right Edge (0%, 25%, 50%, 75%, 100%)
    final tickPaint = Paint()
      ..color = isDarkMode ? const Color(0xFF64748B) : const Color(0xFF94A3B8)
      ..strokeWidth = 1.3;

    for (int p = 0; p <= 100; p += 25) {
      final ty = (top + height - 3) - (maxWaterH * (p / 100.0));
      final isMajor = p == 0 || p == 50 || p == 100;
      final tLen = isMajor ? 8.0 : 4.5;
      canvas.drawLine(Offset(left + width - 2, ty), Offset(left + width - 2 - tLen, ty), tickPaint);
    }
  }

  /// Draws the Compact Small Motor Unit on the Right Side
  void _drawSmallMotorUnit(
    Canvas canvas,
    double cx,
    double cy,
    double radius,
  ) {
    final center = Offset(cx, cy);

    // 1. Motor Stator Base & Cooling Fins (Behind Motor)
    final finPaint = Paint()
      ..color = isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1)
      ..strokeWidth = 2.5;

    for (int i = -2; i <= 2; i++) {
      final fy = cy + (i * 6);
      canvas.drawLine(Offset(cx - radius - 5, fy), Offset(cx - radius + 2, fy), finPaint);
    }

    // Suction Inlet Pipe (Bottom)
    final inletPaint = Paint()
      ..color = isDarkMode ? const Color(0xFF475569) : const Color(0xFF94A3B8)
      ..style = PaintingStyle.fill;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(cx - 5, cy + radius - 3, 10, 12), const Radius.circular(2)), inletPaint);

    // 2. Outer Volute Casing with Metallic Shading
    final glowPaint = Paint()
      ..color = isRunning ? AppColors.emeraldSuccess.withValues(alpha: 0.35) : Colors.transparent
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10);
    canvas.drawCircle(center, radius + 2, glowPaint);

    final casingPaint = Paint()
      ..shader = SweepGradient(
        colors: isRunning
            ? [
                const Color(0xFF10B981),
                const Color(0xFF047857),
                const Color(0xFF34D399),
                const Color(0xFF065F46),
                const Color(0xFF10B981),
              ]
            : [
                isDarkMode ? const Color(0xFF475569) : const Color(0xFF94A3B8),
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                isDarkMode ? const Color(0xFF475569) : const Color(0xFF94A3B8),
              ],
        transform: GradientRotation(rotationProgress * 2 * math.pi),
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.8;
    canvas.drawCircle(center, radius, casingPaint);

    // Chamber background
    final chamberBg = Paint()
      ..color = isRunning
          ? (isDarkMode ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5))
          : (isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9))
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius - 2.5, chamberBg);

    // 3. Rotating Impeller Vanes
    final vaneAngle = isRunning ? (rotationProgress * 2 * math.pi * 3.0) : 0.0;
    final vanePaint = Paint()
      ..shader = LinearGradient(
        colors: isRunning
            ? [const Color(0xFF6EE7B7), const Color(0xFF059669)]
            : [isDarkMode ? const Color(0xFF64748B) : const Color(0xFF94A3B8), isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1)],
      ).createShader(Rect.fromCircle(center: center, radius: radius * 0.75))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;

    for (int i = 0; i < 4; i++) {
      final a = vaneAngle + (i * math.pi / 2);
      final r1 = radius * 0.22;
      final r2 = radius * 0.72;
      canvas.drawLine(
        Offset(cx + r1 * math.cos(a), cy + r1 * math.sin(a)),
        Offset(cx + r2 * math.cos(a + 0.3), cy + r2 * math.sin(a + 0.3)),
        vanePaint,
      );
    }

    // 4. Center Bearing Hub
    final hubRadius = radius * 0.32;
    final hubPaint = Paint()
      ..color = isRunning ? const Color(0xFF059669) : (isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1))
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, hubRadius, hubPaint);

    // Power Icon in Center
    final iconPaint = Paint()
      ..color = isRunning ? Colors.white : (isDarkMode ? Colors.white60 : Colors.black54)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(Rect.fromCircle(center: center, radius: 4.5), -math.pi * 0.7, math.pi * 1.4, false, iconPaint);
    canvas.drawLine(Offset(cx, cy - 5), Offset(cx, cy - 1), iconPaint);
  }

  void _drawTelemetryLabels(Canvas canvas, double tankX, double motorX, double width, double height) {
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    // Tank Label (Under Big Tank on the left)
    final tankStyle = GoogleFonts.plusJakartaSans(
      fontSize: 10.5,
      fontWeight: FontWeight.w800,
      color: isDarkMode ? AppColors.cyanPrimary : AppColors.blueElectric,
    );
    textPainter.text = TextSpan(
      text: 'TANK: ${tankLevelPct.toInt()}% (${(tankLevelPct * 10).toInt()}L)',
      style: tankStyle,
    );
    textPainter.layout();
    final tankLabelX = (tankX - (textPainter.width / 2)).clamp(4.0, width - textPainter.width - 4.0);
    textPainter.paint(canvas, Offset(tankLabelX, height - 20));

    // Motor Label (Under Small Motor on the right)
    final motorStyle = GoogleFonts.plusJakartaSans(
      fontSize: 10,
      fontWeight: FontWeight.w700,
      color: isRunning
          ? (isDarkMode ? AppColors.emeraldSuccess : const Color(0xFF059669))
          : (isDarkMode ? Colors.white60 : Colors.black54),
    );
    textPainter.text = TextSpan(
      text: isRunning ? '$motorRpm RPM' : 'MOTOR OFF',
      style: motorStyle,
    );
    textPainter.layout();
    final motorLabelX = (motorX - (textPainter.width / 2)).clamp(4.0, width - textPainter.width - 4.0);
    textPainter.paint(canvas, Offset(motorLabelX, height - 20));
  }

  @override
  bool shouldRepaint(covariant _TankPumpFlowPainter oldDelegate) {
    return oldDelegate.flowProgress != flowProgress ||
        oldDelegate.rotationProgress != rotationProgress ||
        oldDelegate.isRunning != isRunning ||
        oldDelegate.isStarting != isStarting ||
        oldDelegate.tankLevelPct != tankLevelPct ||
        oldDelegate.flowRateLpm != flowRateLpm ||
        oldDelegate.isDarkMode != isDarkMode;
  }
}
