import { test, expect } from '@playwright/test';

test.describe('SmartPump Production Web & IoT Platform E2E Tests', () => {
  test('1. Landing Page Loads Successfully with Brand Identity', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SmartPump/i);

    // Verify Brand title or logo
    const brand = page.locator('text=SmartPump').first();
    await expect(brand).toBeVisible();

    // Verify Main Tagline / Hero Heading
    const heroText = page.locator('.hero-title, h1').filter({ hasText: /Never Let Your Tank Run Dry|SmartPump/i }).first();
    await expect(heroText).toBeVisible();
  });

  test('2. Direct APK Download Link & File Serving Integrity', async ({ page, request }) => {
    // Check that direct static download link is served with high-bandwidth 50MB+ release payload
    const directResponse = await request.get('/downloads/smartpump-latest.apk');
    expect(directResponse.status()).toBe(200);

    const length = Number(directResponse.headers()['content-length']);
    expect(length).toBeGreaterThan(50 * 1024 * 1024); // > 50 MB

    // Check that Next.js API download router (/api/download/apk) serves attachment
    const apiResponse = await request.get('/api/download/apk');
    expect(apiResponse.status()).toBe(200);
    expect(apiResponse.headers()['content-disposition']).toContain('SmartPump.apk');
    expect(Number(apiResponse.headers()['content-length'])).toBeGreaterThan(50 * 1024 * 1024);

    // Check page element for APK Download Button
    await page.goto('/');
    const downloadBtn = page.locator('a[href*="smartpump-latest.apk"]').first();
    await expect(downloadBtn).toBeVisible();
  });

  test('3. Backend Health & MQTT Real-time Broker API', async ({ request }) => {
    // Health Check
    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    const healthJson = await health.json();
    expect(healthJson.status).toBe('ok');

    // MQTT Configuration Endpoint
    const mqtt = await request.get('/api/mqtt/config');
    expect(mqtt.status()).toBe(200);
    const mqttJson = await mqtt.json();
    expect(mqttJson.broker).toBe('broker.emqx.io');
    expect(mqttJson.port).toBe(1883);
    expect(mqttJson.tlsPort).toBe(8883);
    expect(mqttJson.wsPort).toBe(8083);
  });

  test('4. Responsive Mobile Viewport Render', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const hero = page.locator('text=SmartPump').first();
    await expect(hero).toBeVisible();

    // Verify APK download link is visible on mobile viewport
    const mobileDownload = page.locator('a[href*="smartpump-latest.apk"]').first();
    await expect(mobileDownload).toBeVisible();
  });

  test('5. APK Version Metadata Endpoint Integrity', async ({ request }) => {
    const metaResp = await request.get('/api/download/version');
    expect(metaResp.status()).toBe(200);
    const meta = await metaResp.json();
    expect(meta.version).toBe('2.5.0');
    expect(meta.filename).toBe('smartpump-latest.apk');
    expect(meta.sha256).toBeTruthy();
    expect(meta.sha256.length).toBe(64); // SHA-256 hex string
    expect(meta.sizeBytes).toBeGreaterThan(50 * 1024 * 1024);
  });

  test('6. Product Catalog & Hardware Specifications Section', async ({ page }) => {
    await page.goto('/');

    // Check hardware kit cards
    const coreKit = page.locator('text=SmartPump Core Kit').first();
    await expect(coreKit).toBeVisible();

    // Check Pro Kit
    const proKit = page.locator('text=SmartPump Pro Kit').first();
    await expect(proKit).toBeVisible();
  });

  test('7. Auth API Endpoint Security Guards', async ({ request }) => {
    // Request without token should return 401 Unauthorized
    const unauthHw = await request.get('/api/hardware');
    expect(unauthHw.status()).toBe(401);
  });
});
