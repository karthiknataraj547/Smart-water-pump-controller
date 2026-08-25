const API_BASE = '/api/v1';

export class ApiService {
  private static getToken(): string | null {
    return localStorage.getItem('pump_auth_token');
  }

  private static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.error?.message || data.message || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data.data !== undefined ? data.data : data;
  }

  // Authentication
  static async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  static async register(name: string, email: string, password: string, phone?: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone })
    });
  }

  static async getProfile() {
    return this.request('/auth/profile');
  }

  // Devices
  static async getDevices() {
    return this.request('/devices');
  }

  static async getDevice(id: string) {
    return this.request(`/devices/${id}`);
  }

  // Pump Control
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

  // Sensors & Telemetry
  static async getLatestSensorReading(deviceId: string) {
    return this.request(`/sensors/${deviceId}/latest`);
  }

  static async getSensorHistory(deviceId: string, hours: number = 24) {
    return this.request(`/sensors/${deviceId}/history?hours=${hours}`);
  }

  // Automation Rules
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

  // Alerts
  static async getAlerts(deviceId?: string) {
    const query = deviceId ? `?deviceId=${deviceId}` : '';
    return this.request(`/alerts${query}`);
  }

  static async acknowledgeAlert(alertId: string) {
    return this.request(`/alerts/${alertId}/acknowledge`, {
      method: 'POST'
    });
  }

  // Provisioning
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

  // Firmware & OTA
  static async getFirmwareInfo() {
    return this.request('/firmware/version');
  }

  static async triggerOta(deviceId: string, version: string) {
    return this.request('/firmware/ota/trigger', {
      method: 'POST',
      body: JSON.stringify({ deviceId, version })
    });
  }

  // =========================================================================
  // ADMIN COMMAND CENTER API
  // =========================================================================
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

