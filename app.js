/**
 * TenWayOut Interactive Web Companion & Simulator
 * Supports Web Bluetooth API (BLE 5.0) and Client-Side Interactive Simulation
 */

// Bluetooth UUIDs matching ESP32-C3 Firmware
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let bleDevice = null;
let bleCharacteristic = null;
let isSimulating = true;
let currentSpeedSetting = 25; // km/h
let simInterval = null;
let activeMitmMode = 'unlocked'; // 'legal' or 'unlocked'

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  startTelemetrySimulator();
  updateVisualizer(activeMitmMode);
});

function initEventListeners() {
  // Mode Buttons in Visualizer
  const btnFlowLegal = document.getElementById('btnFlowLegal');
  const btnFlowUnlocked = document.getElementById('btnFlowUnlocked');
  
  if (btnFlowLegal && btnFlowUnlocked) {
    btnFlowLegal.addEventListener('click', () => setMitmVisualizerMode('legal'));
    btnFlowUnlocked.addEventListener('click', () => setMitmVisualizerMode('unlocked'));
  }

  // Speed Slider
  const speedSlider = document.getElementById('speedSlider');
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      onSpeedChange(parseInt(e.target.value));
    });
  }

  // Web Bluetooth Connect Button
  const btnBleConnect = document.getElementById('btnBleConnect');
  if (btnBleConnect) {
    btnBleConnect.addEventListener('click', toggleBleConnection);
  }

  // App Simulator Mode Toggle
  const btnSimToggle = document.getElementById('btnSimToggle');
  if (btnSimToggle) {
    btnSimToggle.addEventListener('click', toggleSimulatorMode);
  }
}

/**
 * Handle Speed Limit Selection
 */
window.setSpeedMode = async function(speed) {
  currentSpeedSetting = speed;
  
  const slider = document.getElementById('speedSlider');
  const sliderVal = document.getElementById('sliderValue');
  const btnLegal = document.getElementById('btnAppLegal');
  const btnUnlocked = document.getElementById('btnAppUnlocked');
  
  if (slider) slider.value = speed;
  if (sliderVal) sliderVal.textContent = `${speed} km/h`;
  
  if (btnLegal) btnLegal.classList.toggle('active', speed === 25);
  if (btnUnlocked) btnUnlocked.classList.toggle('active', speed === 33);

  await sendSpeedCommand(speed);
};

function onSpeedChange(speed) {
  currentSpeedSetting = speed;
  const sliderVal = document.getElementById('sliderValue');
  const btnLegal = document.getElementById('btnAppLegal');
  const btnUnlocked = document.getElementById('btnAppUnlocked');
  
  if (sliderVal) sliderVal.textContent = `${speed} km/h`;
  if (btnLegal) btnLegal.classList.toggle('active', speed === 25);
  if (btnUnlocked) btnUnlocked.classList.toggle('active', speed === 33);

  sendSpeedCommand(speed);
}

/**
 * Web Bluetooth API Integration
 */
async function toggleBleConnection() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const connectBtn = document.getElementById('btnBleConnect');

  if (bleDevice && bleDevice.gatt.connected) {
    bleDevice.gatt.disconnect();
    onBleDisconnected();
    return;
  }

  if (!navigator.bluetooth) {
    showToast("⚠️ Web Bluetooth is not supported on this browser. Try Chrome on Android, Mac, or PC, or Bluefy on iOS.");
    return;
  }

  try {
    statusText.textContent = "Scanning for TenWayOut...";
    statusDot.className = "status-dot";

    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "Tenways" }, { namePrefix: "TenWayOut" }],
      optionalServices: [SERVICE_UUID]
    });

    bleDevice.addEventListener('gattserverdisconnected', onBleDisconnected);
    
    statusText.textContent = "Connecting...";
    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    bleCharacteristic = await service.getCharacteristic(CHAR_UUID);

    // Stop simulated telemetry
    isSimulating = false;
    
    statusDot.className = "status-dot connected";
    statusText.textContent = `Connected: ${bleDevice.name || 'TenWayOut'}`;
    connectBtn.textContent = "Disconnect Bike";
    connectBtn.classList.remove('btn-primary');
    connectBtn.classList.add('btn-secondary');

    showToast("✅ Successfully connected to TenWayOut Module via BLE!");
  } catch (error) {
    console.error("BLE Error:", error);
    if (error.name !== 'NotFoundError') {
      showToast(`❌ Connection failed: ${error.message}`);
    }
    onBleDisconnected();
  }
}

function onBleDisconnected() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const connectBtn = document.getElementById('btnBleConnect');

  statusDot.className = "status-dot simulated";
  statusText.textContent = "Disconnected (Simulation Active)";
  if (connectBtn) {
    connectBtn.textContent = "Connect Bike via Bluetooth";
    connectBtn.classList.remove('btn-secondary');
    connectBtn.classList.add('btn-primary');
  }

  isSimulating = true;
}

/**
 * Send Speed Command over BLE (or Simulated)
 */
async function sendSpeedCommand(speed) {
  // Packet structure: [Header 0xA5, CMD 0x01, Speed, Checksum]
  const checksum = (0xA5 + 0x01 + speed) & 0xFF;
  const payload = new Uint8Array([0xA5, 0x01, speed, checksum]);

  if (bleCharacteristic && bleDevice && bleDevice.gatt.connected) {
    try {
      await bleCharacteristic.writeValue(payload);
      console.log(`[BLE TX] Sent Speed Limit: ${speed} km/h (Checksum: 0x${checksum.toString(16)})`);
    } catch (e) {
      console.error("BLE Write error:", e);
    }
  } else {
    // Simulator feedback
    console.log(`[SIMULATOR TX] Set speed limit to ${speed} km/h (Checksum: 0x${checksum.toString(16)})`);
  }
}

/**
 * Telemetry Simulator Engine
 */
function startTelemetrySimulator() {
  if (simInterval) clearInterval(simInterval);

  let mockSpeed = 24.2;
  let mockWatts = 185;
  let mockVolts = 40.8;

  simInterval = setInterval(() => {
    if (!isSimulating) return;

    // Simulate riding telemetry oscillations
    const targetMax = currentSpeedSetting;
    const accel = (Math.random() * 0.8 - 0.38);
    mockSpeed = Math.min(targetMax, Math.max(18.0, mockSpeed + accel));
    
    // Motor assist wattage correlates with acceleration and speed
    if (mockSpeed < targetMax - 0.5) {
      mockWatts = Math.round(160 + (targetMax - mockSpeed) * 18 + (Math.random() * 20));
    } else {
      mockWatts = Math.round(45 + Math.random() * 15); // Gliding near threshold
    }

    mockVolts = (41.2 - (mockSpeed / 40) * 1.5).toFixed(1);

    // Update UI elements
    const liveSpeedEl = document.getElementById('liveSpeedValue');
    const liveWattsEl = document.getElementById('liveWattsValue');
    const liveVoltsEl = document.getElementById('liveVoltsValue');
    const liveAssistEl = document.getElementById('liveAssistValue');

    if (liveSpeedEl) liveSpeedEl.textContent = mockSpeed.toFixed(1);
    if (liveWattsEl) liveWattsEl.textContent = `${mockWatts} W`;
    if (liveVoltsEl) liveVoltsEl.textContent = `${mockVolts} V`;
    if (liveAssistEl) {
      liveAssistEl.textContent = mockSpeed >= targetMax ? 'CUTOFF' : 'ASSISTING';
      liveAssistEl.style.color = mockSpeed >= targetMax ? 'var(--brand-yellow)' : 'var(--brand-green-bright)';
    }
  }, 400);
}

function toggleSimulatorMode() {
  isSimulating = !isSimulating;
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  if (isSimulating) {
    statusDot.className = "status-dot simulated";
    statusText.textContent = "Simulation Mode Active";
    showToast("🧪 Telemetry simulator resumed.");
  } else {
    statusDot.className = "status-dot";
    statusText.textContent = "Simulator Paused";
    showToast("⏸️ Simulator paused.");
  }
}

/**
 * MITM Protocol Visualizer Mode Switch
 */
window.setMitmVisualizerMode = function(mode) {
  activeMitmMode = mode;
  const btnLegal = document.getElementById('btnFlowLegal');
  const btnUnlocked = document.getElementById('btnFlowUnlocked');
  
  if (btnLegal) btnLegal.classList.toggle('active', mode === 'legal');
  if (btnUnlocked) btnUnlocked.classList.toggle('active', mode === 'unlocked');

  updateVisualizer(mode);
};

function updateVisualizer(mode) {
  const nodeMitm = document.getElementById('nodeMitm');
  const descMitm = document.getElementById('mitmDescription');
  const byteStream = document.getElementById('byteStreamDisplay');
  const packetModeLabel = document.getElementById('packetModeLabel');

  if (mode === 'legal') {
    if (nodeMitm) nodeMitm.classList.remove('mitm-active');
    if (descMitm) {
      descMitm.innerHTML = `<strong>Legal Pass-Through:</strong> Transparent forwarding. Speed threshold clamped at <strong>25.0 km/h</strong>. 100% stock EN15194 compliant.`;
    }
    if (packetModeLabel) packetModeLabel.textContent = "MODE: TRANSPARENT PASS-THROUGH (25 km/h)";
    if (byteStream) {
      byteStream.innerHTML = `
        <span class="byte">0x59</span>
        <span class="byte">0x12</span>
        <span class="byte">0x02</span>
        <span class="byte highlight" style="background:#065f46">0x19 [25 km/h]</span>
        <span class="byte">0x00</span>
        <span class="byte calc">0x76 [CRC]</span>
      `;
    }
  } else {
    if (nodeMitm) nodeMitm.classList.add('mitm-active');
    if (descMitm) {
      descMitm.innerHTML = `<strong>Active Interception:</strong> ESP32-C3 dynamically rewrites limit byte to <strong>33.0 km/h</strong> (0x21) and recalculates packet checksum.`;
    }
    if (packetModeLabel) packetModeLabel.textContent = "MODE: ACTIVE TELEMETRY SPOOFING (33 km/h UNLOCKED)";
    if (byteStream) {
      byteStream.innerHTML = `
        <span class="byte">0x59</span>
        <span class="byte">0x12</span>
        <span class="byte">0x02</span>
        <span class="byte highlight" style="background:#ff5500">0x21 [33 km/h]</span>
        <span class="byte">0x00</span>
        <span class="byte calc" style="background:#ff5500">0x7E [NEW CRC]</span>
      `;
    }
  }
}

/**
 * Toast Notification Utility
 */
function showToast(message) {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.backgroundColor = '#181a20';
    toast.style.color = '#ffffff';
    toast.style.border = '2.5px solid #000000';
    toast.style.borderRadius = '8px';
    toast.style.padding = '12px 20px';
    toast.style.fontFamily = 'Space Grotesk, sans-serif';
    toast.style.fontWeight = '700';
    toast.style.boxShadow = '5px 5px 0px #000000';
    toast.style.zIndex = '9999';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 4000);
}
