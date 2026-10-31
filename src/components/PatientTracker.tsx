import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Patient, AuditEntry } from '../types/queue';
import { PrintableToken } from './PrintableToken';
import { 
  Search, 
  User, 
  Clock, 
  Printer, 
  Activity, 
  FileText, 
  CheckCircle2, 
  ArrowRight,
  Stethoscope,
  Microscope,
  Pill,
  ShieldCheck
} from 'lucide-react';

export const PatientTracker: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const results = await api.searchPatients(searchQuery.trim());
      setSearchResults(results);
      if (results.length > 0) {
        loadPatientDetails(results[0].id);
      } else {
        setSelectedPatient(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatientDetails = async (id: number) => {
    setIsLoading(true);
    try {
      const full = await api.getPatientDetails(id);
      setSelectedPatient(full);
      setAuditLog((full as any).audit || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Patient Audit Trail & Journey Tracker
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Look up token records, chronological stage timestamps, recorded vitals, and physician notes
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by Token Number (e.g. GEN-101), Patient Name, or Mobile Number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 focus:border-slate-900 focus:outline-hidden shadow-xs"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
        >
          Track Journey
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Search Results List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-[580px]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-3 border-b border-slate-100 mb-2">
            Matching Patients ({searchResults.length})
          </h2>

          <div className="flex-1 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
            {searchResults.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                <User className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                <span>Search for a token or name to view record</span>
              </div>
            ) : (
              searchResults.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => loadPatientDetails(p.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm tabular-nums">
                        {p.token_number}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                        isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.status}
                      </span>
                    </div>

                    <div className="text-xs mt-1 truncate font-medium">
                      {p.name} · {p.age} Y
                    </div>

                    <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                      {p.department} · Station: {p.current_station}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Full Chronological Timeline & Clinical Summary (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedPatient ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              {/* Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-extrabold font-mono text-slate-950 tabular-nums">
                      {selectedPatient.token_number}
                    </span>
                    <span className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded ${
                      selectedPatient.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      selectedPatient.status === 'IN_SERVICE' ? 'bg-sky-100 text-sky-800' :
                      selectedPatient.status === 'CALLED' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {selectedPatient.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1">
                    {selectedPatient.name} ({selectedPatient.age} Y · {selectedPatient.gender === 'M' ? 'Male' : selectedPatient.gender === 'F' ? 'Female' : 'Other'})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Specialty: {selectedPatient.department} · Priority: {selectedPatient.priority}
                  </p>
                </div>

                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors self-start cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Reprint Slip</span>
                </button>
              </div>

              {/* Vitals Summary Strip */}
              {selectedPatient.vitals && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
                    <Activity className="w-4 h-4 text-slate-700" />
                    <span>Recorded Vitals (Triage Desk):</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums text-slate-700">
                    <div>
                      <span className="text-slate-400 font-sans block text-[11px]">Blood Pressure</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {selectedPatient.vitals.bp_systolic || '--'} / {selectedPatient.vitals.bp_diastolic || '--'} mmHg
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[11px]">Heart Rate / Pulse</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {selectedPatient.vitals.pulse || '--'} bpm
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[11px]">Body Temperature</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {selectedPatient.vitals.temperature || '--'} °F
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[11px]">Oxygen (SpO2)</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {selectedPatient.vitals.spo2 || '--'}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chronological Audit Trail */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                  Chronological Camp Journey
                </h3>

                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {auditLog.map((log, idx) => {
                    const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    return (
                      <div key={idx} className="relative text-xs">
                        {/* Dot indicator */}
                        <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-900"></div>

                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 uppercase">
                            {log.action.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-slate-400 tabular-nums">{timeStr}</span>
                        </div>

                        <p className="text-slate-600 mt-0.5">
                          Station: <span className="font-medium text-slate-800">{log.station}</span> ({log.counter})
                        </p>

                        {log.details && (
                          <p className="text-slate-500 mt-0.5 italic">{log.details}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Select or search for a patient record</p>
              <p className="text-xs text-slate-400 mt-1">Full journey from intake to discharge will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Reprint Slip Modal */}
      {showPrintModal && selectedPatient && (
        <PrintableToken
          patient={selectedPatient}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
