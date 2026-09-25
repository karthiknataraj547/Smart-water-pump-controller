import { RegisterSchema, LoginSchema, EmergencyResetSchema, PumpStartSchema } from '../src/index';

describe('Validation Schemas', () => {
  describe('RegisterSchema', () => {
    it('accepts valid registration input', () => {
      const res = RegisterSchema.safeParse({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'ValidPassword123!',
        phoneNumber: '+123456789'
      });
      expect(res.success).toBe(true);
    });

    it('rejects password without numbers or uppercase', () => {
      const res = RegisterSchema.safeParse({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('EmergencyResetSchema', () => {
    it('requires acknowledgedWarning to be strictly true', () => {
      const res = EmergencyResetSchema.safeParse({ acknowledgedWarning: true });
      expect(res.success).toBe(true);

      const invalid = EmergencyResetSchema.safeParse({ acknowledgedWarning: false });
      expect(invalid.success).toBe(false);
    });
  });

  describe('PumpStartSchema', () => {
    it('defaults mode to MANUAL', () => {
      const res = PumpStartSchema.safeParse({});
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.mode).toBe('MANUAL');
      }
    });
  });
});
