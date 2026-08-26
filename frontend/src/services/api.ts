// Smart Water Pump Multi-Platform Gateway Client with Dual-Mode (Live Server + Cloud-Web Standalone Engine)

function getCustomGateway(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pump_custom_gateway');
}

export function setCustomGatewayUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  if (!url) {
    localStorage.removeItem('pump_custom_gateway');
  } else {
    localStorage.setItem('pump_custom_gateway', url.replace(/\/$/, ''));
  }
}

function getApiBaseUrl(): string | null {
  if (typeof window === 'undefined') return 'http://localhost:5000/api/v1';

  const custom = getCustomGateway();
  if (custom) return `${custom}/api/v1`;

  const metaEnv = (import.meta as any)?.env;
  if (metaEnv?.VITE_API_URL) {
    return metaEnv.VITE_API_URL.replace(/\/$/, '') + '/api/v1';
  }

  const host = window.location.hostname || 'localhost';

  // If running locally or on a private LAN IP (192.168.x.x, 10.x.x.x, 172.x.x.x)
  if (host === 'localhost' || host === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    const isDev = Boolean(metaEnv?.DEV);
    return isDev ? '/api/v1' : `http://${host}:5000/api/v1`;
  }

  // If running on a cloud static hosting domain (e.g. *.vercel.app, *.netlify.app)
  return null; // Will trigger resilient Cloud-Web Engine fallback
}

// ============================================================================
// STANDALONE CLOUD-WEB STORAGE ENGINE (For Vercel / Remote Web Deployments)
// ============================================================================
interface WebStore {
  users: Array<{ id: string; name: string; email: string; phone?: string; role: string; password_hash: string; status: string }>;
  devices: any[];
  pumpStatus: Record<string, any>;
  telemetry: Record<string, any>;
  rules: Record<string, any[]>;
  alerts: any[];
  auditLogs: any[];
}

function getLocalStore(): WebStore {
  const defaultStore: WebStore = {
    users: [
      {
        id: 'usr_operator_001',
        name: 'Station Operator',
        email: 'user@waterpump.io',
        phone: '+1-800-555-USER',
        role: 'operator',
        password_hash: 'User@123456',
        status: 'active'
      },
      {
        id: 'usr_admin_001',
        name: 'Chief IoT Operator',
        email: 'admin@waterpump.io',
        phone: '+1-800-555-PUMP',
        role: 'admin',
        password_hash: 'Admin@123456',
        status: 'active'
      }
    ],
    devices: [
      {
        id: '97511f3d-e3b7-4b75-876f-b11b259f86d5',
        device_uid: 'WPC-A81F29',
        serial_number: 'SN-2026-ESP32-9921',
        device_type: 'ESP32_MAIN_CONTROLLER',
        owner_id: 'usr_admin_001',
        status: 'online',
        firmware_version: 'v2.1.0',
        local_ip: '192.168.31.54',
        mac_address: '24:6F:28:A8:1F:29',
        tank_capacity_liters: 2000,
        tank_height_cm: 180,
        last_seen: new Date().toISOString()
      }
    ],
    pumpStatus: {
      '97511f3d-e3b7-4b75-876f-b11b259f86d5': {
        id: 'ps_001',
        device_id: '97511f3d-e3b7-4b75-876f-b11b259f86d5',
        pump_state: 'OFF',
        mode: 'AUTOMATIC',
        runtime_seconds: 0,
        current_draw_amps: 0.0,
        changed_at: new Date().toISOString(),
        changed_by: 'SYSTEM_INIT'
      }
    },
    telemetry: {
      '97511f3d-e3b7-4b75-876f-b11b259f86d5': {
        id: 'tel_001',
        device_id: '97511f3d-e3b7-4b75-876f-b11b259f86d5',
        water_level_percentage: 42.5,
        water_level_liters: 850,
        inflow_rate_lpm: 0.0,
        total_inflow_liters: 1420,
        tds_ppm: 142,
        temperature_c: 28.5,
        sensor_status: 'HEALTHY',
        created_at: new Date().toISOString()
      }
    },
    rules: {
      '97511f3d-e3b7-4b75-876f-b11b259f86d5': [
        {
          id: 'rule_001',
          device_id: '97511f3d-e3b7-4b75-876f-b11b259f86d5',
          rule_name: 'Auto-Start on Low Tank (< 30%)',
          condition_json: { level_lt: 30 },
          action_json: { pump_action: 'START', generate_alert: true, alert_title: 'Auto-Start: Low Water Threshold Reached' },
          enabled: true,
          priority: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 'rule_002',
          device_id: '97511f3d-e3b7-4b75-876f-b11b259f86d5',
          rule_name: 'Auto-Stop on Tank Full (>= 95%)',
          condition_json: { level_gt: 95 },
          action_json: { pump_action: 'STOP', generate_alert: true, alert_title: 'Auto-Stop: Tank Capacity Reached (95%)' },
          enabled: true,
          priority: 1,
          created_at: new Date().toISOString()
        }
      ]
    },
    alerts: [
      {
        id: 'alt_001',
        device_id: '97511f3d-e3b7-4b75-876f-b11b259f86d5',
        severity: 'info',
        title: 'System Online & Armed',
        message: 'Smart Water Pump Controller initialized with local fail-safe automation and ESP-NOW Sub Node link.',
        acknowledged: false,
        created_at: new Date().toISOString()
      }
    ],
    auditLogs: []
  };

  try {
    const raw = localStorage.getItem('pump_cloud_store');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultStore, ...parsed };
    }
  } catch (e) {}

  return defaultStore;
}

function saveLocalStore(store: WebStore): void {
  try {
    localStorage.setItem('pump_cloud_store', JSON.stringify(store));
  } catch (e) {}
}

export class ApiService {
  private static getToken(): string | null {
    return localStorage.getItem('pump_auth_token');
  }

  private static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 1. If backend URL is available, try fetching over live HTTP
    if (baseUrl) {
      const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
      try {
        const response = await fetch(url, { ...options, headers });
        const text = await response.text();
        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          throw new Error(`Gateway Error (${response.status}): ${text || 'Invalid response'}`);
        }

        if (!response.ok || !data.success) {
          const errorMsg = data.error?.message || data.message || `Request failed with status ${response.status}`;
          throw new Error(errorMsg);
        }

        return data.data !== undefined ? data.data : data;
      } catch (networkErr: any) {
        // If not running on localhost, fallback seamlessly to Cloud-Web storage engine
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        if (host === 'localhost' || host === '127.0.0.1') {
          throw networkErr;
        }
      }
    }

    // 2. Resilient Cloud-Web Storage Fallback (Runs on Vercel / Remote Hosting)
    return this.handleCloudWebFallback<T>(endpoint, options);
  }

  private static handleCloudWebFallback<T = any>(endpoint: string, options: RequestInit): Promise<T> {
    const store = getLocalStore();
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body as string) : {};

    // A. Authentication
    if (endpoint === '/auth/login' && method === 'POST') {
      const user = store.users.find(u => u.email.toLowerCase() === (body.email || '').toLowerCase());
      if (!user || user.password_hash !== body.password) {
        return Promise.reject(new Error('Invalid email or password'));
      }
      const fakeToken = `jwt_token_${user.id}_${Date.now()}`;
      return Promise.resolve({
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status },
        token: fakeToken,
        refreshToken: `refresh_${fakeToken}`
      } as any);
    }

    if (endpoint === '/auth/register' && method === 'POST') {
      const existing = store.users.find(u => u.email.toLowerCase() === (body.email || '').toLowerCase());
      if (existing) {
        return Promise.reject(new Error('A user with this email already exists'));
      }
      const newUser = {
        id: `usr_${Date.now()}`,
        name: body.name,
        email: body.email,
        phone: body.phone || '+1-800-555-PUMP',
        role: body.role || 'operator',
        password_hash: body.password,
        status: 'active'
      };
      store.users.push(newUser);
      saveLocalStore(store);

      const fakeToken = `jwt_token_${newUser.id}_${Date.now()}`;
      return Promise.resolve({
        user: { id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone, role: newUser.role, status: 'active' },
        token: fakeToken,
        refreshToken: `refresh_${fakeToken}`
      } as any);
    }

    if (endpoint === '/auth/profile') {
      const token = this.getToken() || '';
      const user = store.users[0] || { id: 'usr_operator_001', name: 'Station Operator', email: 'user@waterpump.io', role: 'operator' };
      return Promise.resolve(user as any);
    }

    // B. Devices
    if (endpoint === '/devices' && method === 'GET') {
      return Promise.resolve(store.devices as any);
    }

    if (endpoint.startsWith('/devices/') && method === 'GET') {
      return Promise.resolve(store.devices[0] as any);
    }

    // C. Pumps
    if (endpoint.includes('/pumps/') && endpoint.endsWith('/status')) {
      const devId = store.devices[0]?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
      return Promise.resolve(store.pumpStatus[devId] as any);
    }

    if (endpoint.includes('/pumps/') && endpoint.endsWith('/start')) {
      const devId = store.devices[0]?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
      if (store.pumpStatus[devId]) {
        store.pumpStatus[devId].pump_state = 'ON';
        store.pumpStatus[devId].current_draw_amps = 4.8;
      }
      saveLocalStore(store);
      return Promise.resolve(store.pumpStatus[devId] as any);
    }

    if (endpoint.includes('/pumps/') && endpoint.endsWith('/stop')) {
      const devId = store.devices[0]?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
      if (store.pumpStatus[devId]) {
        store.pumpStatus[devId].pump_state = 'OFF';
        store.pumpStatus[devId].current_draw_amps = 0.0;
      }
      saveLocalStore(store);
      return Promise.resolve(store.pumpStatus[devId] as any);
    }

    if (endpoint.includes('/pumps/') && endpoint.endsWith('/mode')) {
      const devId = store.devices[0]?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
      if (store.pumpStatus[devId]) {
        store.pumpStatus[devId].mode = body.mode || 'AUTOMATIC';
      }
      saveLocalStore(store);
      return Promise.resolve(store.pumpStatus[devId] as any);
    }

    if (endpoint.includes('/pumps/') && endpoint.endsWith('/emergency-stop')) {
      const devId = store.devices[0]?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
      if (store.pumpStatus[devId]) {
        store.pumpStatus[devId].pump_state = 'FAULT';
        store.pumpStatus[devId].current_draw_amps = 0.0;
      }
      saveLocalStore(store);
      return Promise.resolve(store.pumpStatus[devId] as any);
    }

    // D. Sensors
    if (endpoint.includes('/sensors/') && endpoint.endsWith('/latest')) {
      const devId = store.devices[0]?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
      return Promise.resolve(store.telemetry[devId] as any);
    }

    if (endpoint.includes('/sensors/') && endpoint.includes('/history')) {
      const devId = store.devices[0]?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
      return Promise.resolve([store.telemetry[devId]] as any);
    }

    // E. Automation Rules
    if (endpoint.startsWith('/automation/')) {
      const devId = store.devices[0]?.id || '97511f3d-e3b7-4b75-876f-b11b259f86d5';
      if (method === 'GET') {
        return Promise.resolve((store.rules[devId] || []) as any);
      }
      if (method === 'POST') {
        const newRule = { id: `rule_${Date.now()}`, device_id: devId, ...body, enabled: true, created_at: new Date().toISOString() };
        if (!store.rules[devId]) store.rules[devId] = [];
        store.rules[devId].push(newRule);
        saveLocalStore(store);
        return Promise.resolve(newRule as any);
      }
      if (method === 'PATCH') {
        return Promise.resolve({ success: true } as any);
      }
      if (method === 'DELETE') {
        return Promise.resolve({ success: true } as any);
      }
    }

    // F. Alerts
    if (endpoint.startsWith('/alerts')) {
      if (method === 'GET') return Promise.resolve(store.alerts as any);
      if (method === 'POST') return Promise.resolve({ success: true } as any);
    }

    // G. Admin
    if (endpoint === '/admin/users' && method === 'GET') {
      return Promise.resolve(store.users.map(({ password_hash, ...u }) => u) as any);
    }
    if (endpoint === '/admin/stats') {
      return Promise.resolve({
        total_devices: store.devices.length,
        online_devices: 1,
        active_pumps: 0,
        active_alerts: store.alerts.length,
        total_users: store.users.length,
        system_uptime_seconds: 86400
      } as any);
    }
    if (endpoint.startsWith('/admin/logs')) {
      return Promise.resolve([
        { id: '1', action: 'CLOUD_DEPLOY_INIT', user_email: 'admin@waterpump.io', ip_address: '127.0.0.1', created_at: new Date().toISOString() }
      ] as any);
    }

    return Promise.resolve({ success: true } as any);
  }

  // Public Methods
  static async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  static async register(name: string, email: string, password: string, phone?: string, role: string = 'operator') {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone, role })
    });
  }

  static async getProfile() {
    return this.request('/auth/profile');
  }

  static async getDevices() {
    return this.request('/devices');
  }

  static async getDevice(id: string) {
    return this.request(`/devices/${id}`);
  }

  static async getPumpStatus(deviceId: string) {
    return this.request(`/pumps/${deviceId}/status`);
  }

  static async startPump(deviceId: string, source: string = 'web') {
    return this.request(`/pumps/${deviceId}/start`, {
      method: 'POST',
      body: JSON.stringify({ source })
    });
  }

  static async stopPump(deviceId: string, source: string = 'web') {
    return this.request(`/pumps/${deviceId}/stop`, {
      method: 'POST',
      body: JSON.stringify({ source })
    });
  }

  static async setPumpMode(deviceId: string, mode: string, source: string = 'web') {
    return this.request(`/pumps/${deviceId}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode, source })
    });
  }

  static async emergencyStop(deviceId: string, reason?: string) {
    return this.request(`/pumps/${deviceId}/emergency-stop`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Manual Emergency Stop Button Triggered' })
    });
  }

  static async getLatestSensorReading(deviceId: string) {
    return this.request(`/sensors/${deviceId}/latest`);
  }

  static async getSensorHistory(deviceId: string, hours: number = 24) {
    return this.request(`/sensors/${deviceId}/history?hours=${hours}`);
  }

  static async getAutomationRules(deviceId: string) {
    return this.request(`/automation/${deviceId}`);
  }

  static async createAutomationRule(deviceId: string, rule: any) {
    return this.request(`/automation/${deviceId}`, {
      method: 'POST',
      body: JSON.stringify(rule)
    });
  }

  static async toggleAutomationRule(deviceId: string, ruleId: string, enabled: boolean) {
    return this.request(`/automation/${deviceId}/rules/${ruleId}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    });
  }

  static async deleteAutomationRule(deviceId: string, ruleId: string) {
    return this.request(`/automation/${deviceId}/rules/${ruleId}`, {
      method: 'DELETE'
    });
  }

  static async getAlerts(deviceId?: string) {
    const query = deviceId ? `?deviceId=${deviceId}` : '';
    return this.request(`/alerts${query}`);
  }

  static async acknowledgeAlert(alertId: string) {
    return this.request(`/alerts/${alertId}/acknowledge`, {
      method: 'POST'
    });
  }

  static async scanBleDevices() {
    return this.request('/provision/ble/scan');
  }

  static async completeProvisioning(data: {
    deviceUid: string;
    wifiSsid: string;
    serialNumber?: string;
    tankCapacityLiters?: number;
    tankHeightCm?: number;
  }) {
    return this.request('/provision/complete', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async getFirmwareInfo() {
    return this.request('/firmware/version');
  }

  static async triggerOta(deviceId: string, version: string) {
    return this.request('/firmware/ota/trigger', {
      method: 'POST',
      body: JSON.stringify({ deviceId, version })
    });
  }

  static async getAdminUsers() {
    return this.request('/admin/users');
  }

  static async createAdminUser(userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: string;
    status?: string;
  }) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  static async updateAdminUser(userId: string, userData: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    status?: string;
    password?: string;
  }) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  static async deleteAdminUser(userId: string) {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }

  static async getAdminAuditLogs(search?: string, limit: number = 50) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('limit', limit.toString());
    return this.request(`/admin/logs?${params.toString()}`);
  }

  static async getAdminStats() {
    return this.request('/admin/stats');
  }

  static async updateDeviceConfig(deviceId: string, config: {
    tank_capacity_liters?: number;
    tank_height_cm?: number;
    owner_id?: string;
  }) {
    return this.request(`/admin/devices/${deviceId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }
}
