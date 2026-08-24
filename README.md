# TenWayOut ⚡ Universal E-Bike Speed Unlock Bridge & Telemetry Proxy

[![Live Website](https://img.shields.io/badge/Website-Live%20on%20GitHub%20Pages-FF5500?style=flat-square&logo=github)](https://github.com)
[![Web Bluetooth](https://img.shields.io/badge/Web%20Bluetooth-Supported-007ACC?style=flat-square&logo=bluetooth)](https://github.com)
[![Speed Unlock](https://img.shields.io/badge/Speed%20Limit-33%2B%20km%2Fh-10B981?style=flat-square)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-black?style=flat-square)](LICENSE)

Official public website, documentation, and Web Bluetooth companion app for **TenWayOut** (the inline Man-In-The-Middle speed modification proxy for Tenways CGO800S and CAN/UART e-bikes).

---

## ⚡ Features
* **Zero Wire-Cutting:** 100% plug-and-play non-destructive inline T-harness installation.
* **Dual Speed Modes:** 25.0 km/h (Legal stock pass-through) ↔ 33.0 km/h (Unlocked US spec).
* **Live Web Bluetooth Companion:** Control speed limits directly in your smartphone browser with no app installation.
* **Cold-Boot Stealth:** Defaults to EN 15194 compliant 25.0 km/h cutoff on power-up for roller test bench (*Rollentestbank*) safety.

---

## 🚀 GitHub Pages Deployment

This repository is configured for automatic deployment with **GitHub Pages**:

1. In your GitHub repository settings, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions** (or select branch `main` / folder `/`).
3. Your site will automatically go live at `https://<your-username>.github.io/<repo-name>/`.
