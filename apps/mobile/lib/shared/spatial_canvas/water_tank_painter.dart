import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class WaterTankCanvas extends StatefulWidget {
  final double tankLevelPct; // 0.0 to 100.0
  final double flowRateLpm;
  final bool isPumpRunning;
  final double height;
  final double width;
  final bool isDarkMode;

  const WaterTankCanvas({
    super.key,
    required this.tankLevelPct,
    required this.flowRateLpm,
    required this.isPumpRunning,
    this.height = 270,
    this.width = 200,
    this.isDarkMode = true,
  });

  @override
  State<WaterTankCanvas> createState() => _WaterTankCanvasState();
}

class _WaterTankCanvasState extends State<WaterTankCanvas> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<_Bubble> _bubbles = [];
  final math.Random _random = math.Random();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat();

    // Generate random ambient bubbles
    for (int i = 0; i < 15; i++) {
      _bubbles.add(_Bubble(
        x: _random.nextDouble(),
        y: _random.nextDouble(),
        size: 2.0 + _random.nextDouble() * 3.5,
        speed: 0.15 + _random.nextDouble() * 0.35,
        wobbleSpeed: 2.0 + _random.nextDouble() * 3.0,
      ));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          size: Size(widget.width, widget.height),
          painter: _VolumetricTankPainter(
            animationValue: _controller.value,
            tankLevelPct: widget.tankLevelPct.clamp(0.0, 100.0),
            flowRateLpm: widget.flowRateLpm,
            isPumpRunning: widget.isPumpRunning,
            isDarkMode: widget.isDarkMode,
            bubbles: _bubbles,
          ),
        );
      },
    );
  }
}

class _Bubble {
  double x;
  double y;
  final double size;
  final double speed;
  final double wobbleSpeed;

  _Bubble({
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

class _VolumetricTankPainter extends CustomPainter {
  final double animationValue;
  final double tankLevelPct;
  final double flowRateLpm;
  final bool isPumpRunning;
  final bool isDarkMode;
  final List<_Bubble> bubbles;

  _VolumetricTankPainter({
    required this.animationValue,
    required this.tankLevelPct,
    required this.flowRateLpm,
    required this.isPumpRunning,
    required this.isDarkMode,
    required this.bubbles,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const padX = 28.0;
    const padY = 24.0;
    final tankW = size.width - (padX * 2);
    final tankH = size.height - (padY * 2);

    final tankRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(padX, padY, tankW, tankH),
      const Radius.circular(24),
    );

    // 1. Draw Outer Glass Housing with Soft Ambient Glow
    final glowPaint = Paint()
      ..color = isPumpRunning
          ? AppColors.cyanPrimary.withValues(alpha: isDarkMode ? 0.15 : 0.25)
          : Colors.transparent
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);
    canvas.drawRRect(tankRect, glowPaint);

    final bgFill = Paint()
      ..color = isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0)
      ..style = PaintingStyle.fill;
    canvas.drawRRect(tankRect, bgFill);

    // 2. Compute Water Height
    final waterLevelFraction = tankLevelPct / 100.0;
    final maxWaterHeight = tankH - 8;
    final waterHeight = maxWaterHeight * waterLevelFraction;
    final waterTop = (padY + tankH - 4) - waterHeight;

    canvas.save();
    canvas.clipRRect(tankRect);

    // 3. Draw Water Waves & Volumetric Depth
    if (tankLevelPct > 0.5) {
      final waveAmp = isPumpRunning ? 6.0 : 2.5;

      // --- Deep Back Wave Layer ---
      final backWavePath = Path();
      backWavePath.moveTo(padX, padY + tankH);
      backWavePath.lineTo(padX + tankW, padY + tankH);
      backWavePath.lineTo(padX + tankW, waterTop);

      for (double x = padX + tankW; x >= padX; x -= 3) {
        final relX = (x - padX) / tankW;
        final y = waterTop + math.sin((relX * 2 * math.pi) + (animationValue * 2 * math.pi) + math.pi) * (waveAmp * 0.7);
        backWavePath.lineTo(x, y);
      }
      backWavePath.close();

      final backWavePaint = Paint()
        ..color = (isDarkMode ? AppColors.blueElectric : const Color(0xFF2563EB)).withValues(alpha: 0.45)
        ..style = PaintingStyle.fill;
      canvas.drawPath(backWavePath, backWavePaint);

      // --- Main Foreground Wave Layer ---
      final frontWavePath = Path();
      frontWavePath.moveTo(padX, padY + tankH);
      frontWavePath.lineTo(padX + tankW, padY + tankH);
      frontWavePath.lineTo(padX + tankW, waterTop);

      for (double x = padX + tankW; x >= padX; x -= 3) {
        final relX = (x - padX) / tankW;
        final y = waterTop + math.sin((relX * 2 * math.pi) + (animationValue * 2 * math.pi)) * waveAmp;
        frontWavePath.lineTo(x, y);
      }
      frontWavePath.close();

      final waterGradient = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: isDarkMode
            ? [
                AppColors.cyanPrimary.withValues(alpha: 0.85),
                const Color(0xFF0072FF).withValues(alpha: 0.95),
              ]
            : [
                const Color(0xFF0284C7).withValues(alpha: 0.85),
                const Color(0xFF1D4ED8).withValues(alpha: 0.95),
              ],
      );

      final frontWavePaint = Paint()
        ..shader = waterGradient.createShader(Rect.fromLTWH(padX, waterTop, tankW, waterHeight))
        ..style = PaintingStyle.fill;
      canvas.drawPath(frontWavePath, frontWavePaint);

      // --- Animated Floating Micro-Bubbles ---
      final bubblePaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.45)
        ..style = PaintingStyle.fill;

      for (final bubble in bubbles) {
        bubble.update(0.015);
        final bubbleY = (padY + tankH - 8) - (bubble.y * waterHeight);
        if (bubbleY > waterTop) {
          final wobble = math.sin(animationValue * bubble.wobbleSpeed * 2 * math.pi) * 3;
          final bubbleX = padX + (bubble.x * tankW) + wobble;
          canvas.drawCircle(Offset(bubbleX, bubbleY), bubble.size, bubblePaint);
        }
      }

      // --- Wave Surface Crest Neon Highlight ---
      final crestPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.65)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;
      canvas.drawPath(frontWavePath, crestPaint);
    }

    // 4. Inflow Water Stream from top pipe
    if (isPumpRunning && flowRateLpm > 0.5) {
      final streamX = padX + (tankW / 2);
      final streamPaint = Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.cyanPrimary, Colors.transparent],
        ).createShader(Rect.fromLTWH(streamX - 3, padY, 6, tankH))
        ..strokeWidth = 4.5
        ..strokeCap = StrokeCap.round;

      canvas.drawLine(
        Offset(streamX, padY),
        Offset(streamX, math.max(waterTop + 8, padY + 12)),
        streamPaint,
      );

      // Splash ripples at point of contact
      if (waterTop > padY + 10) {
        final ripplePaint = Paint()
          ..color = AppColors.cyanPrimary.withValues(alpha: 0.6)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5;
        canvas.drawOval(
          Rect.fromCenter(center: Offset(streamX, waterTop + 2), width: 18, height: 6),
          ripplePaint,
        );
      }
    }

    // 5. Specular Vertical Glass Reflection on Left Flank
    final reflectionPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          Colors.white.withValues(alpha: isDarkMode ? 0.20 : 0.35),
          Colors.transparent,
        ],
      ).createShader(Rect.fromLTWH(padX + 4, padY + 4, 18, tankH - 8));
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(padX + 4, padY + 6, 12, tankH - 12), const Radius.circular(8)),
      reflectionPaint,
    );

    canvas.restore();

    // 6. Modern Glass Cylinder Outline
    final tankBorder = Paint()
      ..color = isDarkMode ? AppColors.darkBorder : const Color(0xFFCBD5E1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawRRect(tankRect, tankBorder);

    // 7. Futuristic Laser Measurement Scale on Right Side
    final tickPaint = Paint()
      ..color = isDarkMode ? const Color(0xFF64748B) : const Color(0xFF94A3B8)
      ..strokeWidth = 1.5;

    final tickTextPainter = TextPainter(textDirection: TextDirection.ltr);

    for (int p = 0; p <= 100; p += 25) {
      final tickY = (padY + tankH - 4) - (maxWaterHeight * (p / 100.0));
      final isMajor = p == 0 || p == 50 || p == 100;
      final tickLen = isMajor ? 10.0 : 6.0;

      canvas.drawLine(
        Offset(padX + tankW - 4, tickY),
        Offset(padX + tankW - 4 - tickLen, tickY),
        tickPaint,
      );

      if (isMajor) {
        tickTextPainter.text = TextSpan(
          text: '$p%',
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: isDarkMode ? const Color(0xFF64748B) : const Color(0xFF64748B),
          ),
        );
        tickTextPainter.layout();
        tickTextPainter.paint(canvas, Offset(padX + tankW + 6, tickY - 6));
      }
    }

    // 8. Centrifugal Motor Impeller at Bottom
    final motorCenter = Offset(padX + 22, padY + tankH - 22);
    final motorRadius = 14.0;

    final motorBackdrop = Paint()
      ..color = (isDarkMode ? const Color(0xFF0F172A) : Colors.white).withValues(alpha: 0.9)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(motorCenter, motorRadius + 3, motorBackdrop);

    final motorBorder = Paint()
      ..color = isPumpRunning ? AppColors.cyanPrimary : (isDarkMode ? AppColors.darkBorder : AppColors.lightBorder)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawCircle(motorCenter, motorRadius, motorBorder);

    if (isPumpRunning) {
      final halo = Paint()
        ..color = AppColors.cyanPrimary.withValues(alpha: 0.35)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
      canvas.drawCircle(motorCenter, motorRadius, halo);
    }

    // Blades rotating with animation
    final bladeAngle = isPumpRunning ? (animationValue * 4 * math.pi) : 0.0;
    for (int i = 0; i < 4; i++) {
      final angle = bladeAngle + (i * math.pi / 2);
      final bladeEnd = Offset(
        motorCenter.dx + math.cos(angle) * (motorRadius - 4),
        motorCenter.dy + math.sin(angle) * (motorRadius - 4),
      );
      canvas.drawLine(motorCenter, bladeEnd, motorBorder);
    }
  }

  @override
  bool shouldRepaint(covariant _VolumetricTankPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue ||
        oldDelegate.tankLevelPct != tankLevelPct ||
        oldDelegate.isPumpRunning != isPumpRunning ||
        oldDelegate.isDarkMode != isDarkMode;
  }
}
