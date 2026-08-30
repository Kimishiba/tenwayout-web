/**
 * TenWayOut ⚡ Interactive Web Companion, BLE Controller & Doodle Engine
 * High-Voltage Neo-Brutalist UX inspired by agentdomains.co
 */

// Bluetooth UUIDs matching ESP32-C3 Firmware
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let bleDevice = null;
let bleCharacteristic = null;
let isSimulating = true;
let currentSpeedSetting = 33; // km/h
let simInterval = null;
let activeMitmMode = 'unlocked'; // 'legal' or 'unlocked'

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  initDoodleCanvas();
  initSpeedChecker();
  initEventListeners();
  startTelemetrySimulator();
  updateVisualizer(activeMitmMode);
});

/**
 * 1. Interactive HTML5 Doodle Drawing Canvas (agentdomains style)
 */
function initDoodleCanvas() {
  const cv = document.getElementById('doodle');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const ctl = document.getElementById('doodle-ctl');
  const clearBtn = document.getElementById('clear-doodle');

  let hasDrawn = false;
  let drawing = false;
  let lx = null;
  let ly = null;

  function sizeCanvas() {
    const r = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.floor(cv.clientWidth * r));
    cv.height = Math.max(1, Math.floor(cv.clientHeight * r));
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--energy').trim() || '#00CC74';
  }

  sizeCanvas();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sizeCanvas, 150);
  });

  function markDrawn() {
    if (!hasDrawn && ctl) {
      hasDrawn = true;
      ctl.classList.add('show');
    }
  }

  const rel = (e) => {
    const r = cv.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      w: r.width,
      h: r.height
    };
  };

  const inside = (p) => p.x >= 0 && p.y >= 0 && p.x <= p.w && p.y <= p.h;

  function down(e) {
    if (e.pointerType === 'touch') return; // Preserve mobile scroll
    const p = rel(e);
    if (!inside(p)) return;
    drawing = true;
    lx = p.x;
    ly = p.y;
    ctx.beginPath();
    ctx.arc(lx, ly, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    markDrawn();
  }

  function move(e) {
    if (!drawing) return;
    const p = rel(e);
    if (!inside(p)) {
      lx = null;
      return;
    }
    if (lx === null) {
      lx = p.x;
      ly = p.y;
      return;
    }
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lx = p.x;
    ly = p.y;
    markDrawn();
  }

  function up() {
    drawing = false;
    lx = null;
    ly = null;
  }

  window.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('blur', up);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      hasDrawn = false;
      if (ctl) ctl.classList.remove('show');
    });
  }
}

/**
 * 2. Playful Input Wobble & Interactive Speed / Command Checker
 */
function initSpeedChecker() {
  const speedInput = document.getElementById('speed-input');
  const inputWrap = document.getElementById('input-wrapper');
  const suffix = document.getElementById('speed-suffix');
  const checkEl = document.getElementById('check');

  if (!speedInput || !inputWrap || !checkEl) return;

  // Input wobble effect on typing
  speedInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    const len = val.length;
    inputWrap.style.transform = len ? `rotate(${Math.sin(len * 1.5) * 1.8}deg)` : 'rotate(0deg)';
    updateSpeedCheckOutput(val);
  });

  // Click suffix to toggle units (KM/H <-> MPH)
  const units = ['KM/H', 'MPH'];
  let unitIndex = 0;
  if (suffix) {
    suffix.addEventListener('click', () => {
      unitIndex = (unitIndex + 1) % units.length;
      suffix.textContent = units[unitIndex];
      updateSpeedCheckOutput(speedInput.value.trim());
    });
  }

  function updateSpeedCheckOutput(val) {
    const speed = parseInt(val, 10);
    const unit = suffix ? suffix.textContent : 'KM/H';

    if (isNaN(speed) || speed <= 0) {
      checkEl.innerHTML = '<span class="dim">Enter a speed limit above (e.g. 33) to compute parameters...</span>';
      return;
    }

    const hexByte = '0x' + speed.toString(16).toUpperCase().padStart(2, '0');
    const crcByte = '0x' + ((0x59 + 0x12 + 0x02 + speed) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
    const cmd = `pio run -e esp32-c3-supermini -t upload --extra-flags "-DSPEED_LIMIT_KMH=${speed}"`;

    let statusHtml = '';
    if (speed <= 25) {
      statusHtml = `<span class="ok">🛡️ Legal Stock Mode (${speed} ${unit})</span> — Byte: <code>${hexByte}</code>, CRC: <code>${crcByte}</code>`;
    } else if (speed <= 38) {
      statusHtml = `<span class="ok">⚡ Optimal Unlocked Assist (${speed} ${unit})</span> — Byte: <code>${hexByte}</code>, CRC: <code>${crcByte}</code> 🚀`;
    } else {
      statusHtml = `<span class="warn">⚠️ High Speed Overdrive (${speed} ${unit})</span> — Ensure motor thermal limits are monitored!`;
    }

    checkEl.innerHTML = `${statusHtml}<br><code class="cmd" id="cmd-snippet" title="Click to copy">${cmd}</code>`;
    attachCopyHandler();
  }

  function attachCopyHandler() {
    const cmdEl = document.getElementById('cmd-snippet');
    if (!cmdEl) return;
    cmdEl.addEventListener('click', () => {
      const text = cmdEl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const orig = cmdEl.textContent;
        cmdEl.textContent = '✓ Copied command to clipboard!';
        setTimeout(() => { cmdEl.textContent = orig; }, 1400);
      });
    });
  }

  attachCopyHandler();
}

/**
 * 3. Interactive Event Listeners & Architecture Controls
 */
function initEventListeners() {
  const btnFlowLegal = document.getElementById('btnFlowLegal');
  const btnFlowUnlocked = document.getElementById('btnFlowUnlocked');
  
  if (btnFlowLegal && btnFlowUnlocked) {
    btnFlowLegal.addEventListener('click', () => setMitmVisualizerMode('legal'));
    btnFlowUnlocked.addEventListener('click', () => setMitmVisualizerMode('unlocked'));
  }

  const speedSlider = document.getElementById('speedSlider');
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      onSpeedChange(parseInt(e.target.value, 10));
    });
  }

  const btnBleConnect = document.getElementById('btnBleConnect');
  if (btnBleConnect) {
    btnBleConnect.addEventListener('click', toggleBleConnection);
  }

  const btnSimToggle = document.getElementById('btnSimToggle');
  if (btnSimToggle) {
    btnSimToggle.addEventListener('click', toggleSimulatorMode);
  }
}

/**
 * 4. Signal Flow Architecture Visualizer State
 */
window.setMitmVisualizerMode = function(mode) {
  activeMitmMode = mode;
  updateVisualizer(mode);
};

function updateVisualizer(mode) {
  const btnLegal = document.getElementById('btnFlowLegal');
  const btnUnlocked = document.getElementById('btnFlowUnlocked');
  const nodeMitm = document.getElementById('nodeMitm');
  const packetModeLabel = document.getElementById('packetModeLabel');
  const byteStreamDisplay = document.getElementById('byteStreamDisplay');
  const mitmDescription = document.getElementById('mitmDescription');

  if (!btnLegal || !btnUnlocked) return;

  if (mode === 'legal') {
    btnLegal.classList.add('active');
    btnUnlocked.classList.remove('active');
    if (nodeMitm) nodeMitm.classList.remove('mitm-active');

    if (packetModeLabel) {
      packetModeLabel.textContent = 'MODE: TRANSPARENT LEGAL PASS-THROUGH (25 km/h STOCK)';
    }
    if (byteStreamDisplay) {
      byteStreamDisplay.innerHTML = `
        <span class="byte">0x59</span>
        <span class="byte">0x12</span>
        <span class="byte">0x02</span>
        <span class="byte">0x19 [25 km/h]</span>
        <span class="byte">0x00</span>
        <span class="byte calc">0x72 [STOCK CRC]</span>
      `;
    }
    if (mitmDescription) {
      mitmDescription.innerHTML = '<strong>Transparent Pass-Through:</strong> Packets flow unaltered with factory <strong>25.0 km/h</strong> limiter (100% compliant with EN 15194).';
    }
  } else {
    btnUnlocked.classList.add('active');
    btnLegal.classList.remove('active');
    if (nodeMitm) nodeMitm.classList.add('mitm-active');

    if (packetModeLabel) {
      packetModeLabel.textContent = 'MODE: ACTIVE TELEMETRY SPOOFING (33 km/h UNLOCKED)';
    }
    if (byteStreamDisplay) {
      byteStreamDisplay.innerHTML = `
        <span class="byte">0x59</span>
        <span class="byte">0x12</span>
        <span class="byte">0x02</span>
        <span class="byte highlight">0x21 [33 km/h]</span>
        <span class="byte">0x00</span>
        <span class="byte calc">0x7E [NEW CRC]</span>
      `;
    }
    if (mitmDescription) {
      mitmDescription.innerHTML = '<strong>Active Interception:</strong> ESP32-C3 dynamically rewrites limit byte to <strong>33.0 km/h</strong> (0x21) and recalculates packet checksum.';
    }
  }
}

/**
 * 5. Web BLE Companion App Logic
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

  sendSpeedCommand(speed);
}

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
    showToast("⚠️ Web Bluetooth is not supported.");
    return;
  }

  try {
    statusText.textContent = "Scanning for TenWayOut...";
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "Tenways" }, { namePrefix: "TenWayOut" }],
      optionalServices: [SERVICE_UUID]
    });

    bleDevice.addEventListener('gattserverdisconnected', onBleDisconnected);
    
    statusText.textContent = "Connecting...";
    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    bleCharacteristic = await service.getCharacteristic(CHAR_UUID);

    isSimulating = false;
    
    statusDot.className = "status-dot connected";
    statusText.textContent = `Connected: ${bleDevice.name || 'TenWayOut'}`;
    connectBtn.textContent = "Disconnect Bike";
    connectBtn.classList.add('orange');

    showToast("✅ Connected to TenWayOut Module via BLE!");
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

  if (statusDot) statusDot.className = "status-dot simulated";
  if (statusText) statusText.textContent = "Disconnected (Sim Active)";
  if (connectBtn) {
    connectBtn.textContent = "⚡ Connect Bike via BLE";
    connectBtn.classList.remove('orange');
  }
  isSimulating = true;
}

async function sendSpeedCommand(speed) {
  if (bleCharacteristic) {
    try {
      const buffer = new Uint8Array([0x59, 0x01, speed, (0x59 + 0x01 + speed) & 0xFF]);
      await bleCharacteristic.writeValue(buffer);
      showToast(`⚡ Sent Speed Limit: ${speed} km/h to ESP32-C3`);
    } catch (e) {
      console.warn("BLE write error:", e);
    }
  }
}

function toggleSimulatorMode() {
  isSimulating = !isSimulating;
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  
  if (isSimulating) {
    if (statusText) statusText.textContent = "Disconnected (Sim Active)";
    if (statusDot) statusDot.className = "status-dot simulated";
    showToast("🧪 Telemetry simulation resumed");
  } else {
    if (statusText) statusText.textContent = "Idle / Disconnected";
    if (statusDot) statusDot.className = "status-dot";
    showToast("⏸️ Telemetry simulation paused");
  }
}

/**
 * 6. Realistic Telemetry Simulator Engine
 */
function startTelemetrySimulator() {
  let simSpeed = 24.5;
  let targetSpeed = 33.0;

  if (simInterval) clearInterval(simInterval);

  simInterval = setInterval(() => {
    if (!isSimulating) return;

    targetSpeed = currentSpeedSetting;
    const delta = (targetSpeed - simSpeed) * 0.12;
    simSpeed += delta + (Math.random() * 0.4 - 0.2);
    if (simSpeed < 0) simSpeed = 0;

    const liveSpeedEl = document.getElementById('liveSpeedValue');
    const liveWattsEl = document.getElementById('liveWattsValue');
    const liveVoltsEl = document.getElementById('liveVoltsValue');
    const liveAssistEl = document.getElementById('liveAssistValue');

    if (liveSpeedEl) liveSpeedEl.textContent = simSpeed.toFixed(1);

    const calculatedWatts = Math.min(250, Math.max(45, Math.round(simSpeed * 7.5 + (Math.random() * 20 - 10))));
    if (liveWattsEl) liveWattsEl.textContent = `${calculatedWatts} W`;

    const batteryVoltage = (41.2 - (simSpeed * 0.03)).toFixed(1);
    if (liveVoltsEl) liveVoltsEl.textContent = `${batteryVoltage} V`;

    if (liveAssistEl) {
      if (simSpeed >= currentSpeedSetting + 0.5) {
        liveAssistEl.textContent = 'CUTOFF';
        liveAssistEl.style.color = '#EF4444';
      } else {
        liveAssistEl.textContent = 'ASSISTING';
        liveAssistEl.style.color = 'var(--energy-d)';
      }
    }
  }, 300);
}

/**
 * 7. Neo-Brutalist Toast Notification Utility
 */
function showToast(message) {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.backgroundColor = '#0A0A0A';
    toast.style.color = '#00CC74';
    toast.style.border = '3px solid #0A0A0A';
    toast.style.borderRadius = '8px';
    toast.style.padding = '12px 20px';
    toast.style.fontFamily = 'Space Mono, monospace';
    toast.style.fontWeight = '700';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '6px 6px 0px #00CC74';
    toast.style.zIndex = '9999';
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3500);
}
