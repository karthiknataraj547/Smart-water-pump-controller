import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';

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
  final bool isStopping;
  final bool isOnline;
  final bool hasRealData;
  final String? hardwareId;
  final String? serialNumber;
  final String? hardwareName;
  final double tankLevelPct;
  final double waterVolumeLiters;
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
  final int wifiRssi;

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
    this.isRunning = false,
    this.mode = PumpMode.manual,
    this.isEmergencyStopped = false,
    this.isStarting = false,
    this.isStopping = false,
    this.isOnline = false,
    this.hasRealData = false,
    this.hardwareId,
    this.serialNumber,
    this.hardwareName,
    this.tankLevelPct = 0.0,
    this.waterVolumeLiters = 0.0,
    this.targetFillPct = 90.0,
    this.flowRateLpm = 0.0,
    this.motorRpm = 0,
    this.powerWatts = 0.0,
    this.motorTempC = 0.0,
    this.gridVoltage = 0.0,
    this.activeRunTime = '00:00:00',
    this.activeTimerMinutes,
    this.weatherRainDelayActive = false,
    this.totalLitersPumpedToday = 0.0,
    this.dailyCycleCount = 0,
    this.wifiRssi = 0,
    this.tdsPpm = 0,
    this.waterTempC = 0.0,
    this.turbidityNtu = 0.0,
    this.waterPressureBar = 0.0,
    this.phLevel = 7.0,
    this.isRemoteAutoCutoffEnabled = false,
    this.remoteAutoCutoffMinutes = 45,
    this.remoteAutoCutoffAction = 'Stop Pump + Send Notification',
    this.autoMinTankLevelPct = 20.0,
    this.autoMaxTankLevelPct = 95.0,
    this.activeSchedulePresetId = 'dawn',
    this.isCustomSchedule = false,
    this.customStartTime = '06:00 AM',
    this.customEndTime = '06:30 AM',
    this.customDurationMinutes = 30,
    this.customDays = const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    this.isScheduleEnabled = false,
  });

  PumpState copyWith({
    bool? isRunning,
    PumpMode? mode,
    bool? isEmergencyStopped,
    bool? isStarting,
    bool? isStopping,
    bool? isOnline,
    bool? hasRealData,
    String? hardwareId,
    String? serialNumber,
    String? hardwareName,
    double? tankLevelPct,
    double? waterVolumeLiters,
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
    int? wifiRssi,
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
      isStopping: isStopping ?? this.isStopping,
      isOnline: isOnline ?? this.isOnline,
      hasRealData: hasRealData ?? this.hasRealData,
      hardwareId: hardwareId ?? this.hardwareId,
      serialNumber: serialNumber ?? this.serialNumber,
      hardwareName: hardwareName ?? this.hardwareName,
      tankLevelPct: tankLevelPct ?? this.tankLevelPct,
      waterVolumeLiters: waterVolumeLiters ?? this.waterVolumeLiters,
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
      wifiRssi: wifiRssi ?? this.wifiRssi,
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
  final ApiClient _apiClient;
  Timer? _pollingTimer;

  PumpNotifier({ApiClient? apiClient})
      : _apiClient = apiClient ?? defaultApiClient,
        super(const PumpState()) {
    fetchHardwareState();
    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      fetchHardwareState();
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> fetchHardwareState() async {
    try {
      final resp = await _apiClient.getWithFallback('/api/hardware');
      if (resp.data is List && (resp.data as List).isNotEmpty) {
        final list = resp.data as List;
        final hw = list.first as Map<String, dynamic>;
        final hwId = hw['id'] as String?;
        final sNum = hw['serialNumber'] as String?;
        final hwName = hw['name'] as String?;
        final isOnline = hw['isOnline'] == true;
        final isEmergency = hw['emergencyStopActive'] == true || hw['status'] == 'EMERGENCY_LOCKED';
        final pState = hw['pumpState'] as Map<String, dynamic>?;
        final pModeStr = (pState?['mode'] as String?)?.toLowerCase();
        final isPumpOn = pState?['state'] == 'ON';
        final flowRate = (pState?['currentFlowRateLpm'] as num?)?.toDouble() ?? 0.0;
        final rssi = (hw['wifiRssi'] as num?)?.toInt() ?? state.wifiRssi;

        final sensor = hw['latestSensorReading'] as Map<String, dynamic>?;
        double level = state.tankLevelPct;
        double volume = state.waterVolumeLiters;
        int tds = state.tdsPpm;
        bool hasData = state.hasRealData;

        if (sensor != null) {
          level = (sensor['tankLevelPct'] as num?)?.toDouble() ?? level;
          volume = (sensor['waterVolumeL'] as num?)?.toDouble() ?? volume;
          tds = (sensor['tdsPpm'] as num?)?.toInt() ?? tds;
          hasData = true;
        }

        PumpMode resolvedMode = state.mode;
        if (pModeStr == 'auto') {
          resolvedMode = PumpMode.auto;
        } else if (pModeStr == 'scheduled') {
          resolvedMode = PumpMode.scheduled;
        } else if (pModeStr == 'manual') {
          resolvedMode = PumpMode.manual;
        }

        state = state.copyWith(
          hardwareId: hwId,
          serialNumber: sNum,
          hardwareName: hwName,
          isOnline: isOnline,
          isEmergencyStopped: isEmergency,
          isRunning: isPumpOn,
          mode: resolvedMode,
          flowRateLpm: isPumpOn ? (flowRate > 0 ? flowRate : (hasData ? flowRate : 0.0)) : 0.0,
          powerWatts: isPumpOn ? 1120.0 : 0.0,
          motorRpm: isPumpOn ? 2850 : 0,
          tankLevelPct: level,
          waterVolumeLiters: volume,
          tdsPpm: tds,
          hasRealData: hasData,
          wifiRssi: rssi,
        );
      } else if (resp.data is List && (resp.data as List).isEmpty) {
        state = state.copyWith(isOnline: false, hasRealData: false);
      }
    } catch (_) {
      // Backend temporarily unreachable
    }
  }

  Future<void> togglePump() async {
    if (state.isEmergencyStopped) return;
    if (state.mode == PumpMode.auto) return;

    if (state.isRunning) {
      await stopPump();
    } else {
      await startPump();
    }
  }

  Future<void> startPump() async {
    if (state.isEmergencyStopped || state.isRunning) return;
    if (state.mode == PumpMode.auto) return;

    state = state.copyWith(isStarting: true);
    try {
      if (state.hardwareId == null || state.hardwareId!.isEmpty) {
        await fetchHardwareState();
      }
      final hwId = state.hardwareId;
      if (hwId != null && hwId.isNotEmpty) {
        await _apiClient.postWithFallback('/api/hardware/$hwId/pump/start', {});
      }
      state = state.copyWith(
        isStarting: false,
        isRunning: true,
        motorRpm: 2850,
        powerWatts: 1120.0,
      );
      await fetchHardwareState();
    } catch (e) {
      state = state.copyWith(isStarting: false);
      rethrow;
    }
  }

  Future<void> stopPump() async {
    if (state.mode == PumpMode.auto) return;

    state = state.copyWith(isStopping: true);
    try {
      if (state.hardwareId == null || state.hardwareId!.isEmpty) {
        await fetchHardwareState();
      }
      final hwId = state.hardwareId;
      if (hwId != null && hwId.isNotEmpty) {
        await _apiClient.postWithFallback('/api/hardware/$hwId/pump/stop', {});
      }
      state = state.copyWith(
        isStopping: false,
        isRunning: false,
        flowRateLpm: 0.0,
        motorRpm: 0,
        powerWatts: 0.0,
      );
      await fetchHardwareState();
    } catch (e) {
      state = state.copyWith(isStopping: false);
      rethrow;
    }
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

  Future<void> emergencyShutdown() async {
    state = state.copyWith(
      isEmergencyStopped: true,
      isRunning: false,
      isStarting: false,
      flowRateLpm: 0.0,
      motorRpm: 0,
      powerWatts: 0.0,
    );
    try {
      final hwId = state.hardwareId;
      if (hwId != null && hwId.isNotEmpty) {
        await _apiClient.postWithFallback(
          '/api/hardware/$hwId/emergency-stop',
          {'reason': 'USER_MANUAL_BUTTON'},
        );
      }
      await fetchHardwareState();
    } catch (_) {}
  }

  Future<void> clearEmergencyLockout() async {
    try {
      final hwId = state.hardwareId;
      if (hwId != null && hwId.isNotEmpty) {
        await _apiClient.postWithFallback(
          '/api/hardware/$hwId/emergency-reset',
          {'confirmAcknowledge': true},
        );
      }
      state = state.copyWith(isEmergencyStopped: false);
      await fetchHardwareState();
    } catch (_) {
      state = state.copyWith(isEmergencyStopped: false);
    }
  }
}

final pumpProvider = StateNotifierProvider<PumpNotifier, PumpState>((ref) {
  return PumpNotifier();
});
