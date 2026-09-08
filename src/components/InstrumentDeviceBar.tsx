"use client";

import { useEffect, useState } from "react";
import { scaleManager, type ScaleReading, type ScaleConnectionStatus } from "@/lib/device/weighingScale";

interface Props {
  unit: string;
  onCaptureWeight?: (weight: number) => void;
  onAutoFillWeight?: (weight: number) => void;
}

export function InstrumentDeviceBar({ unit, onCaptureWeight, onAutoFillWeight }: Props) {
  const [status, setStatus] = useState<ScaleConnectionStatus>(scaleManager.getStatus());
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [wifiUrl, setWifiUrl] = useState("192.168.1.50:8080");
  const [autoFill, setAutoFill] = useState(false);
  const [simWeightInput, setSimWeightInput] = useState("10.5");
  const [lastAutoFilled, setLastAutoFilled] = useState<number | null>(null);

  useEffect(() => {
    const unsubStatus = scaleManager.subscribeStatus(setStatus);
    const unsubReading = scaleManager.subscribeReading((r) => {
      setReading(r);

      // Auto-Fill logic if enabled and weight is stable
      if (autoFill && r.isStable && r.weight !== lastAutoFilled && onAutoFillWeight) {
        setLastAutoFilled(r.weight);
        onAutoFillWeight(r.weight);
      }
    });

    return () => {
      unsubStatus();
      unsubReading();
    };
  }, [autoFill, lastAutoFilled, onAutoFillWeight]);

  const handleConnectBt = async () => {
    setShowModal(false);
    await scaleManager.connectBluetooth(unit);
  };

  const handleConnectWifi = () => {
    setShowModal(false);
    scaleManager.connectWifiUrl(wifiUrl, unit);
  };

  const handleConnectSerial = async () => {
    setShowModal(false);
    await scaleManager.connectSerial(9600, unit);
  };

  const handleStartSim = () => {
    setShowModal(false);
    scaleManager.startSimulator(Number(simWeightInput) || 10.5, unit);
  };

  const handleDisconnect = () => {
    setShowModal(false);
    scaleManager.disconnect();
    setReading(null);
  };

  const handleManualCapture = () => {
    if (reading && onCaptureWeight) {
      onCaptureWeight(reading.weight);
    }
  };

  const handleSimValueChange = (val: string) => {
    setSimWeightInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && status.type === "simulator") {
      scaleManager.setSimulatedWeight(num);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* LEFT: Connection status & modal trigger */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400">
            📡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Automatic Scale Sync</span>
              {status.isConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {status.type.toUpperCase()}: {status.deviceName || "Connected"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">
                  Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">Direct weight reading capture via Wi-Fi, Bluetooth BLE or RS232 Serial</p>
          </div>
        </div>

        {/* CENTER: Digital Indicator LED Display */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-black/60 px-4 py-2 font-mono">
          <div className="text-right">
            <div className="text-[10px] uppercase text-slate-400">Live Indication</div>
            <div className="text-2xl font-bold tracking-tight text-emerald-400">
              {reading ? reading.weight.toFixed(3) : "----.--"}
              <span className="ml-1 text-sm font-normal text-slate-400">{reading?.unit || unit}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-[10px]">
            <span className={`rounded px-1.5 py-0.5 text-center font-bold ${reading?.isStable ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-amber-950 text-amber-400 border border-amber-800"}`}>
              {reading?.isStable ? "STABLE" : "MOTION"}
            </span>
            {reading?.isZero && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-center text-slate-300">ZERO</span>}
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {status.isConnected ? (
            <>
              <button
                type="button"
                onClick={handleManualCapture}
                disabled={!reading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-teal-500 disabled:opacity-50"
              >
                📥 Capture Live Weight ({reading ? `${reading.weight} ${reading.unit}` : "—"})
              </button>

              <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs cursor-pointer hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={autoFill}
                  onChange={(e) => setAutoFill(e.target.checked)}
                  className="h-3.5 w-3.5 accent-teal-500"
                />
                Auto-fill when stable
              </label>

              <button
                type="button"
                onClick={handleDisconnect}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-rose-950 hover:text-rose-300"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-teal-500"
            >
              🔌 Connect Weighing Scale
            </button>
          )}
        </div>
      </div>

      {/* Simulator quick slider bar if simulator active */}
      {status.type === "simulator" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3 text-xs">
          <span className="font-semibold text-amber-400">🧪 Hardware Simulator Control:</span>
          <label className="flex items-center gap-2">
            <span>Target Weight:</span>
            <input
              type="number"
              step="any"
              value={simWeightInput}
              onChange={(e) => handleSimValueChange(e.target.value)}
              className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
            />
            <span>{unit}</span>
          </label>
          <div className="flex gap-1">
            {[0, 10, 25, 50, 100, 200, 500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSimValueChange(String(preset))}
                className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-teal-900 hover:text-teal-200"
              >
                {preset} {unit}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DIALOG */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-slate-900">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Connect Weighing Instrument</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="my-5 space-y-4 text-sm">
              {/* Option 1: Bluetooth */}
              <div className="rounded-xl border border-slate-200 p-4 hover:border-teal-600 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">📶 Bluetooth BLE Scale</div>
                    <div className="text-xs text-slate-500">Connect to GATT Weight Scale Service (0x181D) or HM-10/ESP32 BLE module</div>
                  </div>
                  <button onClick={handleConnectBt} className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800">
                    Pair Bluetooth
                  </button>
                </div>
              </div>

              {/* Option 2: Wi-Fi / Local Network */}
              <div className="rounded-xl border border-slate-200 p-4 hover:border-teal-600 transition">
                <div className="font-semibold text-slate-900 mb-1">🌐 Wi-Fi / Network Scale</div>
                <div className="text-xs text-slate-500 mb-2">Connect to Wi-Fi Indicator via WebSocket (ws://) or HTTP IP API</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wifiUrl}
                    onChange={(e) => setWifiUrl(e.target.value)}
                    placeholder="192.168.1.50:8080 or ws://192.168.1.50/ws"
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button onClick={handleConnectWifi} className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800">
                    Connect IP
                  </button>
                </div>
              </div>

              {/* Option 3: RS232 Serial / USB */}
              <div className="rounded-xl border border-slate-200 p-4 hover:border-teal-600 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">🔌 Serial RS232 / USB COM Port</div>
                    <div className="text-xs text-slate-500">Direct COM port connection at 9600 baud (Web Serial API)</div>
                  </div>
                  <button onClick={handleConnectSerial} className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800">
                    Select Port
                  </button>
                </div>
              </div>

              {/* Option 4: Hardware Simulator */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 hover:border-amber-400 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-amber-900">🧪 Hardware Test Simulator</div>
                    <div className="text-xs text-amber-700">Simulate live scale data for demo without physical instrument</div>
                  </div>
                  <button onClick={handleStartSim} className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800">
                    Start Sim
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t pt-3">
              <button onClick={() => setShowModal(false)} className="rounded border px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
