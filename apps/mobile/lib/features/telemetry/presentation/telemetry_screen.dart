import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/pump/pump_provider.dart';
import '../../../shared/dialogs/app_controls_sheet.dart';

class TelemetryScreen extends ConsumerStatefulWidget {
  const TelemetryScreen({super.key});

  @override
  ConsumerState<TelemetryScreen> createState() => _TelemetryScreenState();
}

class _TelemetryScreenState extends ConsumerState<TelemetryScreen> {
  // Merged necessary filters only: Live, Day, Week, Month
  String _selectedFilter = 'Live';
  final List<String> _filters = const ['Live', 'Day', 'Week', 'Month'];

  // Single Analytics Curves parameter toggles
  bool _showWaterLevel = true;
  bool _showFlowRate = true;
  bool _showTds = true;
  bool _showMotorRpm = true;

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;
    final pump = ref.watch(pumpProvider);

    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        titleSpacing: 20,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Telemetry',
              style: GoogleFonts.plusJakartaSans(color: textPrim, fontWeight: FontWeight.w900, fontSize: 20),
            ),
            Row(
              children: [
                Text(
                  'Smart Pump',
                  style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: textSec),
                ),
                const SizedBox(width: 6),
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: AppColors.emeraldSuccess,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: AppColors.emeraldGlow, blurRadius: 4, spreadRadius: 1)],
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  _selectedFilter == 'Live' ? 'Streaming' : _selectedFilter,
                  style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.emeraldSuccess),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Theme Toggle
          Container(
            margin: const EdgeInsets.only(right: 6),
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
          // Settings
          Container(
            margin: const EdgeInsets.only(right: 18),
            decoration: BoxDecoration(
              color: bgSurface,
              shape: BoxShape.circle,
              border: Border.all(color: borderCol),
            ),
            child: IconButton(
              tooltip: 'Settings & Hardware Config',
              onPressed: () => showAppControlsBottomSheet(context, ref),
              icon: Icon(Icons.settings_outlined, color: textSec, size: 20),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // =========================================================
            // 1. STREAMLINED SINGLE FILTER BAR (LIVE, DAY, WEEK, MONTH)
            // =========================================================
            Container(
              height: 44,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: borderCol),
              ),
              child: Row(
                children: _filters.map((filter) {
                  final isSel = _selectedFilter == filter;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedFilter = filter),
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSel
                              ? (isDark ? AppColors.darkElevated : Colors.white)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(13),
                          boxShadow: isSel
                              ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4)]
                              : null,
                          border: isSel
                              ? Border.all(color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric, width: 1.2)
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          filter,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
                            color: isSel
                                ? (isDark ? AppColors.cyanPrimary : AppColors.blueElectric)
                                : textSec,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),

            // =========================================================
            // 2. PRIMARY TELEMETRY TILES
            // =========================================================
            Row(
              children: [
                Expanded(
                  child: _OverviewTile(
                    title: 'WATER LEVEL',
                    value: '${pump.tankLevelPct.toInt()}%',
                    subtitle: '${(pump.tankLevelPct * 10).toInt()} / 1000 L',
                    color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                    icon: Icons.water_drop_rounded,
                    isDark: isDark,
                    bgSurface: bgSurface,
                    borderCol: borderCol,
                    textPrim: textPrim,
                    textSec: textSec,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _OverviewTile(
                    title: 'FLOW RATE',
                    value: '${pump.flowRateLpm} LPM',
                    subtitle: pump.isRunning ? 'Active Inflow' : '0.0 LPM Rest',
                    color: const Color(0xFF10B981),
                    icon: Icons.waves_rounded,
                    isDark: isDark,
                    bgSurface: bgSurface,
                    borderCol: borderCol,
                    textPrim: textPrim,
                    textSec: textSec,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _OverviewTile(
                    title: 'WATER TDS',
                    value: '${pump.tdsPpm} ppm',
                    subtitle: 'Normal Potable',
                    color: AppColors.tealAccent,
                    icon: Icons.biotech_rounded,
                    isDark: isDark,
                    bgSurface: bgSurface,
                    borderCol: borderCol,
                    textPrim: textPrim,
                    textSec: textSec,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _OverviewTile(
                    title: 'MOTOR SPEED',
                    value: pump.isRunning ? '${pump.motorRpm} RPM' : '0 RPM',
                    subtitle: pump.isRunning ? 'Nominal Speed' : 'Standby Off',
                    color: const Color(0xFF8B5CF6),
                    icon: Icons.speed_rounded,
                    isDark: isDark,
                    bgSurface: bgSurface,
                    borderCol: borderCol,
                    textPrim: textPrim,
                    textSec: textSec,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // =========================================================
            // 3. SINGLE UNIFIED ANALYTICS CURVES CARD (ALL PARAMETERS)
            // =========================================================
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: bgSurface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: borderCol),
                boxShadow: [
                  BoxShadow(
                    color: isDark ? Colors.black.withValues(alpha: 0.25) : Colors.black.withValues(alpha: 0.03),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title + Active Filter Tag
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ANALYTICS CURVES',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: textPrim,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Unified multi-sensor timeline (Normalized % scale)',
                            style: GoogleFonts.plusJakartaSans(fontSize: 10, color: textSec, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: (isDark ? AppColors.cyanPrimary : AppColors.blueElectric).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: (isDark ? AppColors.cyanPrimary : AppColors.blueElectric).withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          _selectedFilter.toUpperCase(),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Interactive Parameter Toggle Chips
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _ParameterChip(
                        label: 'Level %',
                        color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                        isActive: _showWaterLevel,
                        onTap: () => setState(() => _showWaterLevel = !_showWaterLevel),
                      ),
                      _ParameterChip(
                        label: 'Flow LPM',
                        color: const Color(0xFF10B981),
                        isActive: _showFlowRate,
                        onTap: () => setState(() => _showFlowRate = !_showFlowRate),
                      ),
                      _ParameterChip(
                        label: 'TDS ppm',
                        color: AppColors.tealAccent,
                        isActive: _showTds,
                        onTap: () => setState(() => _showTds = !_showTds),
                      ),
                      _ParameterChip(
                        label: 'Motor RPM',
                        color: const Color(0xFF8B5CF6),
                        isActive: _showMotorRpm,
                        onTap: () => setState(() => _showMotorRpm = !_showMotorRpm),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Single Unified Multi-Curve LineChart
                  SizedBox(
                    height: 210,
                    child: LineChart(
                      LineChartData(
                        minY: 0,
                        maxY: 100,
                        minX: 0,
                        maxX: 6,
                        lineTouchData: LineTouchData(
                          handleBuiltInTouches: true,
                          touchTooltipData: LineTouchTooltipData(
                            getTooltipColor: (_) => isDark ? const Color(0xFF0F172A) : Colors.white,
                            getTooltipItems: (touchedSpots) {
                              return touchedSpots.map((spot) {
                                String label = '';
                                String realVal = '';
                                Color spotColor = spot.bar.color ?? AppColors.cyanPrimary;

                                if (spot.barIndex == 0) {
                                  label = 'Level';
                                  realVal = '${spot.y.toInt()}%';
                                } else if (spot.barIndex == 1) {
                                  label = 'Flow';
                                  realVal = '${(spot.y * 20.0 / 100.0).toStringAsFixed(1)} LPM';
                                } else if (spot.barIndex == 2) {
                                  label = 'TDS';
                                  realVal = '${(spot.y * 400.0 / 100.0).toInt()} ppm';
                                } else {
                                  label = 'RPM';
                                  realVal = '${(spot.y * 3000.0 / 100.0).toInt()} RPM';
                                }

                                return LineTooltipItem(
                                  '$label: $realVal',
                                  GoogleFonts.plusJakartaSans(
                                    color: spotColor,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 11,
                                  ),
                                );
                              }).toList();
                            },
                          ),
                        ),
                        gridData: FlGridData(
                          show: true,
                          drawVerticalLine: false,
                          horizontalInterval: 25,
                          getDrawingHorizontalLine: (val) => FlLine(
                            color: borderCol.withValues(alpha: 0.4),
                            strokeWidth: 1,
                            dashArray: const [4, 4],
                          ),
                        ),
                        titlesData: FlTitlesData(
                          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                          leftTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              reservedSize: 32,
                              interval: 25,
                              getTitlesWidget: (val, meta) {
                                return Text(
                                  '${val.toInt()}%',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 9, color: textSec, fontWeight: FontWeight.w600),
                                );
                              },
                            ),
                          ),
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              reservedSize: 22,
                              interval: 1,
                              getTitlesWidget: (val, meta) {
                                final timeLabels = _getTimeLabels(_selectedFilter);
                                final idx = val.toInt();
                                if (idx >= 0 && idx < timeLabels.length) {
                                  return Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      timeLabels[idx],
                                      style: GoogleFonts.plusJakartaSans(fontSize: 9, color: textSec, fontWeight: FontWeight.w600),
                                    ),
                                  );
                                }
                                return const SizedBox.shrink();
                              },
                            ),
                          ),
                        ),
                        borderData: FlBorderData(show: false),
                        lineBarsData: _buildUnifiedLineBars(isDark),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // =========================================================
            // 4. TODAY'S SUMMARY STATISTICS
            // =========================================================
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: bgSurface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: borderCol),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "PERIOD SUMMARY",
                        style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w800, color: textPrim, letterSpacing: 0.5),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.emeraldSuccess.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Aggregated OK',
                          style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.emeraldSuccess),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  _SummaryStatRow(label: 'Total Volume Pumped', value: '1,280 L', textPrim: textPrim, textSec: textSec),
                  const Divider(height: 18),
                  _SummaryStatRow(label: 'Daily Cycles Completed', value: '${pump.dailyCycleCount} cycles', textPrim: textPrim, textSec: textSec),
                  const Divider(height: 18),
                  _SummaryStatRow(label: 'Average Flow Rate', value: '11.8 LPM', textPrim: textPrim, textSec: textSec),
                  const Divider(height: 18),
                  _SummaryStatRow(label: 'Peak Pumping Flow', value: '15.2 LPM', textPrim: textPrim, textSec: textSec),
                  const Divider(height: 18),
                  _SummaryStatRow(label: 'Average Mineral TDS', value: '238 ppm', textPrim: textPrim, textSec: textSec),
                  const Divider(height: 18),
                  _SummaryStatRow(label: 'Active Run Time Today', value: '2h 18m', textPrim: textPrim, textSec: textSec),
                ],
              ),
            ),
            const SizedBox(height: 28),
          ],
        ),
      ),
    );
  }

  List<String> _getTimeLabels(String filter) {
    switch (filter) {
      case 'Day':
        return const ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24:00'];
      case 'Week':
        return const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      case 'Month':
        return const ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];
      case 'Live':
      default:
        return const ['-60m', '-50m', '-40m', '-30m', '-20m', '-10m', 'Now'];
    }
  }

  List<LineChartBarData> _buildUnifiedLineBars(bool isDark) {
    final bars = <LineChartBarData>[];

    // 1. Water Level (% direct: 0 - 100)
    if (_showWaterLevel) {
      final levelColor = isDark ? AppColors.cyanPrimary : AppColors.blueElectric;
      bars.add(
        LineChartBarData(
          spots: const [
            FlSpot(0, 32),
            FlSpot(1, 40),
            FlSpot(2, 54),
            FlSpot(3, 65),
            FlSpot(4, 70),
            FlSpot(5, 72),
            FlSpot(6, 72),
          ],
          isCurved: true,
          color: levelColor,
          barWidth: 2.8,
          isStrokeCapRound: true,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                levelColor.withValues(alpha: 0.25),
                levelColor.withValues(alpha: 0.0),
              ],
            ),
          ),
        ),
      );
    }

    // 2. Flow Rate (0 - 20 LPM -> normalized to 0 - 100%)
    if (_showFlowRate) {
      const flowColor = Color(0xFF10B981);
      bars.add(
        LineChartBarData(
          spots: const [
            FlSpot(0, 0),
            FlSpot(1, 57.5), // 11.5 LPM
            FlSpot(2, 74.0), // 14.8 LPM
            FlSpot(3, 76.0), // 15.2 LPM
            FlSpot(4, 60.0), // 12.0 LPM
            FlSpot(5, 62.0), // 12.4 LPM
            FlSpot(6, 62.0), // 12.4 LPM
          ],
          isCurved: true,
          color: flowColor,
          barWidth: 2.4,
          isStrokeCapRound: true,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(show: false),
        ),
      );
    }

    // 3. TDS (0 - 400 ppm -> normalized to 0 - 100%)
    if (_showTds) {
      const tdsColor = AppColors.tealAccent;
      bars.add(
        LineChartBarData(
          spots: const [
            FlSpot(0, 62.5), // 250 ppm
            FlSpot(1, 61.5), // 246 ppm
            FlSpot(2, 60.0), // 240 ppm
            FlSpot(3, 59.5), // 238 ppm
            FlSpot(4, 60.5), // 242 ppm
            FlSpot(5, 61.2), // 245 ppm
            FlSpot(6, 61.2), // 245 ppm
          ],
          isCurved: true,
          color: tdsColor,
          barWidth: 2.2,
          isStrokeCapRound: true,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(show: false),
        ),
      );
    }

    // 4. Motor RPM (0 - 3000 RPM -> normalized to 0 - 100%)
    if (_showMotorRpm) {
      const rpmColor = Color(0xFF8B5CF6);
      bars.add(
        LineChartBarData(
          spots: const [
            FlSpot(0, 0),
            FlSpot(1, 80.0), // 2400 RPM
            FlSpot(2, 95.0), // 2850 RPM
            FlSpot(3, 95.0), // 2850 RPM
            FlSpot(4, 95.0), // 2850 RPM
            FlSpot(5, 95.0), // 2850 RPM
            FlSpot(6, 95.0), // 2850 RPM
          ],
          isCurved: true,
          color: rpmColor,
          barWidth: 2.0,
          isStrokeCapRound: true,
          dashArray: const [5, 4],
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(show: false),
        ),
      );
    }

    return bars;
  }
}

class _ParameterChip extends StatelessWidget {
  final String label;
  final Color color;
  final bool isActive;
  final VoidCallback onTap;

  const _ParameterChip({
    required this.label,
    required this.color,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isActive ? color.withValues(alpha: 0.16) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isActive ? color : color.withValues(alpha: 0.3),
            width: isActive ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: isActive ? color : Colors.transparent,
                border: Border.all(color: color, width: 1.5),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                color: isActive ? color : color.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OverviewTile extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final Color color;
  final IconData icon;
  final bool isDark;
  final Color bgSurface;
  final Color borderCol;
  final Color textPrim;
  final Color textSec;

  const _OverviewTile({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.color,
    required this.icon,
    required this.isDark,
    required this.bgSurface,
    required this.borderCol,
    required this.textPrim,
    required this.textSec,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderCol),
        boxShadow: [
          BoxShadow(
            color: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 5),
              Text(
                title,
                style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: textSec, letterSpacing: 0.5),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(fontSize: 17, fontWeight: FontWeight.w900, color: textPrim),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: GoogleFonts.plusJakartaSans(fontSize: 10, color: textSec, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _SummaryStatRow extends StatelessWidget {
  final String label;
  final String value;
  final Color textPrim;
  final Color textSec;

  const _SummaryStatRow({
    required this.label,
    required this.value,
    required this.textPrim,
    required this.textSec,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: textSec),
        ),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w800, color: textPrim),
        ),
      ],
    );
  }
}
