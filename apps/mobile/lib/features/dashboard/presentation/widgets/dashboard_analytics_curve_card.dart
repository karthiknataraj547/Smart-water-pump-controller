import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/pump/pump_provider.dart';
import '../../../../core/theme/app_theme.dart';

enum AnalyticsParameter {
  waterLevel,
  flowRate,
  tdsPurity,
  motorSpeed;

  String get label {
    switch (this) {
      case AnalyticsParameter.waterLevel:
        return 'Level';
      case AnalyticsParameter.flowRate:
        return 'Flow';
      case AnalyticsParameter.tdsPurity:
        return 'TDS';
      case AnalyticsParameter.motorSpeed:
        return 'RPM';
    }
  }

  String get fullName {
    switch (this) {
      case AnalyticsParameter.waterLevel:
        return 'Water Level';
      case AnalyticsParameter.flowRate:
        return 'Flow Rate';
      case AnalyticsParameter.tdsPurity:
        return 'Water TDS Purity';
      case AnalyticsParameter.motorSpeed:
        return 'Motor Speed';
    }
  }

  String get unit {
    switch (this) {
      case AnalyticsParameter.waterLevel:
        return '%';
      case AnalyticsParameter.flowRate:
        return 'LPM';
      case AnalyticsParameter.tdsPurity:
        return 'ppm';
      case AnalyticsParameter.motorSpeed:
        return 'RPM';
    }
  }

  IconData get icon {
    switch (this) {
      case AnalyticsParameter.waterLevel:
        return Icons.water_drop_rounded;
      case AnalyticsParameter.flowRate:
        return Icons.waves_rounded;
      case AnalyticsParameter.tdsPurity:
        return Icons.biotech_rounded;
      case AnalyticsParameter.motorSpeed:
        return Icons.speed_rounded;
    }
  }
}

class DashboardAnalyticsCurveCard extends StatefulWidget {
  final PumpState pump;
  final bool isDark;
  final VoidCallback? onOpenTelemetry;

  const DashboardAnalyticsCurveCard({
    super.key,
    required this.pump,
    required this.isDark,
    this.onOpenTelemetry,
  });

  @override
  State<DashboardAnalyticsCurveCard> createState() => _DashboardAnalyticsCurveCardState();
}

class _DashboardAnalyticsCurveCardState extends State<DashboardAnalyticsCurveCard> {
  AnalyticsParameter _selectedParam = AnalyticsParameter.waterLevel;

  Color _getParameterColor(AnalyticsParameter param) {
    switch (param) {
      case AnalyticsParameter.waterLevel:
        return widget.isDark ? AppColors.cyanPrimary : AppColors.blueElectric;
      case AnalyticsParameter.flowRate:
        return AppColors.emeraldSuccess;
      case AnalyticsParameter.tdsPurity:
        return AppColors.indigoData;
      case AnalyticsParameter.motorSpeed:
        return AppColors.amberWarning;
    }
  }

  String _getCurrentValueString(AnalyticsParameter param) {
    switch (param) {
      case AnalyticsParameter.waterLevel:
        return '${widget.pump.tankLevelPct.toStringAsFixed(0)}%';
      case AnalyticsParameter.flowRate:
        return '${widget.pump.flowRateLpm.toStringAsFixed(1)} LPM';
      case AnalyticsParameter.tdsPurity:
        return '${widget.pump.tdsPpm} ppm';
      case AnalyticsParameter.motorSpeed:
        return widget.pump.isRunning ? '${widget.pump.motorRpm} RPM' : '0 RPM';
    }
  }

  String _getStatusTag(AnalyticsParameter param) {
    switch (param) {
      case AnalyticsParameter.waterLevel:
        return widget.pump.tankLevelPct >= 80 ? 'Optimal Reserve' : 'Normal Storage';
      case AnalyticsParameter.flowRate:
        return widget.pump.isRunning ? 'Active Inflow' : 'Static Standby';
      case AnalyticsParameter.tdsPurity:
        return widget.pump.tdsPpm < 300 ? 'Potable Clean' : 'High Mineral';
      case AnalyticsParameter.motorSpeed:
        return widget.pump.isRunning ? 'Nominal 50Hz' : 'Motor Idling';
    }
  }

  Map<String, String> _getStats(AnalyticsParameter param) {
    switch (param) {
      case AnalyticsParameter.waterLevel:
        return {'MIN': '28%', 'AVG': '64%', 'PEAK': '88%'};
      case AnalyticsParameter.flowRate:
        return {'MIN': '0.0', 'AVG': '11.8', 'PEAK': '14.2'};
      case AnalyticsParameter.tdsPurity:
        return {'MIN': '220', 'AVG': '238', 'PEAK': '254'};
      case AnalyticsParameter.motorSpeed:
        return {'MIN': '0', 'AVG': '2780', 'PEAK': '2910'};
    }
  }

  List<FlSpot> _getSpotsForParam(AnalyticsParameter param) {
    switch (param) {
      case AnalyticsParameter.waterLevel:
        return const [
          FlSpot(0, 32),
          FlSpot(1, 38),
          FlSpot(2, 49),
          FlSpot(3, 59),
          FlSpot(4, 66),
          FlSpot(5, 70),
          FlSpot(6, 72),
        ];
      case AnalyticsParameter.flowRate:
        return const [
          FlSpot(0, 0),
          FlSpot(1, 4.2),
          FlSpot(2, 10.5),
          FlSpot(3, 13.8),
          FlSpot(4, 12.1),
          FlSpot(5, 12.6),
          FlSpot(6, 12.4),
        ];
      case AnalyticsParameter.tdsPurity:
        return const [
          FlSpot(0, 248),
          FlSpot(1, 246),
          FlSpot(2, 244),
          FlSpot(3, 242),
          FlSpot(4, 243),
          FlSpot(5, 244),
          FlSpot(6, 245),
        ];
      case AnalyticsParameter.motorSpeed:
        return const [
          FlSpot(0, 0),
          FlSpot(1, 1400),
          FlSpot(2, 2800),
          FlSpot(3, 2850),
          FlSpot(4, 2850),
          FlSpot(5, 2850),
          FlSpot(6, 2850),
        ];
    }
  }

  double _getMaxY(AnalyticsParameter param) {
    switch (param) {
      case AnalyticsParameter.waterLevel:
        return 100;
      case AnalyticsParameter.flowRate:
        return 18;
      case AnalyticsParameter.tdsPurity:
        return 300;
      case AnalyticsParameter.motorSpeed:
        return 3200;
    }
  }

  double _getMinY(AnalyticsParameter param) {
    switch (param) {
      case AnalyticsParameter.waterLevel:
        return 0;
      case AnalyticsParameter.flowRate:
        return 0;
      case AnalyticsParameter.tdsPurity:
        return 200;
      case AnalyticsParameter.motorSpeed:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    final bgSurface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final bgElevated = isDark ? AppColors.darkElevated : AppColors.lightElevated;
    final borderCol = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final textPrim = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    final paramColor = _getParameterColor(_selectedParam);
    final stats = _getStats(_selectedParam);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bgSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderCol, width: 1.0),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. HEADER ROW: Eyebrow + Live Indicator + Full Telemetry Link
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: paramColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(color: paramColor.withValues(alpha: 0.4), blurRadius: 4, spreadRadius: 1),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'LIVE ANALYTICS CURVE',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: textSec,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
              if (widget.onOpenTelemetry != null)
                GestureDetector(
                  onTap: widget.onOpenTelemetry,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Full Matrix',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                        ),
                      ),
                      const SizedBox(width: 3),
                      Icon(
                        Icons.arrow_forward_rounded,
                        size: 13,
                        color: isDark ? AppColors.cyanPrimary : AppColors.blueElectric,
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // 2. SINGLE PARAMETER SELECTOR TABS (Only one parameter selected at a time)
          Container(
            height: 38,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderCol, width: 1.0),
            ),
            child: Row(
              children: AnalyticsParameter.values.map((param) {
                final isSelected = _selectedParam == param;
                final color = _getParameterColor(param);

                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedParam = param),
                    child: Container(
                      decoration: BoxDecoration(
                        color: isSelected ? (isDark ? AppColors.darkSurface : Colors.white) : Colors.transparent,
                        borderRadius: BorderRadius.circular(9),
                        border: isSelected ? Border.all(color: color.withValues(alpha: 0.4), width: 1.0) : null,
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            param.icon,
                            size: 13,
                            color: isSelected ? color : textSec,
                          ),
                          const SizedBox(width: 4),
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              param.label,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                color: isSelected ? textPrim : textSec,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 14),

          // 3. PARAMETER READOUT & STATUS BADGE
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _selectedParam.fullName,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: textSec,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _getCurrentValueString(_selectedParam),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: textPrim,
                      letterSpacing: -0.5,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: paramColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: paramColor.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _getStatusTag(_selectedParam),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: paramColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 4. SINGLE PARAMETER SMOOTH CURVE CHART
          SizedBox(
            height: 140,
            child: LineChart(
              LineChartData(
                minX: 0,
                maxX: 6,
                minY: _getMinY(_selectedParam),
                maxY: _getMaxY(_selectedParam),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                    tooltipRoundedRadius: 8,
                    getTooltipItems: (touchedSpots) {
                      return touchedSpots.map((spot) {
                        return LineTooltipItem(
                          '${spot.y.toStringAsFixed(1)} ${_selectedParam.unit}',
                          GoogleFonts.plusJakartaSans(
                            color: paramColor,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        );
                      }).toList();
                    },
                  ),
                ),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: (_getMaxY(_selectedParam) - _getMinY(_selectedParam)) / 3,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: isDark ? const Color(0x1AFFFFFF) : const Color(0x1A000000),
                    strokeWidth: 1,
                    dashArray: [4, 4],
                  ),
                ),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 22,
                      interval: 1,
                      getTitlesWidget: (value, meta) {
                        const labels = ['-60m', '-50m', '-40m', '-30m', '-20m', '-10m', 'Now'];
                        final idx = value.toInt();
                        if (idx < 0 || idx >= labels.length || (idx % 2 != 0 && idx != labels.length - 1)) {
                          return const SizedBox.shrink();
                        }
                        return Text(
                          labels[idx],
                          style: GoogleFonts.plusJakartaSans(
                            color: textSec,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w600,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: _getSpotsForParam(_selectedParam),
                    isCurved: true,
                    curveSmoothness: 0.35,
                    color: paramColor,
                    barWidth: 2.8,
                    isStrokeCapRound: true,
                    dotData: FlDotData(
                      show: true,
                      checkToShowDot: (spot, barData) => spot.x == 6, // show dot on the latest spot
                      getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
                        radius: 4.5,
                        color: paramColor,
                        strokeWidth: 2,
                        strokeColor: Colors.white,
                      ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          paramColor.withValues(alpha: 0.22),
                          paramColor.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),

          // 5. QUICK STATS SUMMARY FOOTER
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: bgElevated,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderCol, width: 1.0),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatMetric('MIN', stats['MIN']!, _selectedParam.unit, textSec, textPrim),
                Container(width: 1, height: 16, color: borderCol),
                _buildStatMetric('AVG', stats['AVG']!, _selectedParam.unit, textSec, textPrim),
                Container(width: 1, height: 16, color: borderCol),
                _buildStatMetric('PEAK', stats['PEAK']!, _selectedParam.unit, textSec, textPrim),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatMetric(String label, String value, String unit, Color labelColor, Color valColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$label: ',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: labelColor,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: valColor,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}
