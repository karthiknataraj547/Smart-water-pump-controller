import { z } from 'zod';

// Auth Validation Schemas
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phoneNumber: z.string().optional()
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Hardware Claiming Schema
export const ClaimHardwareSchema = z.object({
  serialNumber: z.string().min(6, 'Serial number must be valid'),
  claimCode: z.string().length(6, 'Claim code must be 6 digits'),
  name: z.string().min(1, 'Device name is required').max(50)
});

// Pump Control Schemas
export const PumpStartSchema = z.object({
  mode: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
  targetDurationSeconds: z.number().int().positive().max(7200).optional()
});

export const EmergencyStopSchema = z.object({
  reason: z.string().min(1).default('USER_MANUAL_BUTTON')
});

export const EmergencyResetSchema = z.object({
  acknowledgedWarning: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge safety inspection before reset.' })
  })
});

// Telemetry Payload Schema
export const TelemetryPayloadSchema = z.object({
  tankLevelPct: z.number().min(0).max(100),
  waterVolumeL: z.number().min(0),
  flowRateLpm: z.number().min(0),
  tdsPpm: z.number().min(0),
  tdhMeters: z.number().min(0),
  pumpState: z.enum(['OFF', 'STARTING', 'ON', 'STOPPING', 'FAULT', 'EMERGENCY_STOPPED']),
  timestamp: z.number().int().positive()
});

// Automation Rule Schema
export const AutomationRuleSchema = z.object({
  name: z.string().min(3).max(60),
  conditionMetric: z.enum(['TANK_LEVEL_PERCENT', 'TDS_PPM', 'SCHEDULE']),
  operator: z.enum(['LESS_THAN', 'GREATER_THAN', 'EQUALS']),
  thresholdValue: z.number(),
  secondaryMetric: z.enum(['TANK_LEVEL_PERCENT', 'TDS_PPM', 'SCHEDULE']).optional(),
  secondaryOp: z.enum(['LESS_THAN', 'GREATER_THAN', 'EQUALS']).optional(),
  secondaryVal: z.number().optional(),
  action: z.enum(['PUMP_START', 'PUMP_STOP', 'ALERT_ONLY']),
  actionDurationSec: z.number().int().positive().optional(),
  cooldownSeconds: z.number().int().min(60).default(300)
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ClaimHardwareInput = z.infer<typeof ClaimHardwareSchema>;
export type PumpStartInput = z.infer<typeof PumpStartSchema>;
export type EmergencyStopInput = z.infer<typeof EmergencyStopSchema>;
export type EmergencyResetInput = z.infer<typeof EmergencyResetSchema>;
export type TelemetryPayloadInput = z.infer<typeof TelemetryPayloadSchema>;
export type AutomationRuleInput = z.infer<typeof AutomationRuleSchema>;
