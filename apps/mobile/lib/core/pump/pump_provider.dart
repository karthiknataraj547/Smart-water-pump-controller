import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum PumpMode {
  manual,
  auto,
  scheduled;

  String get displayName {
    switch (this) {
      case PumpMode.manual:
        return 'Manual';
      case PumpMode.auto:
        return 'Auto';
      case PumpMode.scheduled:
        return 'Scheduled';
    }
  }

  String get shortDescription {
    switch (this) {
      case PumpMode.manual:
        return 'Direct manual relay override';
      case PumpMode.auto:
        return 'Automated level threshold maintenance';
      case PumpMode.scheduled:
        return 'Preset & customized time-based cycles';
    }
  }
}

class SchedulePreset {
  final String id;
  final String title;
  final String subtitle;
  final String startTime;
  final String endTime;
  final int durationMinutes;
  final List<String> days;
  final IconData icon;

  const SchedulePreset({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.startTime,
    required this.endTime,
    required this.durationMinutes,
    required this.days,
    required this.icon,
  });
}

const List<SchedulePreset> kDefaultSchedulePresets = [
  SchedulePreset(
    id: 'dawn',
    title: 'Dawn Morning Fill',
    subtitle: 'Daily freshwater tank top-up',
    startTime: '06:00 AM',
    endTime: '06:30 AM',
    durationMinutes: 30,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    icon: Icons.wb_twilight_rounded,
  ),
  SchedulePreset(
    id: 'noon',
    title: 'Solar Peak Assist',
    subtitle: 'Maximize solar generation hours',
    startTime: '12:30 PM',
    endTime: '01:15 PM',
    durationMinutes: 45,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    icon: Icons.wb_sunny_rounded,
  ),
  SchedulePreset(
    id: 'evening',
    title: 'Evening Demand',
    subtitle: 'Pre-dinner domestic demand fill',
    startTime: '06:00 PM',
    endTime: '06:40 PM',
    durationMinutes: 40,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    icon: Icons.nightlight_round,
  ),
  SchedulePreset(
    id: 'offpeak',
    title: 'Off-Peak Tariff Saver',
    subtitle: 'Late night low electrical rate',
    startTime: '11:30 PM',
    endTime: '12:00 AM',
    durationMinutes: 30,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    icon: Icons.savings_rounded,
  ),
];

class PumpState {
  final bool isRunning;
  final PumpMode mode;
  final bool isEmergencyStopped;
  final bool isStarting;
  final double tankLevelPct;
  final double targetFillPct;
  final double flowRateLpm;
  final int motorRpm;
  final double powerWatts;
  final double motorTempC;
  final double gridVoltage;
  final String activeRunTime;
  final int? activeTimerMinutes;
  final bool weatherRainDelayActive;
  final double totalLitersPumpedToday;
  final int dailyCycleCount;

  // Water Quality & Hydraulic Telemetry
  final int tdsPpm;
  final double waterTempC;
  final double turbidityNtu;
  final double waterPressureBar;
  final double phLevel;

  // Remote Auto Cutoff & Automation Rules
  final bool isRemoteAutoCutoffEnabled;
  final int remoteAutoCutoffMinutes;
  final String remoteAutoCutoffAction;
  final double autoMinTankLevelPct;
  final double autoMaxTankLevelPct;

  // Scheduling Features
  final String activeSchedulePresetId;
  final bool isCustomSchedule;
  final String customStartTime;
  final String customEndTime;
  final int customDurationMinutes;
  final List<String> customDays;
  final bool isScheduleEnabled;

  const PumpState({
    this.isRunning = true,
    this.mode = PumpMode.auto,
    this.isEmergencyStopped = false,
    this.isStarting = false,
    this.tankLevelPct = 72.0,
    this.targetFillPct = 90.0,
    this.flowRateLpm = 12.4,
    this.motorRpm = 2850,
    this.powerWatts = 1120.0,
    this.motorTempC = 41.8,
    this.gridVoltage = 231.8,
    this.activeRunTime = '00:18:32',
    this.activeTimerMinutes,
    this.weatherRainDelayActive = false,
    this.totalLitersPumpedToday = 1280.0,
    this.dailyCycleCount = 14,
    this.tdsPpm = 245,
    this.waterTempC = 24.2,
    this.turbidityNtu = 0.4,
    this.waterPressureBar = 1.86,
    this.phLevel = 7.4,
    this.isRemoteAutoCutoffEnabled = true,
    this.remoteAutoCutoffMinutes = 45,
    this.remoteAutoCutoffAction = 'Stop Pump + Send Notification',
    this.autoMinTankLevelPct = 30.0,
    this.autoMaxTankLevelPct = 90.0,
    this.activeSchedulePresetId = 'dawn',
    this.isCustomSchedule = false,
    this.customStartTime = '06:00 AM',
    this.customEndTime = '06:30 AM',
    this.customDurationMinutes = 30,
    this.customDays = const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    this.isScheduleEnabled = true,
  });

  PumpState copyWith({
    bool? isRunning,
    PumpMode? mode,
    bool? isEmergencyStopped,
    bool? isStarting,
    double? tankLevelPct,
    double? targetFillPct,
    double? flowRateLpm,
    int? motorRpm,
    double? powerWatts,
    double? motorTempC,
    double? gridVoltage,
    String? activeRunTime,
    int? activeTimerMinutes,
    bool? weatherRainDelayActive,
    double? totalLitersPumpedToday,
    int? dailyCycleCount,
    int? tdsPpm,
    double? waterTempC,
    double? turbidityNtu,
    double? waterPressureBar,
    double? phLevel,
    bool? isRemoteAutoCutoffEnabled,
    int? remoteAutoCutoffMinutes,
    String? remoteAutoCutoffAction,
    double? autoMinTankLevelPct,
    double? autoMaxTankLevelPct,
    String? activeSchedulePresetId,
    bool? isCustomSchedule,
    String? customStartTime,
    String? customEndTime,
    int? customDurationMinutes,
    List<String>? customDays,
    bool? isScheduleEnabled,
  }) {
    return PumpState(
      isRunning: isRunning ?? this.isRunning,
      mode: mode ?? this.mode,
      isEmergencyStopped: isEmergencyStopped ?? this.isEmergencyStopped,
      isStarting: isStarting ?? this.isStarting,
      tankLevelPct: tankLevelPct ?? this.tankLevelPct,
      targetFillPct: targetFillPct ?? this.targetFillPct,
      flowRateLpm: flowRateLpm ?? this.flowRateLpm,
      motorRpm: motorRpm ?? this.motorRpm,
      powerWatts: powerWatts ?? this.powerWatts,
      motorTempC: motorTempC ?? this.motorTempC,
      gridVoltage: gridVoltage ?? this.gridVoltage,
      activeRunTime: activeRunTime ?? this.activeRunTime,
      activeTimerMinutes: activeTimerMinutes ?? this.activeTimerMinutes,
      weatherRainDelayActive: weatherRainDelayActive ?? this.weatherRainDelayActive,
      totalLitersPumpedToday: totalLitersPumpedToday ?? this.totalLitersPumpedToday,
      dailyCycleCount: dailyCycleCount ?? this.dailyCycleCount,
      tdsPpm: tdsPpm ?? this.tdsPpm,
      waterTempC: waterTempC ?? this.waterTempC,
      turbidityNtu: turbidityNtu ?? this.turbidityNtu,
      waterPressureBar: waterPressureBar ?? this.waterPressureBar,
      phLevel: phLevel ?? this.phLevel,
      isRemoteAutoCutoffEnabled: isRemoteAutoCutoffEnabled ?? this.isRemoteAutoCutoffEnabled,
      remoteAutoCutoffMinutes: remoteAutoCutoffMinutes ?? this.remoteAutoCutoffMinutes,
      remoteAutoCutoffAction: remoteAutoCutoffAction ?? this.remoteAutoCutoffAction,
      autoMinTankLevelPct: autoMinTankLevelPct ?? this.autoMinTankLevelPct,
      autoMaxTankLevelPct: autoMaxTankLevelPct ?? this.autoMaxTankLevelPct,
      activeSchedulePresetId: activeSchedulePresetId ?? this.activeSchedulePresetId,
      isCustomSchedule: isCustomSchedule ?? this.isCustomSchedule,
      customStartTime: customStartTime ?? this.customStartTime,
      customEndTime: customEndTime ?? this.customEndTime,
      customDurationMinutes: customDurationMinutes ?? this.customDurationMinutes,
      customDays: customDays ?? this.customDays,
      isScheduleEnabled: isScheduleEnabled ?? this.isScheduleEnabled,
    );
  }
}

class PumpNotifier extends StateNotifier<PumpState> {
  PumpNotifier() : super(const PumpState());

  void togglePump() async {
    if (state.isEmergencyStopped) return;
    // Strict requirement: Flutter must not directly execute manual START/STOP when mode = AUTO
    if (state.mode == PumpMode.auto) return;

    if (state.isRunning) {
      state = state.copyWith(
        isRunning: false,
        isStarting: false,
        flowRateLpm: 0.0,
        motorRpm: 0,
        powerWatts: 4.2,
      );
    } else {
      state = state.copyWith(isStarting: true);
      await Future.delayed(const Duration(milliseconds: 600));
      state = state.copyWith(
        isStarting: false,
        isRunning: true,
        flowRateLpm: 12.4,
        motorRpm: 2850,
        powerWatts: 1120.0,
      );
    }
  }

  void startPump() async {
    if (state.isEmergencyStopped || state.isRunning) return;
    // Strict requirement: Flutter must not execute manual start when mode = AUTO
    if (state.mode == PumpMode.auto) return;

    state = state.copyWith(isStarting: true);
    await Future.delayed(const Duration(milliseconds: 600));
    state = state.copyWith(
      isStarting: false,
      isRunning: true,
      flowRateLpm: 12.4,
      motorRpm: 2850,
      powerWatts: 1120.0,
    );
  }

  void stopPump() {
    // Strict requirement: Manual stop unavailable when mode = AUTO (Emergency stop must be used instead)
    if (state.mode == PumpMode.auto) return;

    state = state.copyWith(
      isRunning: false,
      isStarting: false,
      flowRateLpm: 0.0,
      motorRpm: 0,
      powerWatts: 4.2,
    );
  }

  void toggleRemoteAutoCutoff() {
    state = state.copyWith(isRemoteAutoCutoffEnabled: !state.isRemoteAutoCutoffEnabled);
  }

  void setRemoteAutoCutoffMinutes(int minutes) {
    state = state.copyWith(remoteAutoCutoffMinutes: minutes);
  }

  void setRemoteAutoCutoffEnabled(bool enabled) {
    state = state.copyWith(isRemoteAutoCutoffEnabled: enabled);
  }

  void setRemoteAutoCutoffAction(String action) {
    state = state.copyWith(remoteAutoCutoffAction: action);
  }

  void setAutoThresholds({double? minLevel, double? maxLevel}) {
    state = state.copyWith(
      autoMinTankLevelPct: minLevel ?? state.autoMinTankLevelPct,
      autoMaxTankLevelPct: maxLevel ?? state.autoMaxTankLevelPct,
    );
  }

  void setMode(PumpMode mode) {
    state = state.copyWith(mode: mode);
  }

  void setTargetFill(double targetPct) {
    state = state.copyWith(targetFillPct: targetPct);
  }

  void setTimerFill(int? minutes) {
    state = state.copyWith(activeTimerMinutes: minutes);
  }

  void toggleRainDelay() {
    state = state.copyWith(weatherRainDelayActive: !state.weatherRainDelayActive);
  }

  void selectPreset(String presetId) {
    state = state.copyWith(
      activeSchedulePresetId: presetId,
      isCustomSchedule: false,
    );
  }

  void enableCustomSchedule() {
    state = state.copyWith(isCustomSchedule: true);
  }

  void updateCustomTiming({
    String? startTime,
    String? endTime,
    int? durationMinutes,
  }) {
    state = state.copyWith(
      customStartTime: startTime,
      customEndTime: endTime,
      customDurationMinutes: durationMinutes,
      isCustomSchedule: true,
    );
  }

  void toggleCustomDay(String day) {
    final days = List<String>.from(state.customDays);
    if (days.contains(day)) {
      if (days.length > 1) {
        days.remove(day);
      }
    } else {
      days.add(day);
    }
    state = state.copyWith(customDays: days, isCustomSchedule: true);
  }

  void toggleScheduleEnabled() {
    state = state.copyWith(isScheduleEnabled: !state.isScheduleEnabled);
  }

  void emergencyShutdown() {
    state = state.copyWith(
      isEmergencyStopped: true,
      isRunning: false,
      isStarting: false,
      flowRateLpm: 0.0,
      motorRpm: 0,
      powerWatts: 0.0,
    );
  }

  void clearEmergencyLockout() {
    state = state.copyWith(isEmergencyStopped: false);
  }
}

final pumpProvider = StateNotifierProvider<PumpNotifier, PumpState>((ref) {
  return PumpNotifier();
});
