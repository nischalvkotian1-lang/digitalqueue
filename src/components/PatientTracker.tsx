import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Patient, AuditEntry, StationType } from '../types/queue';
import { PrintableToken } from './PrintableToken';
import { 
  Search, 
  User, 
  Clock, 
  Printer, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  Radio,
  Users,
  Building,
  Volume2
} from 'lucide-react';

interface PatientTrackerProps {
  initialToken?: string;
}

export const PatientTracker: React.FC<PatientTrackerProps> = ({ initialToken }) => {
  const [searchQuery, setSearchQuery] = useState(initialToken || '');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // Real-time queue metrics for the tracked token
  const [patientsAhead, setPatientsAhead] = useState<number | null>(null);
  const [totalStationWaiting, setTotalStationWaiting] = useState<number | null>(null);

  // Parse token from either hash (#tracker?token=GEN-110) or query string (?token=GEN-110)
  const extractTokenFromUrl = (): string => {
    if (initialToken) return initialToken;

    // 1. Check window.location.hash
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '');
      const queryIdx = hash.indexOf('?');
      if (queryIdx !== -1) {
        const queryStr = hash.substring(queryIdx + 1);
        const params = new URLSearchParams(queryStr);
        const tok = params.get('token');
        if (tok) return tok;
      }
    }

    // 2. Check window.location.search
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const tok = params.get('token');
      if (tok) return tok;
    }

    return '';
  };

  // Perform token lookup and load patient details
  const lookupToken = async (tok: string) => {
    if (!tok.trim()) return;
    setIsLoading(true);
    try {
      const results = await api.searchPatients(tok.trim());
      setSearchResults(results);

      // Match exact token number if available, else first result
      const matched = results.find(p => p.token_number.toLowerCase() === tok.trim().toLowerCase()) || results[0];
      if (matched) {
        await loadPatientDetails(matched.id);
      } else {
        setSelectedPatient(null);
        setPatientsAhead(null);
      }
    } catch (err) {
      console.error('Error looking up token:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate patients ahead in queue
  const calculateQueuePosition = async (patient: Patient) => {
    if (patient.status === 'COMPLETED' || patient.status === 'CANCELLED') {
      setPatientsAhead(0);
      setTotalStationWaiting(0);
      return;
    }

    if (patient.status === 'CALLED' || patient.status === 'IN_SERVICE') {
      setPatientsAhead(0);
      setTotalStationWaiting(0);
      return;
    }

    try {
      const stationQueue = await api.getQueue(patient.current_station, patient.department);
      const waitingList = stationQueue.filter(p => p.status === 'WAITING');
      setTotalStationWaiting(waitingList.length);

      const priorityWeight: Record<string, number> = {
        'URGENT': 1,
        'ELDERLY': 2,
        'PREGNANT': 3,
        'PEDIATRIC': 4,
        'NORMAL': 5
      };

      const myWeight = priorityWeight[patient.priority] || 5;

      // Count how many are ahead of this patient
      const aheadCount = waitingList.filter(other => {
        if (other.id === patient.id) return false;
        const otherWeight = priorityWeight[other.priority] || 5;
        if (otherWeight < myWeight) return true;
        if (otherWeight === myWeight && other.queued_at < patient.queued_at) return true;
        return false;
      }).length;

      setPatientsAhead(aheadCount);
    } catch (err) {
      console.warn('Failed to calculate queue position:', err);
    }
  };

  const loadPatientDetails = async (id: number) => {
    setIsLoading(true);
    try {
      const full = await api.getPatientDetails(id);
      setSelectedPatient(full);
      setAuditLog((full as any).audit || []);
      await calculateQueuePosition(full);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // On mount and URL change, check for token parameter
  useEffect(() => {
    const urlToken = extractTokenFromUrl();
    if (urlToken) {
      setSearchQuery(urlToken);
      lookupToken(urlToken);
    }

    const handleHashChange = () => {
      const newTok = extractTokenFromUrl();
      if (newTok) {
        setSearchQuery(newTok);
        lookupToken(newTok);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [initialToken]);

  // Subscribe to real-time WebSocket events to update position live
  useEffect(() => {
    const unsubscribe = api.subscribe((msg) => {
      if (msg.type === 'QUEUE_UPDATED' || msg.type === 'PATIENT_CALLED' || msg.type === 'INIT') {
        if (selectedPatient) {
          loadPatientDetails(selectedPatient.id);
        }
      }
    });
    return () => unsubscribe();
  }, [selectedPatient?.id]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    lookupToken(searchQuery.trim());
  };

  // Helper for station readable label
  const getStationLabel = (st: StationType) => {
    switch (st) {
      case 'TRIAGE': return 'Triage Desk (Vitals)';
      case 'CONSULTATION': return 'Doctor Consultation';
      case 'LAB': return 'Diagnostic Lab';
      case 'PHARMACY': return 'Pharmacy & Dispensary';
      case 'DISCHARGED': return 'Discharged / Completed';
      default: return st;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Live Patient & Queue Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time token status, queue position, station progress, and clinical records
          </p>
        </div>

        {selectedPatient && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active
            </span>
          </div>
        )}
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
          className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shrink-0"
        >
          {isLoading ? 'Checking...' : 'Track Token'}
        </button>
      </form>

      {/* Prominent Live Queue Status Banner when patient is selected */}
      {selectedPatient && (
        <div className="mb-8 bg-white border-2 border-slate-900 rounded-2xl p-6 shadow-md overflow-hidden relative">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            {/* 1. Token Number & Department */}
            <div className="border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Current Token Number
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono text-slate-950 mt-1 tabular-nums">
                {selectedPatient.token_number}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-1">
                {selectedPatient.name} · {selectedPatient.department}
              </div>
            </div>

            {/* 2. Assigned Station / Department */}
            <div className="border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Assigned Station
              </span>
              <div className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                <Building className="w-5 h-5 text-slate-700 shrink-0" />
                <span>{getStationLabel(selectedPatient.current_station)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {selectedPatient.current_counter ? `Assigned to ${selectedPatient.current_counter}` : 'Waiting for counter assignment'}
              </div>
            </div>

            {/* 3. Queue Status */}
            <div className="border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Queue Status
              </span>
              <div className="mt-1">
                {selectedPatient.status === 'CALLED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 font-bold text-sm rounded-lg uppercase tracking-wide animate-bounce">
                    <Volume2 className="w-4 h-4" />
                    Now Called!
                  </span>
                ) : selectedPatient.status === 'IN_SERVICE' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500 text-white font-bold text-sm rounded-lg uppercase tracking-wide">
                    <Activity className="w-4 h-4" />
                    In Service
                  </span>
                ) : selectedPatient.status === 'COMPLETED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white font-bold text-sm rounded-lg uppercase tracking-wide">
                    <CheckCircle2 className="w-4 h-4" />
                    Completed
                  </span>
                ) : selectedPatient.status === 'NO_SHOW' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 font-bold text-sm rounded-lg uppercase tracking-wide">
                    <AlertCircle className="w-4 h-4" />
                    No-Show
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white font-bold text-sm rounded-lg uppercase tracking-wide">
                    <Clock className="w-4 h-4" />
                    Waiting
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Priority: <span className="font-semibold text-slate-800">{selectedPatient.priority}</span>
              </div>
            </div>

            {/* 4. Patients Ahead In Line */}
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
                Patients Ahead In Line
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                {selectedPatient.status === 'WAITING' ? (
                  <>
                    <span className="text-4xl font-black font-mono text-slate-950 tabular-nums">
                      {patientsAhead !== null ? patientsAhead : '--'}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {patientsAhead === 0 ? 'You are next in line!' : 'patients ahead of you'}
                    </span>
                  </>
                ) : selectedPatient.status === 'CALLED' ? (
                  <span className="text-sm font-bold text-amber-700">
                    Proceed immediately to {selectedPatient.current_counter || 'station counter'}
                  </span>
                ) : selectedPatient.status === 'IN_SERVICE' ? (
                  <span className="text-sm font-bold text-sky-700">
                    Currently in examination room
                  </span>
                ) : selectedPatient.status === 'COMPLETED' ? (
                  <span className="text-sm font-bold text-emerald-700">
                    Camp visit complete · Medications received
                  </span>
                ) : (
                  <span className="text-sm font-medium text-slate-500">
                    Please contact registration desk
                  </span>
                )}
              </div>
              {selectedPatient.status === 'WAITING' && totalStationWaiting !== null && (
                <div className="text-[11px] text-slate-400 mt-1">
                  Total {totalStationWaiting} waiting at this station
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Search results & full timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Search Results List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-[580px]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-3 border-b border-slate-100 mb-2">
            Matching Records ({searchResults.length})
          </h2>

          <div className="flex-1 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
            {searchResults.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                <User className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                <span>Search for a token or scan receipt QR code</span>
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
                      {p.department} · {getStationLabel(p.current_station)}
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
              {/* Patient Header Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedPatient.name} ({selectedPatient.age} Y · {selectedPatient.gender === 'M' ? 'Male' : selectedPatient.gender === 'F' ? 'Female' : 'Other'})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Admitted: {new Date(selectedPatient.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Priority: {selectedPatient.priority}
                  </p>
                </div>

                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors self-start cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Reprint Receipt</span>
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
                          Station: <span className="font-medium text-slate-800">{getStationLabel(log.station as StationType)}</span> ({log.counter})
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
              <p className="text-sm font-medium text-slate-600">No patient selected</p>
              <p className="text-xs text-slate-400 mt-1">Enter a token number above or scan your receipt QR code to view live status</p>
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
