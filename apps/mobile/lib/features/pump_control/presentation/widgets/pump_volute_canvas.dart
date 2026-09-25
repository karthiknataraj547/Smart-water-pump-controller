import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class PumpVoluteCanvas extends StatefulWidget {
  final bool isRunning;
  final bool isStarting;
  final int rpm;
  final double flowRateLpm;
  final double size;
  final bool isDarkMode;
  final VoidCallback? onTap;

  const PumpVoluteCanvas({
    super.key,
    required this.isRunning,
    this.isStarting = false,
    required this.rpm,
    required this.flowRateLpm,
    this.size = 230,
    this.isDarkMode = true,
    this.onTap,
  });

  @override
  State<PumpVoluteCanvas> createState() => _PumpVoluteCanvasState();
}

class _PumpVoluteCanvasState extends State<PumpVoluteCanvas> with SingleTickerProviderStateMixin {
  late AnimationController _rotationController;
  final List<_FluidParticle> _particles = [];
  final math.Random _random = math.Random();

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    // Spawn hydrodynamic fluid particles in volute chamber
    for (int i = 0; i < 24; i++) {
      _particles.add(_FluidParticle(
        radius: 20 + _random.nextDouble() * 65,
        angle: _random.nextDouble() * 2 * math.pi,
        speed: 1.5 + _random.nextDouble() * 2.5,
        size: 1.8 + _random.nextDouble() * 2.2,
        opacity: 0.3 + _random.nextDouble() * 0.7,
      ));
    }
  }

  @override
  void dispose() {
    _rotationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _rotationController,
        builder: (context, child) {
          return CustomPaint(
            size: Size(widget.size, widget.size),
            painter: _VolutePainter(
              animationValue: _rotationController.value,
              isRunning: widget.isRunning,
              isStarting: widget.isStarting,
              rpm: widget.rpm,
              flowRateLpm: widget.flowRateLpm,
              isDarkMode: widget.isDarkMode,
              particles: _particles,
            ),
          );
        },
      ),
    );
  }
}

class _FluidParticle {
  double radius;
  double angle;
  final double speed;
  final double size;
  final double opacity;

  _FluidParticle({
    required this.radius,
    required this.angle,
    required this.speed,
    required this.size,
    required this.opacity,
  });

  void update(double delta, bool isRunning) {
    if (!isRunning) return;
    angle += speed * delta;
    if (angle > 2 * math.pi) {
      angle -= 2 * math.pi;
    }
  }
}

class _VolutePainter extends CustomPainter {
  final double animationValue;
  final bool isRunning;
  final bool isStarting;
  final int rpm;
  final double flowRateLpm;
  final bool isDarkMode;
  final List<_FluidParticle> particles;

  _VolutePainter({
    required this.animationValue,
    required this.isRunning,
    required this.isStarting,
    required this.rpm,
    required this.flowRateLpm,
    required this.isDarkMode,
    required this.particles,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final outerRadius = size.width * 0.48;

    // Update particles
    for (final p in particles) {
      p.update(0.04, isRunning);
    }

    // 1. Outer Cooling Stator Fins & Motor Frame Shadow
    final shadowPaint = Paint()
      ..color = (isRunning
              ? AppColors.emeraldSuccess
              : (isDarkMode ? Colors.black : Colors.black12))
          .withValues(alpha: isRunning ? 0.35 : 0.25)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, isRunning ? 16 : 8);

    canvas.drawCircle(center, outerRadius, shadowPaint);

    // 2. Heavy-duty Cast Metallic Volute Ring
    final voluteBorderPaint = Paint()
      ..shader = SweepGradient(
        colors: isRunning
            ? [
                const Color(0xFF10B981),
                const Color(0xFF064E3B),
                const Color(0xFF34D399),
                const Color(0xFF059669),
                const Color(0xFF10B981),
              ]
            : [
                isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                isDarkMode ? const Color(0xFF475569) : const Color(0xFF94A3B8),
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                isDarkMode ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
              ],
        transform: GradientRotation(animationValue * 2 * math.pi),
      ).createShader(Rect.fromCircle(center: center, radius: outerRadius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6.0;

    canvas.drawCircle(center, outerRadius - 3, voluteBorderPaint);

    // Stator bolt notches around perimeter (12 bolts)
    final boltPaint = Paint()
      ..color = isDarkMode ? Colors.white38 : Colors.black26
      ..style = PaintingStyle.fill;

    for (int i = 0; i < 12; i++) {
      final boltAngle = (i / 12) * 2 * math.pi;
      final bx = center.dx + (outerRadius - 3) * math.cos(boltAngle);
      final by = center.dy + (outerRadius - 3) * math.sin(boltAngle);
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
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                isDarkMode ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
              ],
      ).createShader(Rect.fromCircle(center: center, radius: outerRadius - 8))
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, outerRadius - 8, chamberPaint);

    // 4. Hydrodynamic Spiral Fluid Streamlines (Animated when running)
    if (isRunning) {
      final streamPaint = Paint()
        ..color = const Color(0xFF10B981).withValues(alpha: 0.25)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;

      for (int i = 0; i < 4; i++) {
        final startAngle = (animationValue * 2 * math.pi) + (i * math.pi / 2);
        final rect = Rect.fromCircle(center: center, radius: (outerRadius - 18) * (0.5 + i * 0.12));
        canvas.drawArc(rect, startAngle, math.pi * 0.8, false, streamPaint);
      }

      // Swirling fluid bubble particles
      final particlePaint = Paint()..style = PaintingStyle.fill;
      for (final p in particles) {
        final px = center.dx + p.radius * math.cos(p.angle);
        final py = center.dy + p.radius * math.sin(p.angle);
        particlePaint.color = const Color(0xFF34D399).withValues(alpha: p.opacity);
        canvas.drawCircle(Offset(px, py), p.size, particlePaint);
      }
    }

    // 5. Centrifugal Impeller Vanes (Rotates with animation)
    final impellerRadius = outerRadius * 0.65;
    final vaneRotation = isRunning ? (animationValue * 2 * math.pi * 2.5) : 0.0;
    const vaneCount = 6;

    for (int i = 0; i < vaneCount; i++) {
      final angle = vaneRotation + (i * 2 * math.pi / vaneCount);
      _drawCurvedImpellerVane(canvas, center, impellerRadius, angle, isRunning);
    }

    // 6. Central Impeller Hub & Tactical Contactor Core
    final hubRadius = outerRadius * 0.36;

    // Hub glow
    if (isRunning) {
      final hubGlow = Paint()
        ..color = AppColors.emeraldSuccess.withValues(alpha: 0.4)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
      canvas.drawCircle(center, hubRadius + 4, hubGlow);
    }

    final hubPaint = Paint()
      ..shader = RadialGradient(
        colors: isRunning
            ? [
                const Color(0xFF059669),
                const Color(0xFF064E3B),
                const Color(0xFF022C22),
              ]
            : [
                isDarkMode ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                isDarkMode ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1),
              ],
      ).createShader(Rect.fromCircle(center: center, radius: hubRadius))
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, hubRadius, hubPaint);

    final hubRingPaint = Paint()
      ..color = isRunning
          ? AppColors.emeraldSuccess
          : (isDarkMode ? AppColors.darkBorder : AppColors.lightBorder)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    canvas.drawCircle(center, hubRadius, hubRingPaint);

    // 7. Center Power Icon / RPM Laser Indicator
    if (isStarting) {
      // Rotating starting arc
      final startArcPaint = Paint()
        ..color = AppColors.cyanPrimary
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.0
        ..strokeCap = StrokeCap.round;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: hubRadius - 8),
        animationValue * 2 * math.pi,
        math.pi * 1.2,
        false,
        startArcPaint,
      );
    } else {
      // Mechanical Contactor Power Icon
      final iconPaint = Paint()
        ..color = isRunning ? Colors.white : (isDarkMode ? Colors.white60 : Colors.black54)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: 14),
        -math.pi * 0.7,
        math.pi * 1.4,
        false,
        iconPaint,
      );
      canvas.drawLine(
        Offset(center.dx, center.dy - 16),
        Offset(center.dx, center.dy - 6),
        iconPaint,
      );
    }
  }

  void _drawCurvedImpellerVane(Canvas canvas, Offset center, double radius, double angle, bool isRunning) {
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
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;

    final path = Path();
    final startR = radius * 0.38;
    final endR = radius;

    final x1 = center.dx + startR * math.cos(angle);
    final y1 = center.dy + startR * math.sin(angle);

    final x2 = center.dx + endR * math.cos(angle + 0.45);
    final y2 = center.dy + endR * math.sin(angle + 0.45);

    final cpX = center.dx + (startR + endR) * 0.5 * math.cos(angle + 0.15);
    final cpY = center.dy + (startR + endR) * 0.5 * math.sin(angle + 0.15);

    path.moveTo(x1, y1);
    path.quadraticBezierTo(cpX, cpY, x2, y2);

    canvas.drawPath(path, vanePaint);
  }

  @override
  bool shouldRepaint(covariant _VolutePainter oldDelegate) {
    return oldDelegate.animationValue != animationValue ||
        oldDelegate.isRunning != isRunning ||
        oldDelegate.isStarting != isStarting ||
        oldDelegate.rpm != rpm ||
        oldDelegate.isDarkMode != isDarkMode;
  }
}
