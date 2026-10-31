import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../services/api';
import { Wifi, X, Copy, Check, Server, Radio, ExternalLink } from 'lucide-react';

interface LanConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanConnectModal: React.FC<LanConnectModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<any>(null);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      api.getStatus().then(data => {
        setStatus(data);
        const hostUrl = data.localUrls?.[0] || window.location.origin;
        setSelectedUrl(hostUrl);
      }).catch(err => {
        console.warn('Failed to fetch status', err);
        setSelectedUrl(window.location.origin);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedUrl) {
      QRCode.toDataURL(selectedUrl, { width: 180, margin: 1 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
    }
  }, [selectedUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (selectedUrl) {
      navigator.clipboard.writeText(selectedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wifi className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-semibold">Local LAN Synchronization Hub</h3>
              <p className="text-xs text-slate-400">Zero-cloud local Wi-Fi connectivity</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* LAN Connection instructions */}
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <p className="font-semibold text-slate-800 mb-1">How Field Volunteers Connect:</p>
            <p>1. Connect laptops, tablets, or phones to the camp Wi-Fi or mobile hotspot.</p>
            <p>2. Scan this QR code or navigate to the IP address below in any modern browser.</p>
            <p>3. All stations sync instantaneously via embedded local WebSocket and SQLite.</p>
          </div>

          {/* QR Code and URL */}
          <div className="flex flex-col sm:flex-row items-center gap-5 bg-white border border-slate-200 rounded-lg p-4">
            <div className="shrink-0 flex flex-col items-center">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="LAN QR" className="w-36 h-36 border border-slate-200 rounded p-1" />
              ) : (
                <div className="w-36 h-36 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
              <span className="text-[11px] text-slate-500 mt-1.5 font-medium">Point Camera to Join</span>
            </div>

            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Host Server Address</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={selectedUrl}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className="p-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors shrink-0"
                    title="Copy URL"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {status?.ips && status.ips.length > 1 && (
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Available Interfaces:</span>
                  <div className="flex flex-wrap gap-1">
                    {status.ips.map((ip: string) => {
                      const url = `http://${ip}:${status.port || 3000}`;
                      const isActive = selectedUrl === url;
                      return (
                        <button
                          key={ip}
                          onClick={() => setSelectedUrl(url)}
                          className={`text-[11px] font-mono px-2 py-1 rounded transition-colors ${
                            isActive ? 'bg-slate-900 text-white font-medium' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {ip}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Telemetry Status */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Server className="w-3.5 h-3.5 text-slate-700" />
                <span className="font-medium">Embedded SQLite DB</span>
              </div>
              <div className="font-mono text-slate-900 font-semibold">Local WAL Mode Active</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Zero Cloud Required</div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium">Active LAN Clients</span>
              </div>
              <div className="font-mono text-slate-900 font-semibold">
                {status?.connectedClients || 1} Connected Device(s)
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">Real-Time WebSocket Sync</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
