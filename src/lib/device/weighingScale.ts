/**
 * SmartNAWI - Weighing Instrument Automatic Data Acquisition Engine
 * Supports Web Bluetooth (BLE), Wi-Fi (WebSocket/REST), Web Serial (RS232/USB/BT-SPP), and Simulator Mode.
 */

export interface ScaleReading {
  weight: number;
  unit: string;
  isStable: boolean;
  isZero: boolean;
  isTare: boolean;
  raw: string;
  timestamp: number;
}

export type ConnectionType = "bluetooth" | "wifi" | "serial" | "simulator" | "disconnected";

export interface ScaleConnectionStatus {
  type: ConnectionType;
  isConnected: boolean;
  deviceName?: string;
  error?: string | null;
}

export type ScaleReadingCallback = (reading: ScaleReading) => void;
export type StatusChangeCallback = (status: ScaleConnectionStatus) => void;

/**
 * Regex parser for extracting weight, stability, and unit from common weighing indicator ASCII streams.
 * Example formats:
 * - "ST,GS,+0010.500kg\r\n" (CAS, Mettler Toledo)
 * - "US,GS,+0008.200kg\r\n"
 * - "+  10.500 kg"
 * - "10.500 kg ST"
 * - "WN0010.500kg"
 */
export function parseScaleAscii(rawLine: string, defaultUnit: string = "kg"): ScaleReading | null {
  const line = rawLine.trim();
  if (!line) return null;

  const isStable = /ST|STABLE|OK|S/i.test(line) && !/US|UNSTABLE|MOTION|M/i.test(line);
  const isZero = /ZERO|Z/i.test(line) || parseFloat(line) === 0;
  const isTare = /TARE|NET|N/i.test(line);

  // Extract number (supports negatives and decimals)
  const numMatch = line.match(/[-+]?\d*\.?\d+/);
  if (!numMatch) return null;

  const weight = parseFloat(numMatch[0]);
  if (isNaN(weight)) return null;

  // Extract unit if present
  let unit = defaultUnit;
  if (/kg/i.test(line)) unit = "kg";
  else if (/\bg\b/i.test(line)) unit = "g";
  else if (/mg/i.test(line)) unit = "mg";
  else if (/lb/i.test(line)) unit = "lb";
  else if (/\bt\b/i.test(line)) unit = "t";

  return {
    weight,
    unit,
    isStable,
    isZero,
    isTare,
    raw: line,
    timestamp: Date.now(),
  };
}

export class WeighingScaleManager {
  private status: ScaleConnectionStatus = { type: "disconnected", isConnected: false };
  private onReadingCallbacks: Set<ScaleReadingCallback> = new Set();
  private onStatusCallbacks: Set<StatusChangeCallback> = new Set();

  // Bluetooth references
  private bluetoothDevice: any = null;
  private bluetoothGatt: any = null;

  // Serial references
  private serialPort: any = null;
  private serialReader: any = null;
  private serialKeepReading = false;

  // Wi-Fi / WebSocket references
  private ws: WebSocket | null = null;
  private pollTimer: any = null;

  // Simulator references
  private simTimer: any = null;
  private simTargetWeight = 0;
  private simCurrentWeight = 0;
  private simUnit = "kg";
  private simIsStable = true;

  public subscribeReading(cb: ScaleReadingCallback): () => void {
    this.onReadingCallbacks.add(cb);
    return () => this.onReadingCallbacks.delete(cb);
  }

  public subscribeStatus(cb: StatusChangeCallback): () => void {
    this.onStatusCallbacks.add(cb);
    cb(this.status);
    return () => this.onStatusCallbacks.delete(cb);
  }

  private notifyReading(reading: ScaleReading) {
    this.onReadingCallbacks.forEach((cb) => cb(reading));
  }

  private updateStatus(status: ScaleConnectionStatus) {
    this.status = status;
    this.onStatusCallbacks.forEach((cb) => cb(status));
  }

  public getStatus(): ScaleConnectionStatus {
    return this.status;
  }

  // =========================================================================
  // 1. BLUETOOTH (Web Bluetooth BLE)
  // =========================================================================
  public async connectBluetooth(defaultUnit = "kg"): Promise<boolean> {
    this.disconnect();
    this.updateStatus({ type: "bluetooth", isConnected: false, deviceName: "Connecting..." });

    try {
      if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
        throw new Error("Web Bluetooth API is not supported in this browser. Use Chrome, Edge, or Opera.");
      }

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "0000181d-0000-1000-8000-00805f9b34fb", // Standard Weight Scale Service 0x181D
          "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 / HC-08 Serial
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service
        ],
      });

      this.bluetoothDevice = device;
      device.addEventListener("gattserverdisconnected", () => {
        this.updateStatus({ type: "disconnected", isConnected: false, error: "Bluetooth scale disconnected." });
      });

      const server = await device.gatt.connect();
      this.bluetoothGatt = server;

      // Try finding services
      let scaleChar: any = null;

      try {
        // Standard Weight Scale Service
        const service = await server.getPrimaryService("0000181d-0000-1000-8000-00805f9b34fb");
        scaleChar = await service.getCharacteristic("00002a9d-0000-1000-8000-00805f9b34fb");
      } catch {
        // Fallback to custom BLE UART services (e.g. HM-10 or Nordic UART)
        const services = await server.getPrimaryServices();
        for (const s of services) {
          const chars = await s.getCharacteristics();
          const notifyChar = chars.find((c: any) => c.properties.notify || c.properties.indicate);
          if (notifyChar) {
            scaleChar = notifyChar;
            break;
          }
        }
      }

      if (!scaleChar) {
        throw new Error("No readable Bluetooth characteristic found on device.");
      }

      await scaleChar.startNotifications();
      let asciiBuffer = "";

      scaleChar.addEventListener("characteristicvaluechanged", (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder();
        const text = decoder.decode(value);

        // Check if raw BLE Weight Scale format (IEEE-11073 binary)
        if (value.byteLength >= 3 && value.getUint8(0) !== 0x53 && value.getUint8(0) !== 0x55) {
          const flags = value.getUint8(0);
          const isLbs = (flags & 0x01) !== 0;
          let weightVal = value.getUint16(1, true); // 16-bit uint
          if ((flags & 0x01) === 0) weightVal = weightVal / 200; // standard 0.005kg resolution
          const isStable = (flags & 0x08) === 0;

          this.notifyReading({
            weight: Number(weightVal.toFixed(4)),
            unit: isLbs ? "lb" : defaultUnit,
            isStable,
            isZero: weightVal === 0,
            isTare: false,
            raw: `BLE: ${weightVal}`,
            timestamp: Date.now(),
          });
        } else {
          // ASCII stream
          asciiBuffer += text;
          if (asciiBuffer.includes("\n") || asciiBuffer.includes("\r")) {
            const lines = asciiBuffer.split(/[\r\n]+/);
            for (let i = 0; i < lines.length - 1; i++) {
              const parsed = parseScaleAscii(lines[i], defaultUnit);
              if (parsed) this.notifyReading(parsed);
            }
            asciiBuffer = lines[lines.length - 1];
          }
        }
      });

      this.updateStatus({
        type: "bluetooth",
        isConnected: true,
        deviceName: device.name || "Bluetooth Scale",
      });
      return true;
    } catch (err: any) {
      this.updateStatus({
        type: "disconnected",
        isConnected: false,
        error: err.message || "Failed to connect to Bluetooth scale.",
      });
      return false;
    }
  }

  // =========================================================================
  // 2. WI-FI / NETWORK (WebSocket or REST API)
  // =========================================================================
  public connectWifiUrl(url: string, defaultUnit = "kg"): boolean {
    this.disconnect();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      this.updateStatus({ type: "disconnected", isConnected: false, error: "Invalid Wi-Fi URL/IP" });
      return false;
    }

    if (cleanUrl.startsWith("ws://") || cleanUrl.startsWith("wss://")) {
      return this.connectWebSocket(cleanUrl, defaultUnit);
    } else {
      return this.connectHttpPolling(cleanUrl, defaultUnit);
    }
  }

  private connectWebSocket(wsUrl: string, defaultUnit: string): boolean {
    this.updateStatus({ type: "wifi", isConnected: false, deviceName: `Connecting to ${wsUrl}...` });

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.updateStatus({ type: "wifi", isConnected: true, deviceName: `Wi-Fi Scale (${wsUrl})` });
      };

      this.ws.onmessage = (event) => {
        try {
          if (typeof event.data === "string") {
            // Check if JSON
            if (event.data.trim().startsWith("{")) {
              const obj = JSON.parse(event.data);
              this.notifyReading({
                weight: Number(obj.weight ?? obj.val ?? 0),
                unit: obj.unit ?? defaultUnit,
                isStable: obj.isStable ?? obj.stable ?? true,
                isZero: obj.isZero ?? obj.zero ?? false,
                isTare: obj.isTare ?? obj.tare ?? false,
                raw: event.data,
                timestamp: Date.now(),
              });
            } else {
              const parsed = parseScaleAscii(event.data, defaultUnit);
              if (parsed) this.notifyReading(parsed);
            }
          }
        } catch {
          // Ignore bad packets
        }
      };

      this.ws.onerror = () => {
        this.updateStatus({ type: "disconnected", isConnected: false, error: "Wi-Fi WebSocket error." });
      };

      this.ws.onclose = () => {
        this.updateStatus({ type: "disconnected", isConnected: false, error: "Wi-Fi connection closed." });
      };
      return true;
    } catch (err: any) {
      this.updateStatus({ type: "disconnected", isConnected: false, error: err.message });
      return false;
    }
  }

  private connectHttpPolling(httpUrl: string, defaultUnit: string): boolean {
    let target = httpUrl;
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = "http://" + target;
    }

    this.updateStatus({ type: "wifi", isConnected: true, deviceName: `Wi-Fi Polling (${target})` });

    const poll = async () => {
      try {
        const res = await fetch(target);
        if (!res.ok) return;
        const text = await res.text();
        if (text.trim().startsWith("{")) {
          const obj = JSON.parse(text);
          this.notifyReading({
            weight: Number(obj.weight ?? obj.val ?? 0),
            unit: obj.unit ?? defaultUnit,
            isStable: obj.isStable ?? obj.stable ?? true,
            isZero: obj.isZero ?? obj.zero ?? false,
            isTare: obj.isTare ?? obj.tare ?? false,
            raw: text,
            timestamp: Date.now(),
          });
        } else {
          const parsed = parseScaleAscii(text, defaultUnit);
          if (parsed) this.notifyReading(parsed);
        }
      } catch {
        // Silent poll error
      }
    };

    poll();
    this.pollTimer = setInterval(poll, 500);
    return true;
  }

  // =========================================================================
  // 3. SERIAL / USB / RS232 (Web Serial API)
  // =========================================================================
  public async connectSerial(baudRate = 9600, defaultUnit = "kg"): Promise<boolean> {
    this.disconnect();
    this.updateStatus({ type: "serial", isConnected: false, deviceName: "Selecting COM Port..." });

    try {
      if (typeof navigator === "undefined" || !("serial" in navigator)) {
        throw new Error("Web Serial API is not supported in this browser. Use Chrome, Edge, or Opera.");
      }

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      this.serialPort = port;

      this.updateStatus({ type: "serial", isConnected: true, deviceName: "RS232/USB Serial Scale" });
      this.serialKeepReading = true;

      this.readSerialLoop(defaultUnit);
      return true;
    } catch (err: any) {
      this.updateStatus({ type: "disconnected", isConnected: false, error: err.message || "Failed to open Serial port." });
      return false;
    }
  }

  private async readSerialLoop(defaultUnit: string) {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.serialReader = reader;

    let buffer = "";

    try {
      while (this.serialKeepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          if (buffer.includes("\n") || buffer.includes("\r")) {
            const lines = buffer.split(/[\r\n]+/);
            for (let i = 0; i < lines.length - 1; i++) {
              const parsed = parseScaleAscii(lines[i], defaultUnit);
              if (parsed) this.notifyReading(parsed);
            }
            buffer = lines[lines.length - 1];
          }
        }
      }
    } catch {
      // Reader stopped
    } finally {
      reader.releaseLock();
    }
  }

  // =========================================================================
  // 4. HARDWARE SIMULATOR (For offline testing & demonstration)
  // =========================================================================
  public startSimulator(initialWeight = 10.5, unit = "kg") {
    this.disconnect();
    this.simTargetWeight = initialWeight;
    this.simCurrentWeight = initialWeight;
    this.simUnit = unit;
    this.simIsStable = true;

    this.updateStatus({ type: "simulator", isConnected: true, deviceName: "Digital Scale Hardware Simulator" });

    this.simTimer = setInterval(() => {
      // Small jitter if not stable, settle towards simTargetWeight
      const diff = this.simTargetWeight - this.simCurrentWeight;
      if (Math.abs(diff) > 0.0001) {
        this.simCurrentWeight += diff * 0.4;
        this.simIsStable = Math.abs(this.simTargetWeight - this.simCurrentWeight) < 0.001;
      } else {
        this.simCurrentWeight = this.simTargetWeight;
        this.simIsStable = true;
      }

      const displayWeight = Number(this.simCurrentWeight.toFixed(4));
      this.notifyReading({
        weight: displayWeight,
        unit: this.simUnit,
        isStable: this.simIsStable,
        isZero: displayWeight === 0,
        isTare: false,
        raw: `SIM: ${displayWeight} ${this.simUnit}`,
        timestamp: Date.now(),
      });
    }, 250);
  }

  public setSimulatedWeight(w: number, isStable = true) {
    this.simTargetWeight = w;
    this.simIsStable = isStable;
  }

  // =========================================================================
  // DISCONNECT / CLEANUP
  // =========================================================================
  public disconnect() {
    // Bluetooth
    if (this.bluetoothGatt) {
      try {
        this.bluetoothGatt.disconnect();
      } catch {}
      this.bluetoothGatt = null;
    }
    this.bluetoothDevice = null;

    // Serial
    this.serialKeepReading = false;
    if (this.serialReader) {
      try {
        this.serialReader.cancel();
      } catch {}
      this.serialReader = null;
    }
    if (this.serialPort) {
      try {
        this.serialPort.close();
      } catch {}
      this.serialPort = null;
    }

    // Wi-Fi
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Simulator
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }

    this.updateStatus({ type: "disconnected", isConnected: false });
  }
}

// Singleton global manager instance
export const scaleManager = new WeighingScaleManager();
