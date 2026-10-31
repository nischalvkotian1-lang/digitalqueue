import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Patient, CampMeta } from '../types/queue';
import { Printer, X, CheckCircle2 } from 'lucide-react';

interface PrintableTokenProps {
  patient: Patient;
  meta?: CampMeta | null;
  onClose: () => void;
  autoPrint?: boolean;
}

export const PrintableToken: React.FC<PrintableTokenProps> = ({
  patient,
  meta,
  onClose,
  autoPrint = false
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    // Generate QR code encoding patient token and verification payload
    const payload = JSON.stringify({
      token: patient.token_number,
      id: patient.id,
      name: patient.name,
      dept: patient.department
    });
    QRCode.toDataURL(payload, { width: 140, margin: 1 })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error(err));
  }, [patient]);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(patient.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
        {/* On-screen controls */}
        <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-800">Token Generated</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The Printable Area (matches 80mm thermal roll) */}
        <div id="printable-token" className="p-6 bg-white text-slate-900 font-mono text-center">
          <div className="border-b border-dashed border-slate-400 pb-3 mb-3">
            <h2 className="text-base font-bold tracking-tight uppercase text-slate-900">
              {meta?.title || 'Aegis Field Health Camp'}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {meta?.location || 'Sector 4 Community Outreach'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {new Date(patient.created_at).toLocaleDateString()} · {formattedDate}
            </p>
          </div>

          <div className="py-2">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-sans font-medium">Your Token Number</p>
            <div className="text-4xl font-extrabold tracking-tight text-slate-950 my-1 font-mono tabular-nums">
              {patient.token_number}
            </div>
            {patient.priority !== 'NORMAL' && (
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Priority: {patient.priority}
              </p>
            )}
          </div>

          <div className="border-t border-b border-dashed border-slate-300 py-3 my-2 text-left text-xs font-sans space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Patient:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[170px]">{patient.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Age / Sex:</span>
              <span className="font-semibold text-slate-900">{patient.age} Y · {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Specialty:</span>
              <span className="font-semibold text-slate-900">{patient.department}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Next Station:</span>
              <span className="font-bold text-emerald-700">Triage Desk (Vitals)</span>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center my-3">
            {qrDataUrl && (
              <img 
                src={qrDataUrl} 
                alt={`Token ${patient.token_number}`}
                className="w-28 h-28 border border-slate-200 p-1 rounded-sm"
              />
            )}
            <p className="text-[10px] text-slate-500 mt-1">Scan for verification</p>
          </div>

          <div className="border-t border-dashed border-slate-400 pt-3 text-[11px] text-slate-600 font-sans leading-relaxed">
            <p className="font-medium text-slate-800">Instructions:</p>
            <p>1. Proceed to Triage Desk for initial vitals check.</p>
            <p>2. Watch the public display screen for your token call.</p>
            <p>3. Keep this slip with you at every station.</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Done
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
};
