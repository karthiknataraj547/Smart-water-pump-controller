import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PersistentDatabaseSchema {
  users: Record<string, any>;
  sessions: Record<string, any>;
  hardware: Record<string, any>;
  mainNodes: Record<string, any>;
  subNodes: Record<string, any>;
  deviceCredentials: Record<string, any>;
  pumpStates: Record<string, any>;
  automationRules: Record<string, any>;
  automationLogs: Record<string, any>;
  sensorReadings: Record<string, any>;
  telemetryHourlys: Record<string, any>;
  deviceCommands: Record<string, any>;
  emergencyStopEvents: Record<string, any>;
  notifications: Record<string, any>;
  notificationPreferences: Record<string, any>;
}

export class PersistentDataStore {
  private filePath: string;
  private data: PersistentDatabaseSchema;

  constructor() {
    const dataDir = path.resolve(__dirname, '..', '..', '..', '.data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (_) {}
    }
    this.filePath = path.join(dataDir, 'smartpump_store.json');
    this.data = this.load();
  }

  private load(): PersistentDatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[PersistentStore] Could not load existing store, initializing empty store:', e);
    }
    return {
      users: {},
      sessions: {},
      hardware: {},
      mainNodes: {},
      subNodes: {},
      deviceCredentials: {},
      pumpStates: {},
      automationRules: {},
      automationLogs: {},
      sensorReadings: {},
      telemetryHourlys: {},
      deviceCommands: {},
      emergencyStopEvents: {},
      notifications: {},
      notificationPreferences: {},
    };
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[PersistentStore] Failed to write data file:', e);
    }
  }

  // --- USER ---
  readonly user = {
    findUnique: async (args: { where: { email?: string; id?: string }; include?: any; select?: any }) => {
      const users = Object.values(this.data.users);
      let match: any = null;
      if (args.where.id) {
        match = this.data.users[args.where.id] ?? null;
      } else if (args.where.email) {
        const lower = args.where.email.toLowerCase();
        match = users.find((u: any) => u.email.toLowerCase() === lower) ?? null;
      }
      if (!match) return null;

      const result = { ...match };
      if (args.include?._count?.select?.hardware) {
        const hardwares = Object.values(this.data.hardware).filter((h: any) => h.userId === result.id);
        result._count = { hardware: hardwares.length };
      }
      if (args.select) {
        const selected: any = {};
        for (const k of Object.keys(args.select)) {
          if (args.select[k]) selected[k] = result[k];
        }
        return selected;
      }
      return result;
    },

    findFirst: async (args: { where: any }) => {
      const users = Object.values(this.data.users);
      return users.find((u: any) => {
        for (const [k, v] of Object.entries(args.where)) {
          if (u[k] !== v) return false;
        }
        return true;
      }) ?? null;
    },

    create: async (args: { data: any; select?: any }) => {
      const id = args.data.id || crypto.randomUUID();
      const now = new Date();
      const newUser = {
        id,
        email: args.data.email.toLowerCase(),
        passwordHash: args.data.passwordHash,
        fullName: args.data.fullName,
        phoneNumber: args.data.phoneNumber ?? null,
        role: args.data.role ?? 'USER',
        createdAt: now,
        updatedAt: now,
      };

      this.data.users[id] = newUser;

      if (args.data.notificationPreferences?.create) {
        this.data.notificationPreferences[id] = {
          id: crypto.randomUUID(),
          userId: id,
          pumpAlerts: true,
          tankLevelAlerts: true,
          deviceOfflineAlerts: true,
          automationAlerts: true,
          pushToken: null,
          updatedAt: now,
        };
      }

      this.save();

      if (args.select) {
        const selected: any = {};
        for (const k of Object.keys(args.select)) {
          if (args.select[k]) selected[k] = (newUser as any)[k];
        }
        return selected;
      }
      return newUser;
    },

    update: async (args: { where: { id?: string; email?: string }; data: any }) => {
      let id = args.where.id;
      if (!id && args.where.email) {
        const match = Object.values(this.data.users).find((u: any) => u.email === args.where.email?.toLowerCase());
        id = match?.id;
      }
      if (!id || !this.data.users[id]) throw new Error('User not found');
      this.data.users[id] = { ...this.data.users[id], ...args.data, updatedAt: new Date() };
      this.save();
      return this.data.users[id];
    },

    upsert: async (args: { where: { email?: string; id?: string }; create: any; update: any }) => {
      const existing = await this.user.findUnique({ where: args.where });
      if (existing) {
        return this.user.update({ where: { id: existing.id }, data: args.update });
      }
      return this.user.create({ data: args.create });
    }
  };

  // --- SESSION ---
  readonly session = {
    create: async (args: { data: any }) => {
      const id = crypto.randomUUID();
      const newSession = {
        id,
        ...args.data,
        createdAt: new Date(),
      };
      this.data.sessions[id] = newSession;
      this.save();
      return newSession;
    },

    findUnique: async (args: { where: { id?: string; tokenHash?: string } }) => {
      if (args.where.id) return this.data.sessions[args.where.id] ?? null;
      if (args.where.tokenHash) {
        return Object.values(this.data.sessions).find((s: any) => s.tokenHash === args.where.tokenHash) ?? null;
      }
      return null;
    },

    delete: async (args: { where: { id?: string; tokenHash?: string } }) => {
      let id = args.where.id;
      if (!id && args.where.tokenHash) {
        const s: any = Object.values(this.data.sessions).find((x: any) => x.tokenHash === args.where.tokenHash);
        id = s?.id;
      }
      if (id && this.data.sessions[id]) {
        delete this.data.sessions[id];
        this.save();
      }
      return { id };
    }
  };

  // --- HARDWARE ---
  readonly hardware = {
    findUnique: async (args: { where: { id?: string; serialNumber?: string; macAddress?: string }; include?: any }) => {
      const hardwares = Object.values(this.data.hardware);
      let match: any = null;
      if (args.where.id) match = this.data.hardware[args.where.id];
      else if (args.where.serialNumber) match = hardwares.find((h: any) => h.serialNumber === args.where.serialNumber);
      else if (args.where.macAddress) match = hardwares.find((h: any) => h.macAddress === args.where.macAddress);

      if (!match) return null;
      return this.populateHardware(match, args.include);
    },

    findFirst: async (args: { where: { id?: string; userId?: string; serialNumber?: string }; include?: any }) => {
      const hardwares = Object.values(this.data.hardware);
      const match: any = hardwares.find((h: any) => {
        for (const [k, v] of Object.entries(args.where)) {
          if (h[k] !== v) return false;
        }
        return true;
      });
      if (!match) return null;
      return this.populateHardware(match, args.include);
    },

    findMany: async (args: { where?: { userId?: string }; include?: any; orderBy?: any }) => {
      let list = Object.values(this.data.hardware);
      if (args.where?.userId) {
        list = list.filter((h: any) => h.userId === args.where?.userId);
      }
      return list.map((h: any) => this.populateHardware(h, args.include));
    },

    create: async (args: { data: any; include?: any }) => {
      const id = args.data.id || crypto.randomUUID();
      const now = new Date();
      const newHw: any = {
        id,
        userId: args.data.userId,
        serialNumber: args.data.serialNumber,
        name: args.data.name || 'Main Pump Controller',
        status: args.data.status || 'ONLINE',
        firmwareVersion: args.data.firmwareVersion || '1.0.0-prod',
        lastHeartbeat: now,
        wifiSsid: args.data.wifiSsid || null,
        wifiRssi: args.data.wifiRssi || null,
        ipAddress: args.data.ipAddress || null,
        macAddress: args.data.macAddress || `MAC-${args.data.serialNumber}`,
        emergencyStopActive: args.data.emergencyStopActive || false,
        emergencyStoppedAt: null,
        createdAt: now,
        updatedAt: now,
        tankConfig: args.data.tankConfig || null,
      };

      this.data.hardware[id] = newHw;

      // Create linked pumpState
      const pumpStateId = crypto.randomUUID();
      this.data.pumpStates[id] = {
        id: pumpStateId,
        hardwareId: id,
        mode: 'MANUAL',
        state: 'OFF',
        currentRunStartedAt: null,
        totalRuntimeSeconds: 0,
        currentFlowRateLpm: 0.0,
        totalVolumePumpedL: 0.0,
        headPressureMeters: 0.0,
        lastCommandId: null,
        updatedAt: now,
      };

      // Create linked mainNode
      const mainNodeId = crypto.randomUUID();
      this.data.mainNodes[id] = {
        id: mainNodeId,
        hardwareId: id,
        esp32ChipId: `ESP32-${args.data.serialNumber}`,
        bootCount: 1,
        freeHeap: 245000,
        relayState: false,
        uptimeSeconds: 120,
        createdAt: now,
        updatedAt: now,
      };

      this.save();
      return this.populateHardware(newHw, args.include);
    },

    update: async (args: { where: { id?: string; serialNumber?: string }; data: any; include?: any }) => {
      let id = args.where.id;
      if (!id && args.where.serialNumber) {
        const found = Object.values(this.data.hardware).find((h: any) => h.serialNumber === args.where.serialNumber);
        id = (found as any)?.id;
      }
      if (!id || !this.data.hardware[id]) throw new Error('Hardware not found');
      this.data.hardware[id] = {
        ...this.data.hardware[id],
        ...args.data,
        updatedAt: new Date(),
      };
      this.save();
      return this.populateHardware(this.data.hardware[id], args.include);
    },

    upsert: async (args: { where: { serialNumber?: string; id?: string }; create: any; update: any; include?: any }) => {
      const existing = await this.hardware.findUnique({ where: args.where });
      if (existing) {
        return this.hardware.update({ where: { id: existing.id }, data: args.update, include: args.include });
      }
      return this.hardware.create({ data: args.create, include: args.include });
    }
  };

  private populateHardware(hw: any, include?: any) {
    if (!include) return { ...hw };
    const populated = { ...hw };
    if (include.pumpState) {
      populated.pumpState = this.data.pumpStates[hw.id] ?? null;
    }
    if (include.mainNode) {
      populated.mainNode = this.data.mainNodes[hw.id] ?? null;
    }
    if (include.subNodes) {
      populated.subNodes = Object.values(this.data.subNodes).filter((s: any) => s.hardwareId === hw.id);
    }
    if (include.credentials) {
      populated.credentials = this.data.deviceCredentials[hw.id] ?? null;
    }
    return populated;
  }

  // --- PUMP STATE ---
  readonly pumpState = {
    findUnique: async (args: { where: { hardwareId?: string; id?: string } }) => {
      if (args.where.hardwareId) return this.data.pumpStates[args.where.hardwareId] ?? null;
      if (args.where.id) {
        return Object.values(this.data.pumpStates).find((p: any) => p.id === args.where.id) ?? null;
      }
      return null;
    },

    update: async (args: { where: { hardwareId?: string; id?: string }; data: any }) => {
      const p = await this.pumpState.findUnique({ where: args.where });
      if (!p) throw new Error('PumpState not found');
      this.data.pumpStates[p.hardwareId] = { ...p, ...args.data, updatedAt: new Date() };
      this.save();
      return this.data.pumpStates[p.hardwareId];
    },

    updateMany: async (args: { where: { hardwareId?: string }; data: any }) => {
      if (args.where.hardwareId && this.data.pumpStates[args.where.hardwareId]) {
        this.data.pumpStates[args.where.hardwareId] = {
          ...this.data.pumpStates[args.where.hardwareId],
          ...args.data,
          updatedAt: new Date(),
        };
        this.save();
        return { count: 1 };
      }
      return { count: 0 };
    }
  };

  // --- AUTOMATION RULES ---
  readonly automationRule = {
    findMany: async (args: { where: { hardwareId?: string; userId?: string }; orderBy?: any }) => {
      let rules = Object.values(this.data.automationRules);
      if (args.where.hardwareId) rules = rules.filter((r: any) => r.hardwareId === args.where.hardwareId);
      if (args.where.userId) rules = rules.filter((r: any) => r.userId === args.where.userId);
      return rules;
    },

    create: async (args: { data: any }) => {
      const id = crypto.randomUUID();
      const newRule = { id, ...args.data, createdAt: new Date(), updatedAt: new Date() };
      this.data.automationRules[id] = newRule;
      this.save();
      return newRule;
    },

    createMany: async (args: { data: any[] }) => {
      for (const d of args.data) {
        const id = crypto.randomUUID();
        this.data.automationRules[id] = { id, ...d, createdAt: new Date(), updatedAt: new Date() };
      }
      this.save();
      return { count: args.data.length };
    },

    update: async (args: { where: { id: string }; data: any }) => {
      if (!this.data.automationRules[args.where.id]) throw new Error('Rule not found');
      this.data.automationRules[args.where.id] = {
        ...this.data.automationRules[args.where.id],
        ...args.data,
        updatedAt: new Date(),
      };
      this.save();
      return this.data.automationRules[args.where.id];
    },

    count: async (args?: { where?: any }) => {
      return Object.keys(this.data.automationRules).length;
    }
  };

  // --- SENSOR READINGS ---
  readonly sensorReading = {
    create: async (args: { data: any }) => {
      const id = crypto.randomUUID();
      const item = { id, ...args.data, timestamp: args.data.timestamp || new Date() };
      this.data.sensorReadings[id] = item;
      this.save();
      return item;
    },

    findMany: async (args: { where: { hardwareId?: string; timestamp?: any }; orderBy?: any; take?: number }) => {
      let readings = Object.values(this.data.sensorReadings);
      if (args.where.hardwareId) readings = readings.filter((r: any) => r.hardwareId === args.where.hardwareId);
      if (args.take) readings = readings.slice(-args.take);
      return readings;
    },

    deleteMany: async (args: { where: any }) => {
      return { count: 0 };
    }
  };

  // --- TELEMETRY HOURLY ---
  readonly telemetryHourly = {
    findMany: async (args: { where: { hardwareId?: string }; orderBy?: any }) => {
      return Object.values(this.data.telemetryHourlys).filter((t: any) => t.hardwareId === args.where.hardwareId);
    },

    upsert: async (args: { where: any; create: any; update: any }) => {
      const id = crypto.randomUUID();
      this.data.telemetryHourlys[id] = { id, ...args.create };
      this.save();
      return this.data.telemetryHourlys[id];
    }
  };

  // --- COMMANDS & EVENTS ---
  readonly deviceCommand = {
    create: async (args: { data: any }) => {
      const id = crypto.randomUUID();
      const cmd = { id, ...args.data, dispatchedAt: new Date() };
      this.data.deviceCommands[id] = cmd;
      this.save();
      return cmd;
    }
  };

  readonly emergencyStopEvent = {
    create: async (args: { data: any }) => {
      const id = crypto.randomUUID();
      const evt = { id, ...args.data, createdAt: new Date() };
      this.data.emergencyStopEvents[id] = evt;
      this.save();
      return evt;
    }
  };

  readonly notification = {
    create: async (args: { data: any }) => {
      const id = crypto.randomUUID();
      const n = { id, ...args.data, isRead: false, createdAt: new Date() };
      this.data.notifications[id] = n;
      this.save();
      return n;
    }
  };

  readonly automationLog = {
    create: async (args: { data: any }) => {
      const id = crypto.randomUUID();
      const log = { id, ...args.data, timestamp: new Date() };
      this.data.automationLogs[id] = log;
      this.save();
      return log;
    }
  };

  // --- TRANSACTIONS ---
  async $transaction(arg: any) {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    if (typeof arg === 'function') {
      return arg(this);
    }
    return arg;
  }

  async $disconnect() {
    return Promise.resolve();
  }
}

export const persistentStore = new PersistentDataStore();
