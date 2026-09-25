'use client';

import React, { useState, useEffect } from 'react';
import {
  Waves,
  Zap,
  Activity,
  ShieldCheck,
  Cpu,
  Download,
  ArrowRight,
  Power,
  AlertTriangle,
  RefreshCw,
  Droplets,
  Gauge,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Radio,
  Sliders,
  Smartphone,
  Lock,
  Unlock,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Star,
  Truck,
  RotateCcw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calculator,
  X,
  Menu,
  Bluetooth,
  QrCode,
  Bell,
  Wifi
} from 'lucide-react';

// Product Catalog Data
interface Product {
  id: string;
  name: string;
  category: 'kit' | 'sensor' | 'relay';
  ribbon?: string;
  isFeatured?: boolean;
  price: number;
  originalPrice: number;
  rating: number;
  reviewsCount: number;
  tagline: string;
  specs: string[];
  inStock: boolean;
}

const PRODUCTS: Product[] = [
  {
    id: 'sp-core-kit',
    name: 'SmartPump Core Kit (Home)',
    category: 'kit',
    ribbon: 'BESTSELLER',
    isFeatured: true,
    price: 149,
    originalPrice: 199,
    rating: 4.9,
    reviewsCount: 842,
    tagline: 'Ideal for independent houses, villas, and single overhead tanks.',
    specs: [
      '1x ESP32 Gateway Hub (WiFi + BLE + MQTT)',
      '1x Ultrasonic Sub-Node Pod (±2mm accuracy)',
      '1x 25A Solid-State Contactor (Single-Phase)',
      'Complete Flutter Mobile App Access & Cloud Sync'
    ],
    inStock: true
  },
  {
    id: 'sp-pro-kit',
    name: 'SmartPump Pro Kit (Multi-Tank)',
    category: 'kit',
    ribbon: 'MOST POPULAR',
    isFeatured: false,
    price: 299,
    originalPrice: 379,
    rating: 5.0,
    reviewsCount: 421,
    tagline: 'Designed for duplexes, apartments, and sump-to-overhead dual setups.',
    specs: [
      '1x ESP32 Dual-Radio Gateway Controller',
      '2x Ultrasonic Sensor Pods (Sump + Overhead Tank)',
      '1x DN25 Inline Hall Turbine Flow Meter',
      '1x Industrial TDS Potability Probe',
      '1x 40A Heavy-Duty Contactor Relay (Up to 3 HP)'
    ],
    inStock: true
  },
  {
    id: 'sp-enterprise-kit',
    name: 'SmartPump Enterprise SCADA',
    category: 'kit',
    ribbon: 'INDUSTRIAL GRADE',
    isFeatured: false,
    price: 599,
    originalPrice: 749,
    rating: 4.95,
    reviewsCount: 168,
    tagline: 'For agricultural borewells, gated communities, and commercial factories.',
    specs: [
      '1x IP67 Weatherproof Solar-Ready Gateway Hub',
      'LoRa Long-Range 5km Wireless Transceiver',
      '1x 3-Phase 63A Contactor Relay (Up to 10 HP)',
      'High-Flow DN50 Ultrasonic Velocity Sensor',
      'On-Premises SCADA Docker Container & Cloud REST API'
    ],
    inStock: true
  },
  {
    id: 'sp-sensor-pod',
    name: 'Ultrasonic Sub-Node Sensor Pod',
    category: 'sensor',
    price: 49,
    originalPrice: 65,
    rating: 4.8,
    reviewsCount: 230,
    tagline: 'Add extra monitoring pods to underground sumps, borewells, or rainwater tanks.',
    specs: [
      'Millimeter-grade ultrasonic echo detection',
      'ESP-NOW direct wireless mesh transceiver',
      'IP68 fully waterproof sealed enclosure',
      '2-Year battery life (optional solar input)'
    ],
    inStock: true
  },
  {
    id: 'sp-flow-meter',
    name: 'DN25 Inline Hall Flow Turbine',
    category: 'sensor',
    price: 39,
    originalPrice: 55,
    rating: 4.9,
    reviewsCount: 189,
    tagline: 'Instantaneous dry-run detection and flow rate velocity measurement.',
    specs: [
      'Measurement range: 1 - 60 Liters/Minute',
      'Forged brass 1" male pipe threads',
      'Dry-run shutoff signal within 2.5 seconds',
      'Sub-second pulse counter accuracy'
    ],
    inStock: true
  },
  {
    id: 'sp-relay-40a',
    name: '40A Solid-State Contactor Relay',
    category: 'relay',
    price: 35,
    originalPrice: 45,
    rating: 4.9,
    reviewsCount: 142,
    tagline: 'Zero-sparking optoisolated relay designed for high inductive motor loads.',
    specs: [
      'Rated 40A Continuous / 250V AC Inductive',
      'Zero-crossing optoisolated switching',
      'Tested to 10,000,000 switching cycles',
      'Standard 35mm DIN-rail industrial mounting'
    ],
    inStock: true
  }
];

interface CartItem {
  product: Product;
  quantity: number;
}

type ControlMode = 'MANUAL' | 'AUTO';
type AnalyticsParam = 'level' | 'flow' | 'tds' | 'power';
type PhoneScreenTab = 'dashboard' | 'pump' | 'nodes' | 'analytics';

export default function HomePage() {
  // Mobile Navigation Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // E-Commerce Cart & Checkout State
  const [cart, setCart] = useState<CartItem[]>([
    { product: PRODUCTS[0], quantity: 1 }
  ]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [orderPlaced, setOrderPlaced] = useState<boolean>(false);
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | 'kit' | 'sensor' | 'relay'>('all');
  const [promoCode, setPromoCode] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [promoError, setPromoError] = useState<string>('');

  // Mobile App Phone Mockup Tab
  const [phoneTab, setPhoneTab] = useState<PhoneScreenTab>('dashboard');

  // ROI Calculator State
  const [calcTanks, setCalcTanks] = useState<number>(1);
  const [calcHp, setCalcHp] = useState<number>(2.0);
  const [calcHours, setCalcHours] = useState<number>(1.5);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // SCADA Simulation State
  const [mode, setMode] = useState<ControlMode>('MANUAL');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState<boolean>(false);
  const [tankLevel, setTankLevel] = useState<number>(74.5);
  const [flowRate, setFlowRate] = useState<number>(0.0);
  const [motorRpm, setMotorRpm] = useState<number>(0);
  const [runSeconds, setRunSeconds] = useState<number>(142);
  const [selectedParam, setSelectedParam] = useState<AnalyticsParam>('level');
  const [copied, setCopied] = useState<boolean>(false);
  const [eventLogs, setEventLogs] = useState<string[]>([
    '09:40:12 [GATEWAY] ESP32 heartbeat acknowledged. RSSI: -54 dBm',
    '09:41:05 [SUB-NODE] ESP-NOW frame received: Tank ultrasonic = 74.5%',
    '09:42:30 [HEALTH] All dual-node safety bounds normal. Contactor relay open.'
  ]);

  // Periodic simulation loop
  useEffect(() => {
    const timer = setInterval(() => {
      if (isRunning && !isEmergencyStopped) {
        setRunSeconds((s) => s + 1);
        setTankLevel((prev) => {
          const next = prev + 0.15;
          if (next >= 98.0) {
            setIsRunning(false);
            setFlowRate(0.0);
            setMotorRpm(0);
            setEventLogs((logs) => [
              `${new Date().toLocaleTimeString()} [AUTO-CUTOFF] Tank high limit reached (98%). Pump stopped.`,
              ...logs.slice(0, 5)
            ]);
            return 98.0;
          }
          return parseFloat(next.toFixed(1));
        });
        setFlowRate(38.2 + (Math.random() * 0.8 - 0.4));
        setMotorRpm(2850 + Math.floor(Math.random() * 12 - 6));
      } else {
        setFlowRate(0.0);
        setMotorRpm(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, isEmergencyStopped]);

  // Cart Management
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = (cartSubtotal * discountPercent) / 100;
  const shippingCost = cartSubtotal >= 100 || cart.length === 0 ? 0 : 15;
  const cartTotal = cartSubtotal - discountAmount + shippingCost;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const applyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'SMARTPUMP10') {
      setDiscountPercent(10);
      setPromoError('');
    } else {
      setPromoError('Invalid coupon code. Try SMARTPUMP10 for 10% off.');
    }
  };

  // ROI Computations
  const monthlyKwhSaved = Math.round(calcHp * 0.746 * calcHours * 30 * 0.28);
  const monthlyElectricitySaved = Math.round(monthlyKwhSaved * 0.16);
  const monthlyWaterSavedLiters = Math.round(calcTanks * 1000 * 0.22 * 30);
  const paybackMonths = ((149 / Math.max(1, monthlyElectricitySaved + 15))).toFixed(1);

  // SCADA Controls
  const handleStartPump = () => {
    if (isEmergencyStopped) return;
    setIsRunning(true);
    setFlowRate(38.4);
    setMotorRpm(2850);
    setEventLogs((logs) => [
      `${new Date().toLocaleTimeString()} [REST API] POST /v1/pump/start -> Contactor Relay ENERGIZED (ACK 42ms)`,
      ...logs.slice(0, 5)
    ]);
  };

  const handleStopPump = () => {
    setIsRunning(false);
    setFlowRate(0.0);
    setMotorRpm(0);
    setEventLogs((logs) => [
      `${new Date().toLocaleTimeString()} [REST API] POST /v1/pump/stop -> Contactor Relay OPENED (ACK 38ms)`,
      ...logs.slice(0, 5)
    ]);
  };

  const handleEmergencyStop = () => {
    setIsEmergencyStopped(true);
    setIsRunning(false);
    setFlowRate(0.0);
    setMotorRpm(0);
    setEventLogs((logs) => [
      `${new Date().toLocaleTimeString()} [CRITICAL] EMERGENCY STOP TRIPPED. Local contactor hardware latch locked!`,
      ...logs.slice(0, 5)
    ]);
  };

  const handleResetEmergency = () => {
    setIsEmergencyStopped(false);
    setEventLogs((logs) => [
      `${new Date().toLocaleTimeString()} [SAFETY] Emergency latch cleared by operator. Standby restored.`,
      ...logs.slice(0, 5)
    ]);
  };

  const formatRunTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const filteredProducts = productCategoryFilter === 'all'
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === productCategoryFilter);

  // Analytics curves data points for Single-Parameter curves
  const curvesData: Record<AnalyticsParam, {
    label: string;
    unit: string;
    min: string;
    avg: string;
    peak: string;
    color: string;
    points: string;
    polygon: string;
  }> = {
    level: {
      label: 'Tank Level (%)',
      unit: '%',
      min: '32.0%',
      avg: '68.4%',
      peak: '96.2%',
      color: '#0284C7',
      points: '0,80 50,75 100,78 150,60 200,50 250,42 300,45 350,38 400,30 450,28 500,24',
      polygon: '0,80 50,75 100,78 150,60 200,50 250,42 300,45 350,38 400,30 450,28 500,24 500,100 0,100'
    },
    flow: {
      label: 'Flow Velocity (LPM)',
      unit: 'LPM',
      min: '0.0 LPM',
      avg: '28.1 LPM',
      peak: '39.8 LPM',
      color: '#10B981',
      points: '0,95 50,95 100,95 120,20 180,22 240,21 300,20 360,95 420,95 470,22 500,21',
      polygon: '0,95 50,95 100,95 120,20 180,22 240,21 300,20 360,95 420,95 470,22 500,21 500,100 0,100'
    },
    tds: {
      label: 'Water Purity (TDS ppm)',
      unit: 'ppm',
      min: '138 ppm',
      avg: '143 ppm',
      peak: '151 ppm',
      color: '#0EA5E9',
      points: '0,45 60,44 120,46 180,48 240,42 300,43 360,40 420,44 480,45 500,44',
      polygon: '0,45 60,44 120,46 180,48 240,42 300,43 360,40 420,44 480,45 500,44 500,100 0,100'
    },
    power: {
      label: 'Motor Power (kW)',
      unit: 'kW',
      min: '0.0 kW',
      avg: '1.42 kW',
      peak: '1.85 kW',
      color: '#D97706',
      points: '0,95 70,95 110,95 130,28 200,29 270,30 330,95 400,95 450,28 500,29',
      polygon: '0,95 70,95 110,95 130,28 200,29 270,30 330,95 400,95 450,28 500,29 500,100 0,100'
    }
  };

  const activeCurve = curvesData[selectedParam];

  return (
    <>
      {/* Top Value Announcement Bar */}
      <div className="announcement-bar">
        <span className="announcement-badge">LIMITED TIME OFFER</span>
        <span>
          Save up to $80 on SmartPump Complete Kits &bull; Free Global Express Shipping over $100 &bull; 2-Year Replacement Warranty
        </span>
        <a href="#products">Shop Kits &rarr;</a>
      </div>

      {/* Precision SCADA & Consumer Navigation Bar */}
      <header className="header">
        <div className="container nav">
          <a href="#" className="logo-wrap">
            <span className="logo-badge">
              <Droplets size={20} />
            </span>
            <div>
              <div className="logo-text-title">SmartPump</div>
              <div className="logo-text-sub">IoT Water Automation Systems</div>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="nav-links">
            <a href="#products" className="nav-link">Products & Kits</a>
            <a href="#app" className="nav-link" style={{ color: 'var(--color-primary)', fontWeight: 800 }}>Mobile App</a>
            <a href="#simulator" className="nav-link">Live Simulator</a>
            <a href="#roi" className="nav-link">Savings Calculator</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#compare" className="nav-link">Compare</a>
            <a href="#faq" className="nav-link">FAQ</a>
          </nav>

          {/* Actions & Mobile Hamburger */}
          <div className="nav-actions">
            <button
              type="button"
              className="cart-trigger-btn"
              onClick={() => setIsCartOpen(true)}
              aria-label="View Shopping Cart"
            >
              <ShoppingCart size={17} />
              <span>Cart</span>
              {totalItemsCount > 0 && (
                <span className="cart-badge-count">{totalItemsCount}</span>
              )}
            </button>

            <a href="#products" className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Order Starter Kit
            </a>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Drawer */}
        <div className={`mobile-menu-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
          <a 
            href="#products" 
            className="mobile-menu-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>Hardware Store &amp; Kits</span>
            <ArrowRight size={16} />
          </a>
          <a 
            href="#app" 
            className="mobile-menu-link"
            style={{ color: 'var(--color-primary)' }}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>📱 SmartPump Mobile App</span>
            <ArrowRight size={16} />
          </a>
          <a 
            href="#simulator" 
            className="mobile-menu-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>Live Interactive Simulator</span>
            <ArrowRight size={16} />
          </a>
          <a 
            href="#roi" 
            className="mobile-menu-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>Electricity &amp; ROI Calculator</span>
            <ArrowRight size={16} />
          </a>
          <a 
            href="#features" 
            className="mobile-menu-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>Engineering Architecture</span>
            <ArrowRight size={16} />
          </a>
          <a 
            href="#compare" 
            className="mobile-menu-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>Head-to-Head Comparison</span>
            <ArrowRight size={16} />
          </a>
          <a 
            href="#faq" 
            className="mobile-menu-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>Installation FAQ</span>
            <ArrowRight size={16} />
          </a>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <a 
              href="#app" 
              className="btn-primary" 
              style={{ flex: 1, textDecoration: 'none' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Smartphone size={16} />
              Get Mobile App
            </a>
            <a 
              href="#products" 
              className="btn-secondary" 
              style={{ flex: 1, textDecoration: 'none' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Shop Kits
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Conversion Marketing Hero Section */}
        <section className="hero">
          <div className="container">
            <div className="hero-pill-badge">
              <span className="status-dot-pulse"></span>
              ★ RATED 4.9/5 BY 1,400+ HOMEOWNERS & COMMERCIAL PROPERTIES
            </div>

            <h1 className="hero-title">
              Never Let Your Tank Run Dry. <span className="highlight">Never Let It Overflow.</span>
            </h1>

            <p className="hero-description">
              The complete plug-and-play IoT hardware platform. Replaces fragile mechanical float switches with dual-node millimeter ultrasonic telemetry, automatic dry-run motor shutoffs, and zero-trust safety relays.
            </p>

            <div className="hero-button-group">
              <a href="#products" className="btn-primary" style={{ padding: '12px 24px', fontSize: '15px' }}>
                <ShoppingCart size={18} />
                Shop Hardware Kits — From $149
              </a>
              <a href="#app" className="btn-secondary" style={{ padding: '12px 22px', fontSize: '15px' }}>
                <Smartphone size={18} />
                Explore Mobile App (Android APK)
              </a>
              <a href="#simulator" className="btn-secondary" style={{ padding: '12px 22px', fontSize: '15px' }}>
                <Gauge size={18} />
                Try Interactive Simulator
              </a>
            </div>

            {/* Trust Proof Metrics Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', background: '#FFFFFF', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', padding: '18px 24px', boxShadow: 'var(--shadow-sm)', marginBottom: '56px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Truck size={24} color="var(--color-primary)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Free Shipping</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Orders over $100</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldCheck size={24} color="var(--color-emerald)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>2-Year Warranty</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Instant replacements</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <RotateCcw size={24} color="var(--color-amber)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>30-Day Guarantee</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>100% Risk-free returns</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Zap size={24} color="var(--color-primary)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Universal Fit</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>0.5 HP to 10 HP motors</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================================================
            INTERACTIVE MOBILE APP SHOWCASE SECTION
            ========================================================================== */}
        <section id="app" className="app-showcase-section">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">NATIVE FLUTTER MOBILE EXPERIENCE</span>
              <h2 className="section-title">The Complete Mobile App in Your Pocket</h2>
              <p className="section-desc">
                Interact with the mobile app simulator below. Switch tabs to preview real-time 2D spatial fluid physics, deterministic pump control, device mesh topology, and single-parameter telemetry curves.
              </p>
            </div>

            <div className="app-showcase-grid">
              {/* Smartphone Mockup */}
              <div className="phone-mockup-wrapper">
                <div className="phone-mockup-frame">
                  {/* Dynamic Island / Speaker Notch */}
                  <div className="phone-dynamic-island">
                    <div className="camera-lens"></div>
                  </div>

                  <div className="phone-screen">
                    {/* Status Bar */}
                    <div className="phone-status-bar">
                      <span>09:41</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Wifi size={13} />
                        <span style={{ fontSize: '10px' }}>5G</span>
                        <div style={{ width: '18px', height: '9px', border: '1px solid var(--text-main)', borderRadius: '2px', padding: '1px', display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: '80%', height: '100%', background: 'var(--color-emerald)' }}></div>
                        </div>
                      </div>
                    </div>

                    {/* App Header Inside Phone */}
                    <div style={{ padding: '12px 14px 8px', background: '#FFFFFF', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--color-primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Droplets size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>Central Tank #1</div>
                          <div style={{ fontSize: '9.5px', color: 'var(--color-emerald)', fontWeight: 700 }}>● ESP-NOW MESH ACTIVE</div>
                        </div>
                      </div>
                      <Bell size={16} color="var(--text-secondary)" />
                    </div>

                    {/* Dynamic Phone Content Based on Active Tab */}
                    <div className="phone-app-content">
                      {phoneTab === 'dashboard' && (
                        <>
                          {/* 2D Spatial Fluid Card */}
                          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', boxShadow: 'var(--shadow-xs)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                              <span>WATER RESERVOIR</span>
                              <span style={{ color: 'var(--color-primary)' }}>{tankLevel.toFixed(1)}% ({Math.round(tankLevel * 10)} L)</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {/* Mini Tank */}
                              <div style={{ width: '110px', height: '120px', background: '#F1F5F9', border: '2px solid var(--border-medium)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${tankLevel}%`, background: 'linear-gradient(180deg, #38BDF8, #0284C7)', transition: 'height 0.4s ease' }}>
                                  <div style={{ position: 'absolute', top: '-4px', left: 0, right: 0, height: '8px', background: 'rgba(255,255,255,0.4)', borderRadius: '50%' }}></div>
                                </div>
                                <div style={{ position: 'absolute', top: '8px', right: '6px', fontSize: '10px', fontWeight: 900, color: '#0F172A', background: 'rgba(255,255,255,0.9)', padding: '2px 4px', borderRadius: '4px' }}>
                                  {tankLevel.toFixed(1)}%
                                </div>
                              </div>

                              {/* Mini Motor & Flow */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Flow Velocity</div>
                                  <div style={{ fontSize: '15px', fontWeight: 900, color: isRunning ? 'var(--color-emerald)' : 'var(--text-main)' }}>
                                    {isRunning ? `${flowRate.toFixed(1)} LPM` : '0.0 LPM'}
                                  </div>
                                </div>

                                <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Pump Contactor</div>
                                  <div style={{ fontSize: '13px', fontWeight: 800, color: isRunning ? 'var(--color-emerald)' : 'var(--text-secondary)' }}>
                                    {isRunning ? 'ENERGIZED' : 'IDLE'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Quick Controls Pill */}
                          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '10px', display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ flex: 1, padding: '8px', fontSize: '11px', background: isRunning ? '#94A3B8' : 'var(--color-emerald)' }}
                              disabled={isRunning}
                              onClick={handleStartPump}
                            >
                              <Power size={13} /> START
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ flex: 1, padding: '8px', fontSize: '11px' }}
                              disabled={!isRunning}
                              onClick={handleStopPump}
                            >
                              STOP
                            </button>
                          </div>

                          {/* Mini Telemetry Pill Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '8px' }}>
                              <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', display: 'block' }}>TDS PURITY</span>
                              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>142 ppm</strong>
                            </div>
                            <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '8px' }}>
                              <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', display: 'block' }}>CYCLE RUNTIME</span>
                              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{formatRunTime(runSeconds)}</strong>
                            </div>
                          </div>
                        </>
                      )}

                      {phoneTab === 'pump' && (
                        <>
                          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                              PUMP OPERATING MODE
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg-app)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                              <button
                                type="button"
                                style={{ padding: '8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', background: mode === 'MANUAL' ? '#FFFFFF' : 'transparent', color: mode === 'MANUAL' ? 'var(--color-primary)' : 'var(--text-secondary)' }}
                                onClick={() => setMode('MANUAL')}
                              >
                                MANUAL
                              </button>
                              <button
                                type="button"
                                style={{ padding: '8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', background: mode === 'AUTO' ? '#FFFFFF' : 'transparent', color: mode === 'AUTO' ? 'var(--color-primary)' : 'var(--text-secondary)' }}
                                onClick={() => setMode('AUTO')}
                              >
                                AUTO
                              </button>
                            </div>

                            {mode === 'MANUAL' ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ flex: 1, padding: '10px', fontSize: '12px', background: isRunning ? '#94A3B8' : 'var(--color-emerald)' }}
                                  disabled={isRunning || isEmergencyStopped}
                                  onClick={handleStartPump}
                                >
                                  START PUMP
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                                  disabled={!isRunning || isEmergencyStopped}
                                  onClick={handleStopPump}
                                >
                                  STOP PUMP
                                </button>
                              </div>
                            ) : (
                              <div style={{ background: 'var(--bg-accent-soft)', border: '1px dashed var(--border-accent)', borderRadius: '6px', padding: '10px', fontSize: '11px', color: 'var(--text-body)' }}>
                                <strong>⚡ Automation Rules Enforced</strong>
                                <p style={{ fontSize: '10px', marginTop: '2px' }}>Auto-start &lt; 25% &bull; Cutoff &ge; 90%</p>
                              </div>
                            )}

                            <button
                              type="button"
                              className="btn-danger"
                              style={{ width: '100%', padding: '10px', fontSize: '12px' }}
                              onClick={isEmergencyStopped ? handleResetEmergency : handleEmergencyStop}
                            >
                              <AlertTriangle size={15} />
                              {isEmergencyStopped ? 'RESET ESTOP LATCH' : 'EMERGENCY STOP (ESTOP)'}
                            </button>
                          </div>
                        </>
                      )}

                      {phoneTab === 'nodes' && (
                        <>
                          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)' }}>ESP32 Master Gateway</span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-emerald)' }}>● ONLINE</span>
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                              IP: 192.168.1.140 &bull; WiFi RSSI: -54 dBm &bull; TLS v1.3
                            </div>
                          </div>

                          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)' }}>Tank Ultrasonic Pod</span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-emerald)' }}>● ESP-NOW CH 6</span>
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                              Echo: 42.1 cm &bull; Battery: 3.92V &bull; Packet Loss: 0.0%
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ width: '100%', padding: '8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            onClick={() => alert('BLE Provisioning Scanner searching for nearby SmartPump ESP32 hardware...')}
                          >
                            <Bluetooth size={14} color="var(--color-primary)" />
                            Scan Bluetooth LE Nodes
                          </button>
                        </>
                      )}

                      {phoneTab === 'analytics' && (
                        <>
                          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                              SINGLE-PARAMETER TELEMETRY
                            </div>
                            
                            <div style={{ height: '90px', width: '100%', marginBottom: '8px' }}>
                              <svg viewBox="0 0 500 100" style={{ width: '100%', height: '100%' }}>
                                <polygon points={activeCurve.polygon} fill={activeCurve.color} opacity="0.15" />
                                <polyline fill="none" stroke={activeCurve.color} strokeWidth="2.5" points={activeCurve.points} />
                              </svg>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-app)', padding: '6px', borderRadius: '4px' }}>
                              <span>Min: <strong>{activeCurve.min}</strong></span>
                              <span>Avg: <strong>{activeCurve.avg}</strong></span>
                              <span>Peak: <strong>{activeCurve.peak}</strong></span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bottom Navigation Inside Phone */}
                    <div className="phone-bottom-nav">
                      <button
                        type="button"
                        className={`phone-nav-tab ${phoneTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setPhoneTab('dashboard')}
                      >
                        <Waves size={16} />
                        <span>Dashboard</span>
                      </button>
                      <button
                        type="button"
                        className={`phone-nav-tab ${phoneTab === 'pump' ? 'active' : ''}`}
                        onClick={() => setPhoneTab('pump')}
                      >
                        <Zap size={16} />
                        <span>Pump</span>
                      </button>
                      <button
                        type="button"
                        className={`phone-nav-tab ${phoneTab === 'nodes' ? 'active' : ''}`}
                        onClick={() => setPhoneTab('nodes')}
                      >
                        <Radio size={16} />
                        <span>Device</span>
                      </button>
                      <button
                        type="button"
                        className={`phone-nav-tab ${phoneTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setPhoneTab('analytics')}
                      >
                        <Activity size={16} />
                        <span>Analytics</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile App Description & Direct APK Download Details */}
              <div className="app-details-column">
                <div>
                  <span className="section-eyebrow" style={{ color: 'var(--color-primary)' }}>NATIVE FLUTTER APP</span>
                  <h3 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '12px' }}>
                    Engineered for Precision Field Diagnostics
                  </h3>
                  <p style={{ fontSize: '15px', color: 'var(--text-body)', lineHeight: 1.6 }}>
                    Built from the ground up using Flutter and native Dart. Offers instantaneous 60 FPS water tank animations, offline Bluetooth Low Energy (BLE) provisioning, non-volatile safety lockouts, and persistent login sessions.
                  </p>
                </div>

                {/* Features Checklist */}
                <div className="app-features-checklist">
                  <div className="app-feature-row">
                    <div className="app-feature-icon">
                      <Waves size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                        CustomPainter 2D Spatial Fluid Canvas
                      </h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Real-time wave physics rendered directly on device GPU using millimeter echo telemetry.
                      </p>
                    </div>
                  </div>

                  <div className="app-feature-row">
                    <div className="app-feature-icon">
                      <Bluetooth size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                        Zero-Cloud Bluetooth LE Pairing
                      </h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Provision WiFi credentials, calibrate ultrasonic tank depths, and adjust dry-run thresholds directly via BLE.
                      </p>
                    </div>
                  </div>

                  <div className="app-feature-row">
                    <div className="app-feature-icon">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                        Deterministic Relay Acknowledgement
                      </h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        No optimistic UI updates. Buttons indicate running state only when the physical contactor closes.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Direct APK Download Card with QR Code */}
                <div className="app-download-box">
                  <div className="qr-code-card">
                    {/* Clean SVG QR code mockup */}
                    <svg viewBox="0 0 100 100" style={{ width: '76px', height: '76px' }}>
                      <rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
                      <rect x="10" y="10" width="25" height="25" fill="#0F172A" />
                      <rect x="15" y="15" width="15" height="15" fill="#FFFFFF" />
                      <rect x="18" y="18" width="9" height="9" fill="#0284C7" />
                      <rect x="65" y="10" width="25" height="25" fill="#0F172A" />
                      <rect x="70" y="15" width="15" height="15" fill="#FFFFFF" />
                      <rect x="73" y="18" width="9" height="9" fill="#0284C7" />
                      <rect x="10" y="65" width="25" height="25" fill="#0F172A" />
                      <rect x="15" y="70" width="15" height="15" fill="#FFFFFF" />
                      <rect x="18" y="73" width="9" height="9" fill="#0284C7" />
                      <rect x="45" y="15" width="10" height="25" fill="#0F172A" />
                      <rect x="40" y="55" width="20" height="10" fill="#0F172A" />
                      <rect x="65" y="65" width="15" height="25" fill="#0F172A" />
                      <rect x="45" y="75" width="15" height="15" fill="#0284C7" />
                    </svg>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '4px' }}>SCAN TO INSTALL</span>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ background: 'var(--color-emerald-bg)', color: 'var(--color-emerald)', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                        OFFICIAL BUILD v1.2.0
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>24.8 MB &bull; Arm64-v8a</span>
                    </div>

                    <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                      Download Android APK
                    </h4>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <a
                        href="/downloads/smartpump-v1.2.0.apk"
                        className="btn-primary"
                        style={{ padding: '10px 18px', fontSize: '13px', textDecoration: 'none' }}
                        onClick={(e) => {
                          e.preventDefault();
                          alert('SmartPump APK v1.2.0 is compiled and located in apps/mobile release output folder.');
                        }}
                      >
                        <Download size={15} />
                        Download APK Directly
                      </a>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '10px 14px', fontSize: '13px' }}
                        onClick={() => alert('iOS TestFlight beta invitations will be distributed to registered customers.')}
                      >
                        iOS TestFlight
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SCADA Simulation Console Section */}
        <section id="simulator" style={{ padding: '80px 0 40px' }}>
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">CENTRAL SCADA SIMULATOR</span>
              <h2 className="section-title">Live Dispatch Console</h2>
              <p className="section-desc">
                High-resolution operations console with real-time contactor interlocks, fluid volume calculations, and single-parameter telemetry curves.
              </p>
            </div>

            <div className="console-wrapper">
              <div className="console-topbar">
                <div className="console-title-group">
                  <div className="window-dots">
                    <span className="window-dot dot-red"></span>
                    <span className="window-dot dot-amber"></span>
                    <span className="window-dot dot-green"></span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.2px' }}>
                    SITE #A-402 &bull; CENTRAL STORAGE RESERVOIR
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    FIRMWARE: <strong style={{ color: 'var(--text-main)' }}>v2.4.1-PROD</strong>
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: isEmergencyStopped ? 'var(--color-crimson)' : (isRunning ? 'var(--color-emerald)' : 'var(--text-secondary)') }}>
                    STATUS: <strong>{isEmergencyStopped ? 'EMERGENCY LOCKOUT' : (isRunning ? 'PUMP ACTIVE' : 'STANDBY')}</strong>
                  </span>
                </div>
              </div>

              {/* Console Body */}
              <div className="console-body">
                {/* Left Stage */}
                <div className="console-stage">
                  <div className="spatial-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Droplets size={18} color="var(--color-primary)" />
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Physical Reservoir & Overhead Motor Flow
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Capacity: 1,000 Liters &bull; Ultrasonic Accuracy &plusmn;2mm
                      </div>
                    </div>

                    <div className="spatial-flex">
                      {/* Big Tank */}
                      <div className="tank-visual-wrap">
                        <div 
                          className="tank-water-fluid" 
                          style={{ height: `${tankLevel}%` }}
                        >
                          <div className="tank-water-wave"></div>
                        </div>

                        <div className="tank-measurement-lines">
                          <div className="measurement-tick major"><span style={{ marginLeft: '26px', fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)' }}>100%</span></div>
                          <div className="measurement-tick"></div>
                          <div className="measurement-tick major"><span style={{ marginLeft: '26px', fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)' }}>75%</span></div>
                          <div className="measurement-tick"></div>
                          <div className="measurement-tick major"><span style={{ marginLeft: '26px', fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)' }}>50%</span></div>
                          <div className="measurement-tick"></div>
                          <div className="measurement-tick major"><span style={{ marginLeft: '26px', fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)' }}>25%</span></div>
                          <div className="measurement-tick"></div>
                          <div className="measurement-tick major"><span style={{ marginLeft: '26px', fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)' }}>0%</span></div>
                        </div>

                        <div style={{ position: 'absolute', top: '16px', right: '16px', textAlign: 'right', zIndex: 10, background: 'rgba(255, 255, 255, 0.88)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', backdropFilter: 'blur(4px)' }}>
                          <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1.1 }}>
                            {tankLevel.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {Math.round((tankLevel / 100) * 1000)} / 1000 L
                          </div>
                        </div>
                      </div>

                      {/* Connecting Pipe */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '70px', position: 'relative' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                          DN25 PIPE
                        </div>
                        <div style={{ width: '100%', height: '8px', background: isRunning ? 'var(--color-primary)' : 'var(--border-medium)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                          {isRunning && (
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(90deg, transparent, transparent 8px, #FFFFFF 8px, #FFFFFF 16px)', animation: 'pipeFlow 0.8s linear infinite' }}></div>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: isRunning ? 'var(--color-primary)' : 'var(--text-muted)', marginTop: '4px' }}>
                          {isRunning ? `${flowRate.toFixed(1)} LPM` : 'IDLE'}
                        </div>
                      </div>

                      {/* Motor */}
                      <div className="motor-visual-wrap">
                        <div className={`motor-casing ${isRunning ? 'running' : ''}`}>
                          <div className={`impeller-blade ${isRunning ? 'spinning' : ''}`}>
                            <Zap size={32} color={isRunning ? 'var(--color-emerald)' : 'var(--text-secondary)'} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                            2.0 HP Pump
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: isRunning ? 'var(--color-emerald)' : 'var(--text-muted)' }}>
                            {isRunning ? `${motorRpm} RPM` : '0 RPM'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Pills */}
                  <div className="telemetry-pill-grid">
                    <div className="telemetry-pill">
                      <span className="telemetry-pill-label">Water Flow</span>
                      <span className="telemetry-pill-value" style={{ color: isRunning ? 'var(--color-emerald)' : 'var(--text-main)' }}>
                        {isRunning ? `${flowRate.toFixed(1)} LPM` : '0.0 LPM'}
                      </span>
                      <span className="telemetry-pill-meta">Hall Turbine Sensor</span>
                    </div>

                    <div className="telemetry-pill">
                      <span className="telemetry-pill-label">Water Purity</span>
                      <span className="telemetry-pill-value">142 ppm</span>
                      <span className="telemetry-pill-meta" style={{ color: 'var(--color-emerald)', fontWeight: 600 }}>Grade A Potable</span>
                    </div>

                    <div className="telemetry-pill">
                      <span className="telemetry-pill-label">Cycle Runtime</span>
                      <span className="telemetry-pill-value">{formatRunTime(runSeconds)}</span>
                      <span className="telemetry-pill-meta">Today: 3 Cycles (1.8h)</span>
                    </div>

                    <div className="telemetry-pill">
                      <span className="telemetry-pill-label">Contactor Relays</span>
                      <span className="telemetry-pill-value" style={{ color: isEmergencyStopped ? 'var(--color-crimson)' : (isRunning ? 'var(--color-emerald)' : 'var(--text-secondary)') }}>
                        {isEmergencyStopped ? 'TRIPPED' : (isRunning ? 'ENERGIZED' : 'OPEN')}
                      </span>
                      <span className="telemetry-pill-meta">Solid State 25A</span>
                    </div>
                  </div>

                  {/* Single Parameter Analytics Curve */}
                  <div className="curve-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Single Parameter Analytics Curve
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Telemetry Interval: 1s &bull; High Resolution
                      </div>
                    </div>

                    <div className="curve-tab-bar">
                      <button 
                        type="button"
                        className={`curve-tab-btn ${selectedParam === 'level' ? 'active' : ''}`}
                        onClick={() => setSelectedParam('level')}
                      >
                        <Droplets size={14} /> Tank Level
                      </button>
                      <button 
                        type="button"
                        className={`curve-tab-btn ${selectedParam === 'flow' ? 'active' : ''}`}
                        onClick={() => setSelectedParam('flow')}
                      >
                        <Waves size={14} /> Flow Velocity
                      </button>
                      <button 
                        type="button"
                        className={`curve-tab-btn ${selectedParam === 'tds' ? 'active' : ''}`}
                        onClick={() => setSelectedParam('tds')}
                      >
                        <Activity size={14} /> TDS Purity
                      </button>
                      <button 
                        type="button"
                        className={`curve-tab-btn ${selectedParam === 'power' ? 'active' : ''}`}
                        onClick={() => setSelectedParam('power')}
                      >
                        <Zap size={14} /> Power Draw
                      </button>
                    </div>

                    <div className="curve-svg-box">
                      <svg viewBox="0 0 500 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={activeCurve.color} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={activeCurve.color} stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="20" x2="500" y2="20" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="0" y1="50" x2="500" y2="50" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="0" y1="80" x2="500" y2="80" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />

                        <polygon points={activeCurve.polygon} fill="url(#curveGrad)" />
                        
                        <polyline
                          fill="none"
                          stroke={activeCurve.color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={activeCurve.points}
                        />

                        <circle cx="500" cy="24" r="5" fill={activeCurve.color} stroke="#FFFFFF" strokeWidth="2" />
                      </svg>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card-subtle)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Parameter: <strong style={{ color: 'var(--text-main)' }}>{activeCurve.label}</strong>
                      </span>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <span>Min: <strong>{activeCurve.min}</strong></span>
                        <span>Avg: <strong>{activeCurve.avg}</strong></span>
                        <span>Peak: <strong>{activeCurve.peak}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Stage: Controls */}
                <div className="console-sidebar">
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                      Operating Mode Selection
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg-card-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', gap: '4px' }}>
                      <button
                        type="button"
                        style={{
                          padding: '10px',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: mode === 'MANUAL' ? '#FFFFFF' : 'transparent',
                          color: mode === 'MANUAL' ? 'var(--color-primary)' : 'var(--text-secondary)',
                          boxShadow: mode === 'MANUAL' ? 'var(--shadow-xs)' : 'none'
                        }}
                        onClick={() => setMode('MANUAL')}
                      >
                        MANUAL
                      </button>
                      <button
                        type="button"
                        style={{
                          padding: '10px',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: mode === 'AUTO' ? '#FFFFFF' : 'transparent',
                          color: mode === 'AUTO' ? 'var(--color-primary)' : 'var(--text-secondary)',
                          boxShadow: mode === 'AUTO' ? 'var(--shadow-xs)' : 'none'
                        }}
                        onClick={() => setMode('AUTO')}
                      >
                        AUTO
                      </button>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Relay State
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: isRunning ? 'var(--color-emerald)' : 'var(--text-muted)' }}>
                        {isRunning ? 'CLOSED (ACTIVE)' : 'OPEN (ISOLATED)'}
                      </span>
                    </div>

                    {mode === 'MANUAL' ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ flex: 1, backgroundColor: isRunning ? '#94A3B8' : 'var(--color-emerald)', cursor: (isRunning || isEmergencyStopped) ? 'not-allowed' : 'pointer' }}
                          disabled={isRunning || isEmergencyStopped}
                          onClick={handleStartPump}
                        >
                          <Power size={16} />
                          START PUMP
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ flex: 1, cursor: (!isRunning || isEmergencyStopped) ? 'not-allowed' : 'pointer' }}
                          disabled={!isRunning || isEmergencyStopped}
                          onClick={handleStopPump}
                        >
                          STOP PUMP
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: '#FFFFFF', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                          ⚡ Automation Rules Enforced
                        </div>
                        Manual commands disabled in Auto Mode. Pump engages automatically when level &lt; 25% and cuts off when &ge; 90%.
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      {!isEmergencyStopped ? (
                        <button
                          type="button"
                          className="btn-danger"
                          style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                          onClick={handleEmergencyStop}
                        >
                          <AlertTriangle size={18} />
                          EMERGENCY STOP (ESTOP)
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-crimson)', fontSize: '12px', fontWeight: 700 }}>
                            <Lock size={16} />
                            ESTOP LATCH ENGAGED
                          </div>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ width: '100%', borderColor: 'var(--color-crimson)', color: 'var(--color-crimson)' }}
                            onClick={handleResetEmergency}
                          >
                            <Unlock size={16} />
                            Reset Hardware Safety Latch
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Connected Node Topology
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Cpu size={14} color="var(--color-primary)" />
                        <span style={{ fontWeight: 600 }}>ESP32 Gateway</span>
                      </div>
                      <span style={{ color: 'var(--color-emerald)', fontWeight: 700 }}>WiFi -54 dBm</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Radio size={14} color="var(--color-cyan)" />
                        <span style={{ fontWeight: 600 }}>Tank Sub-Node</span>
                      </div>
                      <span style={{ color: 'var(--color-emerald)', fontWeight: 700 }}>ESP-NOW Ch 6</span>
                    </div>
                  </div>

                  <div style={{ background: '#0F172A', borderRadius: 'var(--radius-md)', padding: '12px', color: '#94A3B8', fontSize: '10.5px', fontFamily: 'monospace', height: '110px', overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ color: '#38BDF8', fontWeight: 700, marginBottom: '2px' }}>// REST & MQTT STREAM</div>
                    {eventLogs.map((log, index) => (
                      <div key={index} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CUSTOMER PRODUCTS & HARDWARE STORE SECTION */}
        <section id="products" className="products-section">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">HARDWARE STORE & KITS</span>
              <h2 className="section-title">Engineered Hardware Ready to Deploy</h2>
              <p className="section-desc">
                Choose a complete pre-configured kit or expand your existing installation with modular wireless sensor pods and industrial relays.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="products-filter-bar">
              <button
                type="button"
                className={`filter-tab-btn ${productCategoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setProductCategoryFilter('all')}
              >
                All Products ({PRODUCTS.length})
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${productCategoryFilter === 'kit' ? 'active' : ''}`}
                onClick={() => setProductCategoryFilter('kit')}
              >
                Complete Kits (3)
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${productCategoryFilter === 'sensor' ? 'active' : ''}`}
                onClick={() => setProductCategoryFilter('sensor')}
              >
                Sensors & Probes (2)
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${productCategoryFilter === 'relay' ? 'active' : ''}`}
                onClick={() => setProductCategoryFilter('relay')}
              >
                Relays & Hardware (1)
              </button>
            </div>

            {/* Product Cards Grid */}
            <div className="products-grid">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`product-card ${product.isFeatured ? 'featured' : ''}`}
                >
                  {product.ribbon && (
                    <div className={`product-ribbon ${product.ribbon.toLowerCase().includes('best') ? 'bestseller' : (product.ribbon.toLowerCase().includes('enterprise') ? 'enterprise' : '')}`}>
                      {product.ribbon}
                    </div>
                  )}

                  {/* Visual Graphic Area */}
                  <div className="product-visual-box">
                    {product.category === 'kit' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-md)', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                          <Cpu size={32} color="var(--color-primary)" />
                        </div>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                          <Radio size={24} color="var(--color-emerald)" />
                        </div>
                      </div>
                    ) : product.category === 'sensor' ? (
                      <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                        <Waves size={36} color="var(--color-primary)" />
                      </div>
                    ) : (
                      <div style={{ width: '68px', height: '68px', borderRadius: 'var(--radius-md)', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                        <Zap size={36} color="var(--color-amber)" />
                      </div>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="product-content">
                    {/* Star Ratings */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <div className="star-rating">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} fill="#F59E0B" color="#F59E0B" />
                        ))}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {product.rating.toFixed(1)}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        ({product.reviewsCount})
                      </span>
                    </div>

                    <h3 className="product-title">{product.name}</h3>
                    <p className="product-tagline">{product.tagline}</p>

                    {/* Pricing */}
                    <div className="product-pricing-row">
                      <span className="product-price-current">${product.price}</span>
                      <span className="product-price-original">${product.originalPrice}</span>
                      <span className="product-save-badge">
                        Save ${product.originalPrice - product.price}
                      </span>
                    </div>

                    {/* Specs Checklist */}
                    <ul className="product-specs-list">
                      {product.specs.map((spec, idx) => (
                        <li key={idx} className="product-spec-item">
                          <CheckCircle2 size={16} />
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Actions */}
                    <div className="product-action-row">
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ flex: 1 }}
                        onClick={() => addToCart(product)}
                      >
                        <ShoppingCart size={16} />
                        Add to Cart
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          addToCart(product);
                          setIsCheckoutOpen(true);
                        }}
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INTERACTIVE ROI & ELECTRICITY SAVINGS CALCULATOR */}
        <section id="roi" className="roi-section">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">RETURN ON INVESTMENT</span>
              <h2 className="section-title">See How Fast SmartPump Pays for Itself</h2>
              <p className="section-desc">
                Dry-running pumps burn coils, while overpumping wastes thousands of liters of treated water and electricity. Calculate your estimated monthly savings below.
              </p>
            </div>

            <div className="roi-calc-container">
              {/* Sliders Input */}
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calculator size={20} color="var(--color-primary)" />
                  Your Facility Parameters
                </h3>

                <div className="calc-slider-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                    <span>Number of Storage Tanks:</span>
                    <span style={{ color: 'var(--color-primary)' }}>{calcTanks} {calcTanks === 1 ? 'Tank' : 'Tanks'}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={calcTanks}
                    onChange={(e) => setCalcTanks(parseInt(e.target.value))}
                    className="calc-range-input"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>1 Tank (Residential)</span>
                    <span>5 Tanks (Multi-Structure)</span>
                  </div>
                </div>

                <div className="calc-slider-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                    <span>Pump Motor Power:</span>
                    <span style={{ color: 'var(--color-primary)' }}>{calcHp.toFixed(1)} HP ({(calcHp * 0.746).toFixed(2)} kW)</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.5"
                    value={calcHp}
                    onChange={(e) => setCalcHp(parseFloat(e.target.value))}
                    className="calc-range-input"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>0.5 HP (Small Domestic)</span>
                    <span>5.0 HP (Industrial / Borewell)</span>
                  </div>
                </div>

                <div className="calc-slider-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                    <span>Estimated Daily Pumping Hours:</span>
                    <span style={{ color: 'var(--color-primary)' }}>{calcHours.toFixed(1)} Hours / day</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="6.0"
                    step="0.5"
                    value={calcHours}
                    onChange={(e) => setCalcHours(parseFloat(e.target.value))}
                    className="calc-range-input"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>0.5 Hours (Occasional)</span>
                    <span>6.0 Hours (Heavy Usage)</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Results Card */}
              <div className="calc-results-panel">
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.5px' }}>
                    PROJECTED MONTHLY SAVINGS
                  </div>
                  <div style={{ fontSize: '38px', fontWeight: 900, color: 'var(--color-emerald)', lineHeight: 1 }}>
                    ${monthlyElectricitySaved + 18} <span style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 600 }}>/ month</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="roi-metric-item">
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>Electricity Conserved</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Auto-cutoff stops over-cycling</div>
                    </div>
                    <div className="roi-metric-value">{monthlyKwhSaved} kWh</div>
                  </div>

                  <div className="roi-metric-item">
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>Water Overflow Prevented</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Zero spillage with high-level cutoff</div>
                    </div>
                    <div className="roi-metric-value" style={{ color: 'var(--color-primary)' }}>
                      {monthlyWaterSavedLiters.toLocaleString()} L
                    </div>
                  </div>

                  <div className="roi-metric-item">
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>Hardware Payback Period</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>SmartPump Core Kit ($149)</div>
                    </div>
                    <div className="roi-metric-value" style={{ color: '#D97706' }}>
                      {paybackMonths} Months
                    </div>
                  </div>
                </div>

                <a href="#products" className="btn-primary" style={{ width: '100%', textDecoration: 'none' }}>
                  <ShoppingCart size={16} />
                  Start Saving With SmartPump
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* SIDE-BY-SIDE COMPARISON TABLE */}
        <section id="compare" className="comparison-section">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">HEAD-TO-HEAD COMPARISON</span>
              <h2 className="section-title">Why Traditional Solutions Fail</h2>
              <p className="section-desc">
                See why mechanical float switches and generic smart plugs cannot handle inductive water pump currents and roof-to-ground distances.
              </p>
            </div>

            <div className="comparison-table-wrapper">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Capability / Feature</th>
                    <th style={{ color: 'var(--color-primary)', background: '#F0F9FF' }}>SmartPump IoT Kit</th>
                    <th>Mechanical Float Ball</th>
                    <th>Generic WiFi Smart Plug</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Measurement Method</strong></td>
                    <td style={{ background: '#F0F9FF', fontWeight: 700, color: 'var(--color-primary)' }}>Non-contact Ultrasonic (±2mm)</td>
                    <td>Physical copper ball (corrodes)</td>
                    <td>None (Timer only)</td>
                  </tr>
                  <tr>
                    <td><strong>Roof-to-Ground Wiring</strong></td>
                    <td style={{ background: '#F0F9FF', fontWeight: 700, color: 'var(--color-emerald)' }}>Zero Wires (ESP-NOW Mesh)</td>
                    <td>Requires 4-core cable conduit</td>
                    <td>N/A</td>
                  </tr>
                  <tr>
                    <td><strong>Motor Dry-Run Protection</strong></td>
                    <td style={{ background: '#F0F9FF', fontWeight: 700, color: 'var(--color-emerald)' }}>Automatic (Within 2.5s)</td>
                    <td style={{ color: 'var(--color-crimson)' }}>No (Burns pump motor)</td>
                    <td style={{ color: 'var(--color-crimson)' }}>No</td>
                  </tr>
                  <tr>
                    <td><strong>Relay Current Capacity</strong></td>
                    <td style={{ background: '#F0F9FF', fontWeight: 700, color: 'var(--color-primary)' }}>25A / 40A / 63A Solid State</td>
                    <td>10A mechanical (welds shut)</td>
                    <td>10A resistive (trips on inductive surge)</td>
                  </tr>
                  <tr>
                    <td><strong>Offline Safety Lockout</strong></td>
                    <td style={{ background: '#F0F9FF', fontWeight: 700, color: 'var(--color-emerald)' }}>Hardware EEPROM Latch</td>
                    <td>No</td>
                    <td style={{ color: 'var(--color-crimson)' }}>Fails open on power drop</td>
                  </tr>
                  <tr>
                    <td><strong>Mobile App & Telemetry</strong></td>
                    <td style={{ background: '#F0F9FF', fontWeight: 700, color: 'var(--color-emerald)' }}>Native Flutter App (2D Canvas)</td>
                    <td>None</td>
                    <td>Generic basic timer</td>
                  </tr>
                  <tr>
                    <td><strong>Water Purity / TDS Sensor</strong></td>
                    <td style={{ background: '#F0F9FF', fontWeight: 700, color: 'var(--color-primary)' }}>Included in Pro Kit</td>
                    <td>None</td>
                    <td>None</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS (ACCORDION) */}
        <section id="faq" className="faq-section">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">COMMON QUESTIONS</span>
              <h2 className="section-title">Frequently Asked Questions</h2>
              <p className="section-desc">
                Everything you need to know about installation, motor compatibility, and warranty.
              </p>
            </div>

            <div className="faq-list">
              {[
                {
                  q: 'Where can I get the SmartPump mobile app?',
                  a: 'The SmartPump mobile application is built with native Flutter. You can download the production Android APK directly from this website (section above) or install it via the QR code. iOS TestFlight invites are provided to verified hardware customers.'
                },
                {
                  q: 'Do I need to run wires between my overhead tank and the pump?',
                  a: 'No! SmartPump utilizes ESP-NOW mesh networking. The battery/solar-powered ultrasonic pod sits on your tank lid and broadcasts water level telemetry directly to the gateway controller near your pump over high-penetration 2.4GHz RF, eliminating all roof-to-ground wiring.'
                },
                {
                  q: 'Will SmartPump work with my existing pump motor?',
                  a: 'Yes. SmartPump works with single-phase and three-phase pumps from 0.5 HP up to 10 HP (including submersible, jet, monoblock, and centrifugal motors). Our kits include optoisolated solid-state contactors rated for heavy inductive motor surges.'
                },
                {
                  q: 'What happens if my home WiFi network goes down?',
                  a: 'SmartPump continues operating seamlessly. The ESP32 gateway runs the automated rule engine locally on the edge hardware. Cutoffs at 25% low and 95% high limits are enforced even if internet connectivity drops.'
                },
                {
                  q: 'How does the 2-Year Hardware Warranty work?',
                  a: 'If any sensor, gateway, or relay develops a hardware malfunction within 2 years of purchase, we send a brand new replacement unit immediately with prepaid return packaging for the old unit.'
                }
              ].map((faq, index) => (
                <div key={index} className="faq-card">
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  >
                    <span>{faq.q}</span>
                    {openFaq === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {openFaq === index && (
                    <div className="faq-answer">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HIGH-CONVERTING BOTTOM CTA / ENTERPRISE BANNER */}
        <section style={{ padding: '80px 0', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFFFFF', textAlign: 'center' }}>
          <div className="container" style={{ maxWidth: '780px' }}>
            <span style={{ display: 'inline-block', padding: '6px 14px', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', borderRadius: '9999px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.8px', marginBottom: '18px' }}>
              TRANSFORM YOUR WATER INFRASTRUCTURE TODAY
            </span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-0.8px', marginBottom: '16px' }}>
              Stop Overflows & Motor Burnouts Once and For All
            </h2>
            <p style={{ fontSize: '16px', color: '#94A3B8', lineHeight: 1.6, marginBottom: '32px' }}>
              Join thousands of homes, gated societies, and industrial facilities enjoying zero-spill automated water management with SmartPump.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <a href="#products" className="btn-primary" style={{ padding: '14px 28px', fontSize: '15px' }}>
                <ShoppingCart size={18} />
                Order SmartPump Starter Kit ($149)
              </a>
              <a href="#app" className="btn-secondary" style={{ padding: '14px 24px', fontSize: '15px', background: 'transparent', color: '#FFFFFF', borderColor: '#475569' }}>
                <Smartphone size={16} />
                Get Android APK
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* INTERACTIVE CART SLIDE-OVER DRAWER */}
      {isCartOpen && (
        <div className="cart-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingCart size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Your Shopping Cart ({totalItemsCount})
                </h3>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => setIsCartOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Cart Body */}
            <div className="cart-body">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                  <ShoppingCart size={48} color="var(--border-medium)" style={{ margin: '0 auto 16px' }} />
                  <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>Your cart is empty</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Select an engineered hardware kit or accessory.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setIsCartOpen(false)}
                  >
                    Browse Hardware Catalog
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ background: 'var(--color-emerald-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '12.5px', color: '#065F46' }}>
                    {cartSubtotal >= 100 ? (
                      <span style={{ fontWeight: 700 }}>🎉 You qualified for FREE Express Shipping!</span>
                    ) : (
                      <span>Add <strong>${100 - cartSubtotal}</strong> more to unlock Free Express Shipping!</span>
                    )}
                  </div>

                  {cart.map((item) => (
                    <div key={item.product.id} className="cart-item-row">
                      <div className="cart-item-info">
                        <div className="cart-item-title">{item.product.name}</div>
                        <div className="cart-item-price">${item.product.price} each</div>
                        <div className="cart-qty-ctrls">
                          <button
                            type="button"
                            className="cart-qty-btn"
                            onClick={() => updateCartQty(item.product.id, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className="cart-qty-btn"
                            onClick={() => updateCartQty(item.product.id, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <button
                          type="button"
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          onClick={() => removeFromCart(item.product.id)}
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                          ${item.product.price * item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Coupon: SMARTPUMP10"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="input-control"
                        style={{ flex: 1, textTransform: 'uppercase', fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '8px 14px', fontSize: '13px' }}
                        onClick={applyPromo}
                      >
                        Apply
                      </button>
                    </div>
                    {promoError && (
                      <span style={{ fontSize: '11.5px', color: 'var(--color-crimson)', display: 'block', marginTop: '4px' }}>
                        {promoError}
                      </span>
                    )}
                    {discountPercent > 0 && (
                      <span style={{ fontSize: '11.5px', color: 'var(--color-emerald)', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                        10% promo discount applied!
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="cart-summary-line">
                  <span>Subtotal</span>
                  <span>${cartSubtotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="cart-summary-line" style={{ color: 'var(--color-emerald)' }}>
                    <span>Promo Discount (10%)</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="cart-summary-line">
                  <span>Shipping</span>
                  <span>{shippingCost === 0 ? 'FREE' : `$${shippingCost}`}</span>
                </div>
                <div className="cart-summary-line total">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                >
                  Proceed to Checkout (${cartTotal.toFixed(2)})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="modal-overlay" onClick={() => setIsCheckoutOpen(false)}>
          <div className="checkout-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                {orderPlaced ? 'Order Confirmed!' : 'Express Checkout'}
              </h3>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => {
                  setIsCheckoutOpen(false);
                  setOrderPlaced(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {!orderPlaced ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-field-group">
                      <label className="input-label">First Name</label>
                      <input type="text" defaultValue="Karthik" className="input-control" />
                    </div>
                    <div className="input-field-group">
                      <label className="input-label">Last Name</label>
                      <input type="text" defaultValue="Natarajan" className="input-control" />
                    </div>
                  </div>

                  <div className="input-field-group">
                    <label className="input-label">Delivery Street Address</label>
                    <input type="text" defaultValue="142 Lakeview Orchard Blvd" className="input-control" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div className="input-field-group">
                      <label className="input-label">City</label>
                      <input type="text" defaultValue="Bangalore" className="input-control" />
                    </div>
                    <div className="input-field-group">
                      <label className="input-label">Postal Code</label>
                      <input type="text" defaultValue="560078" className="input-control" />
                    </div>
                  </div>

                  <div className="input-field-group">
                    <label className="input-label">Payment Method</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div style={{ padding: '10px', border: '2px solid var(--color-primary)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: '12px', fontWeight: 700, background: 'var(--bg-accent-soft)', color: 'var(--color-primary)' }}>
                        Credit Card
                      </div>
                      <div style={{ padding: '10px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-body)' }}>
                        UPI / NetBank
                      </div>
                      <div style={{ padding: '10px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-body)' }}>
                        Cash on Delivery
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', padding: '14px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Order Total:</span>
                      <strong style={{ fontSize: '16px', color: 'var(--text-main)' }}>${cartTotal.toFixed(2)}</strong>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Includes 2-Year Hardware Warranty + Free 30-Day Express Returns
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                    onClick={() => {
                      setOrderPlaced(true);
                      setCart([]);
                    }}
                  >
                    Place Order &amp; Pay ${cartTotal.toFixed(2)}
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-emerald-bg)', color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle2 size={36} />
                  </div>
                  <h4 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Thank You For Your Order!
                  </h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                    Order <strong>#SP-89421</strong> has been successfully placed. Your SmartPump IoT hardware kit is being prepared for dispatch with express DHL courier.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setIsCheckoutOpen(false)}
                  >
                    Back to Store
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Senior Footer */}
      <footer className="footer">
        <div className="container footer-flex">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="logo-badge" style={{ width: '28px', height: '28px' }}>
              <Droplets size={16} />
            </span>
            <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '14px' }}>
              SmartPump Systems Inc.
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              &copy; {new Date().getFullYear()} All Rights Reserved. ISO 9001:2015 Certified.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
            <a href="#app" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 }}>
              Mobile App (APK)
            </a>
            <a href="#products" style={{ color: 'var(--text-body)', textDecoration: 'none' }}>
              Hardware Store
            </a>
            <a href="http://localhost:3000/docs" target="_blank" rel="noreferrer" style={{ color: 'var(--text-body)', textDecoration: 'none' }}>
              OpenAPI Swagger
            </a>
            <a href="#simulator" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 }}>
              Live Simulator &uarr;
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
