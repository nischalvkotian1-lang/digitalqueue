import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { audioService } from '../services/audio';
import { 
  Patient, 
  StationConfig, 
  StationType, 
  Department, 
  PriorityLevel, 
  Vitals 
} from '../types/queue';
import { 
  Stethoscope, 
  Play, 
  Volume2, 
  CheckCircle2, 
  UserX, 
  ArrowRight, 
  Clock, 
  Activity, 
  AlertTriangle, 
  Flame, 
  Heart, 
  Baby, 
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  Pill,
  Microscope,
  RotateCcw
} from 'lucide-react';

export const StationOperatorPortal: React.FC = () => {
  const [stations, setStations] = useState<StationConfig[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('tri-1');
  const [activeStation, setActiveStation] = useState<StationConfig | null>(null);

  const [queueList, setQueueList] = useState<Patient[]>([]);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [noShowList, setNoShowList] = useState<Patient[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Triage Vitals State
  const [vitals, setVitals] = useState<Vitals>({
    bp_systolic: null,
    bp_diastolic: null,
    pulse: null,
    temperature: null,
    spo2: null,
    blood_sugar: null,
    weight: null,
    notes: ''
  });

  // Doctor Consultation State
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptions, setPrescriptions] = useState<string[]>(['Paracetamol 500mg 1 tab TDS x 3d']);
  const [newRx, setNewRx] = useState('');
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([]);

  // Lab Results State
  const [labResultsNote, setLabResultsNote] = useState('');

  // Pharmacy State
  const [dispensedItems, setDispensedItems] = useState<Record<string, boolean>>({});

  // Load Station configs
  useEffect(() => {
    api.getStations().then(data => {
      setStations(data);
      if (data.length > 0) {
        setSelectedStationId(data[0].id);
        setActiveStation(data[0]);
      }
    });
  }, []);

  // Update active station object when selectedStationId changes
  useEffect(() => {
    const st = stations.find(s => s.id === selectedStationId);
    if (st) {
      setActiveStation(st);
    }
  }, [selectedStationId, stations]);

  // Load Queue for this station
  const loadStationData = async () => {
    if (!activeStation) return;
    try {
      const patients = await api.getQueue(activeStation.station_type, activeStation.department);
      
      // Separate waiting, called/in_service, and no_show
      const current = patients.find(p => 
        (p.status === 'CALLED' || p.status === 'IN_SERVICE') && 
        p.current_counter === activeStation.counter_label
      );
      
      // If there's an active patient in this counter, set it
      if (current) {
        setActivePatient(current);
        if (current.vitals) {
          setVitals(current.vitals);
        }
      } else {
        setActivePatient(null);
      }

      // Waiting list (excluding active)
      const waiting = patients.filter(p => p.status === 'WAITING');
      setQueueList(waiting);

      // Fetch search for no-shows
      const allActive = await api.getQueue(activeStation.station_type);
      const noShows = allActive.filter(p => p.status === 'NO_SHOW');
      setNoShowList(noShows);

    } catch (err) {
      console.error('Failed to load station queue', err);
    }
  };

  useEffect(() => {
    loadStationData();
    const unsubscribe = api.subscribe((msg) => {
      if (msg.type === 'QUEUE_UPDATED' || msg.type === 'PATIENT_CALLED' || msg.type === 'INIT') {
        loadStationData();
      }
    });
    return () => unsubscribe();
  }, [activeStation]);

  // Handle Call Next Patient
  const handleCallNext = async (specificId?: number) => {
    if (!activeStation) return;
    setIsLoading(true);
    setActionMsg('');
    try {
      const called = await api.callNext({
        station_id: activeStation.id,
        station_type: activeStation.station_type,
        counter_label: activeStation.counter_label,
        department: activeStation.department,
        specific_patient_id: specificId
      });
      setActivePatient(called);
      if (called.vitals) setVitals(called.vitals);

      // Play local audio chime + speech as preview
      audioService.announceCall(called.token_number, activeStation.counter_label, activeStation.station_type);
      setActionMsg(`Called token ${called.token_number}`);
      loadStationData();
    } catch (err: any) {
      setActionMsg(err.message || 'No patients waiting in queue');
    } finally {
      setIsLoading(false);
    }
  };

  // Repeat Call / Re-chime
  const handleRepeatCall = async () => {
    if (!activePatient || !activeStation) return;
    try {
      await api.recallPatient({
        patient_id: activePatient.id,
        counter_label: activeStation.counter_label,
        station_type: activeStation.station_type
      });
      audioService.announceCall(activePatient.token_number, activeStation.counter_label, activeStation.station_type);
      setActionMsg(`Re-announced token ${activePatient.token_number}`);
    } catch (err: any) {
      setActionMsg('Failed to recall patient');
    }
  };

  // Start Service
  const handleStartService = async () => {
    if (!activePatient || !activeStation) return;
    setIsLoading(true);
    try {
      const updated = await api.startService({
        patient_id: activePatient.id,
        station_type: activeStation.station_type,
        counter_label: activeStation.counter_label
      });
      setActivePatient(updated);
      setActionMsg('Service started');
      loadStationData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark No-Show
  const handleMarkNoShow = async () => {
    if (!activePatient || !activeStation) return;
    setIsLoading(true);
    try {
      await api.markNoShow({
        patient_id: activePatient.id,
        station_type: activeStation.station_type,
        counter_label: activeStation.counter_label
      });
      setActivePatient(null);
      resetForms();
      setActionMsg(`Marked ${activePatient.token_number} as No-Show`);
      loadStationData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Forward to Next Station or Discharge
  const handleForward = async (nextStation: StationType) => {
    if (!activePatient || !activeStation) return;
    setIsLoading(true);
    try {
      await api.forwardPatient({
        patient_id: activePatient.id,
        current_station: activeStation.station_type,
        counter_label: activeStation.counter_label,
        next_station: nextStation,
        vitals_data: activeStation.station_type === 'TRIAGE' ? vitals : undefined,
        clinical_notes: clinicalNotes || undefined,
        diagnosis: diagnosis || undefined,
        prescriptions: prescriptions.length > 0 ? prescriptions : undefined,
        lab_tests: selectedLabTests.length > 0 ? selectedLabTests : undefined,
        doctor_name: activeStation.operator_name || undefined
      });

      const nextLabel = nextStation === 'DISCHARGED' ? 'Discharged' : `Forwarded to ${nextStation}`;
      setActionMsg(`Token ${activePatient.token_number} ${nextLabel}`);
      setActivePatient(null);
      resetForms();
      loadStationData();
    } catch (err: any) {
      setActionMsg(err.message || 'Failed to forward patient');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForms = () => {
    setVitals({
      bp_systolic: null,
      bp_diastolic: null,
      pulse: null,
      temperature: null,
      spo2: null,
      blood_sugar: null,
      weight: null,
      notes: ''
    });
    setClinicalNotes('');
    setDiagnosis('');
    setPrescriptions(['Paracetamol 500mg 1 tab TDS x 3d']);
    setSelectedLabTests([]);
    setLabResultsNote('');
    setDispensedItems({});
  };

  const addPrescription = () => {
    if (newRx.trim()) {
      setPrescriptions([...prescriptions, newRx.trim()]);
      setNewRx('');
    }
  };

  const removePrescription = (idx: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== idx));
  };

  const labTestOptions = [
    'Random Blood Sugar (Glucometer)',
    'Hemoglobin (Hb)',
    'Rapid Malaria Ag (Pf/Pv)',
    'Rapid Dengue NS1/IgM',
    'Urinalysis Dipstick',
    'Rapid Typhoid IgM/IgG',
    'Electrocardiogram (ECG)',
    'Chest X-Ray (Mobile Unit)'
  ];

  const toggleLabTest = (test: string) => {
    if (selectedLabTests.includes(test)) {
      setSelectedLabTests(selectedLabTests.filter(t => t !== test));
    } else {
      setSelectedLabTests([...selectedLabTests, test]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Top Station Selector Strip */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block">Active Workstation & Counter</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="text-base font-bold text-slate-900 bg-transparent border-none p-0 focus:outline-hidden cursor-pointer"
            >
              {stations.map(st => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.counter_label}) · {st.operator_name || st.station_type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {actionMsg && (
            <span className="font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in">
              {actionMsg}
            </span>
          )}

          <div className="text-right">
            <span className="text-slate-500 block">Queue Waiting:</span>
            <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
              {queueList.length} Patient(s)
            </span>
          </div>

          <button
            onClick={loadStationData}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Active Patient Workstation (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {activePatient ? (
            /* Active Patient Card */
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Header Bar with Status */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                    Status: {activePatient.status.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-3xl font-extrabold font-mono tabular-nums tracking-tight text-white">
                      {activePatient.token_number}
                    </span>
                    {activePatient.priority !== 'NORMAL' && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide ${
                        activePatient.priority === 'URGENT' ? 'bg-red-500 text-white' :
                        activePatient.priority === 'ELDERLY' ? 'bg-amber-500 text-slate-950' :
                        activePatient.priority === 'PREGNANT' ? 'bg-rose-500 text-white' : 'bg-sky-400 text-slate-950'
                      }`}>
                        {activePatient.priority}
                      </span>
                    )}
                  </div>
                </div>

                {/* Top Action Buttons: Chime & Status */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRepeatCall}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title="Repeat Audio Chime on Public TV"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Repeat Chime</span>
                  </button>

                  {activePatient.status === 'CALLED' && (
                    <button
                      onClick={handleStartService}
                      disabled={isLoading}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Service</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Patient Basic Demographics Strip */}
              <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs flex flex-wrap items-center gap-y-1 gap-x-4 text-slate-700">
                <div>
                  <span className="text-slate-400">Name: </span>
                  <span className="font-semibold text-slate-900">{activePatient.name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Age/Sex: </span>
                  <span className="font-semibold text-slate-900">
                    {activePatient.age} Y · {activePatient.gender === 'M' ? 'Male' : activePatient.gender === 'F' ? 'Female' : 'Other'}
                  </span>
                </div>
                {activePatient.phone && (
                  <div>
                    <span className="text-slate-400">Phone: </span>
                    <span className="font-mono text-slate-900 tabular-nums">{activePatient.phone}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400">Dept: </span>
                  <span className="font-semibold text-slate-900">{activePatient.department}</span>
                </div>
              </div>

              {/* Chief Complaint Callout */}
              {activePatient.chief_complaint && (
                <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Chief Complaint / Intake Note: </span>
                    <span>{activePatient.chief_complaint}</span>
                  </div>
                </div>
              )}

              {/* Workstation Specific Body */}
              <div className="p-6 space-y-6">
                {/* 1. TRIAGE DESK: Vitals Recording */}
                {activeStation?.station_type === 'TRIAGE' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Activity className="w-4 h-4 text-slate-700" />
                      <h3 className="text-sm font-semibold text-slate-900">Patient Vitals Recording</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {/* BP Systolic */}
                      <div>
                        <label className="text-slate-600 font-medium block mb-1">BP Systolic (mmHg)</label>
                        <input
                          type="number"
                          placeholder="e.g. 120"
                          value={vitals.bp_systolic ?? ''}
                          onChange={(e) => setVitals({ ...vitals, bp_systolic: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className={`w-full text-sm font-mono tabular-nums bg-white border rounded-lg px-2.5 py-1.5 ${
                            (vitals.bp_systolic && vitals.bp_systolic > 140) ? 'border-red-400 bg-red-50 text-red-900 font-bold' : 'border-slate-200'
                          }`}
                        />
                      </div>

                      {/* BP Diastolic */}
                      <div>
                        <label className="text-slate-600 font-medium block mb-1">BP Diastolic (mmHg)</label>
                        <input
                          type="number"
                          placeholder="e.g. 80"
                          value={vitals.bp_diastolic ?? ''}
                          onChange={(e) => setVitals({ ...vitals, bp_diastolic: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className={`w-full text-sm font-mono tabular-nums bg-white border rounded-lg px-2.5 py-1.5 ${
                            (vitals.bp_diastolic && vitals.bp_diastolic > 90) ? 'border-red-400 bg-red-50 text-red-900 font-bold' : 'border-slate-200'
                          }`}
                        />
                      </div>

                      {/* Pulse */}
                      <div>
                        <label className="text-slate-600 font-medium block mb-1">Pulse Rate (bpm)</label>
                        <input
                          type="number"
                          placeholder="e.g. 74"
                          value={vitals.pulse ?? ''}
                          onChange={(e) => setVitals({ ...vitals, pulse: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className="w-full text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                        />
                      </div>

                      {/* Temperature */}
                      <div>
                        <label className="text-slate-600 font-medium block mb-1">Temp (°F)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 98.6"
                          value={vitals.temperature ?? ''}
                          onChange={(e) => setVitals({ ...vitals, temperature: e.target.value ? parseFloat(e.target.value) : null })}
                          className={`w-full text-sm font-mono tabular-nums bg-white border rounded-lg px-2.5 py-1.5 ${
                            (vitals.temperature && vitals.temperature > 99.5) ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold' : 'border-slate-200'
                          }`}
                        />
                      </div>

                      {/* SpO2 */}
                      <div>
                        <label className="text-slate-600 font-medium block mb-1">SpO2 (%)</label>
                        <input
                          type="number"
                          placeholder="e.g. 98"
                          value={vitals.spo2 ?? ''}
                          onChange={(e) => setVitals({ ...vitals, spo2: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className={`w-full text-sm font-mono tabular-nums bg-white border rounded-lg px-2.5 py-1.5 ${
                            (vitals.spo2 && vitals.spo2 < 95) ? 'border-red-400 bg-red-50 text-red-900 font-bold' : 'border-slate-200'
                          }`}
                        />
                      </div>

                      {/* Blood Sugar */}
                      <div>
                        <label className="text-slate-600 font-medium block mb-1">Blood Sugar (mg/dL)</label>
                        <input
                          type="number"
                          placeholder="e.g. 110"
                          value={vitals.blood_sugar ?? ''}
                          onChange={(e) => setVitals({ ...vitals, blood_sugar: e.target.value ? parseInt(e.target.value, 10) : null })}
                          className="w-full text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                        />
                      </div>

                      {/* Weight */}
                      <div>
                        <label className="text-slate-600 font-medium block mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="e.g. 64"
                          value={vitals.weight ?? ''}
                          onChange={(e) => setVitals({ ...vitals, weight: e.target.value ? parseFloat(e.target.value) : null })}
                          className="w-full text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                        />
                      </div>

                      {/* Triage Notes */}
                      <div>
                        <label className="text-slate-600 font-medium block mb-1">Triage Note</label>
                        <input
                          type="text"
                          placeholder="Remarks"
                          value={vitals.notes || ''}
                          onChange={(e) => setVitals({ ...vitals, notes: e.target.value })}
                          className="w-full text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                        />
                      </div>
                    </div>

                    {/* Forward to Doctor */}
                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={() => handleForward('CONSULTATION')}
                        disabled={isLoading}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Forward to Doctor Consultation</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. DOCTOR CONSULTATION: Clinical notes, Prescriptions & Diagnostics */}
                {activeStation?.station_type === 'CONSULTATION' && (
                  <div className="space-y-5">
                    {/* Display Vitals Card captured from Triage */}
                    {activePatient.vitals && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                        <span className="font-semibold text-slate-800 block mb-1.5">Triage Vitals Summary:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums text-slate-700">
                          <div>
                            <span className="text-slate-400 font-sans">BP: </span>
                            <span className="font-bold">{activePatient.vitals.bp_systolic || '--'}/{activePatient.vitals.bp_diastolic || '--'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-sans">Pulse: </span>
                            <span className="font-bold">{activePatient.vitals.pulse || '--'} bpm</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-sans">Temp: </span>
                            <span className="font-bold">{activePatient.vitals.temperature || '--'} °F</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-sans">SpO2: </span>
                            <span className="font-bold">{activePatient.vitals.spo2 || '--'}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Clinical Assessment & Diagnosis */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Findings & Assessment</label>
                        <textarea
                          rows={3}
                          placeholder="Physical examination observations..."
                          value={clinicalNotes}
                          onChange={(e) => setClinicalNotes(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:border-slate-900 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Primary Diagnosis</label>
                        <textarea
                          rows={3}
                          placeholder="e.g. Acute upper respiratory infection / Essential hypertension"
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:border-slate-900 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Diagnostic Lab Ordering */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Order Field Diagnostics / Rapid Tests (Optional)
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {labTestOptions.map(test => {
                          const checked = selectedLabTests.includes(test);
                          return (
                            <label 
                              key={test}
                              className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                                checked ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleLabTest(test)}
                                className="hidden"
                              />
                              <Microscope className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{test}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Prescriptions */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700">Prescriptions & Dispensary Orders</label>
                      </div>

                      <div className="space-y-1.5 mb-2">
                        {prescriptions.map((rx, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
                            <span className="font-mono text-slate-800">{rx}</span>
                            <button
                              type="button"
                              onClick={() => removePrescription(idx)}
                              className="text-slate-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add medication (e.g. Amoxicillin 500mg TDS x 5d)..."
                          value={newRx}
                          onChange={(e) => setNewRx(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPrescription(); } }}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={addPrescription}
                          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shrink-0"
                        >
                          Add Rx
                        </button>
                      </div>
                    </div>

                    {/* Forward Routing Controls */}
                    <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
                      {selectedLabTests.length > 0 && (
                        <button
                          onClick={() => handleForward('LAB')}
                          disabled={isLoading}
                          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Microscope className="w-3.5 h-3.5" />
                          <span>Send to Diagnostic Lab</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleForward('PHARMACY')}
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Pill className="w-3.5 h-3.5" />
                        <span>Send to Pharmacy</span>
                      </button>

                      <button
                        onClick={() => handleForward('DISCHARGED')}
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                      >
                        Complete / Direct Discharge
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. DIAGNOSTIC LAB */}
                {activeStation?.station_type === 'LAB' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Microscope className="w-4 h-4 text-slate-700" />
                      <h3 className="text-sm font-semibold text-slate-900">Lab Specimen & Rapid Test Execution</h3>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Rapid Test Results & Findings</label>
                      <textarea
                        rows={3}
                        placeholder="Enter rapid malaria strip result, urinalysis findings, Hb levels..."
                        value={labResultsNote}
                        onChange={(e) => setLabResultsNote(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:border-slate-900 focus:outline-hidden"
                      />
                    </div>

                    <div className="pt-3 flex justify-end gap-2">
                      <button
                        onClick={() => handleForward('CONSULTATION')}
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Return to Doctor
                      </button>
                      <button
                        onClick={() => handleForward('PHARMACY')}
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Forward to Pharmacy
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. PHARMACY & DISCHARGE */}
                {activeStation?.station_type === 'PHARMACY' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Pill className="w-4 h-4 text-slate-700" />
                      <h3 className="text-sm font-semibold text-slate-900">Medication Dispensing & Discharge Counselling</h3>
                    </div>

                    <p className="text-xs text-slate-600">
                      Verify prescribed medications, pack dosages in label envelopes, and counsel patient on adherence.
                    </p>

                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={() => handleForward('DISCHARGED')}
                        disabled={isLoading}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Dispense & Complete Discharge</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Secondary Controls: No-Show */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Operator: {activeStation?.operator_name || 'Assigned Staff'}</span>
                  <button
                    onClick={handleMarkNoShow}
                    disabled={isLoading}
                    className="text-amber-700 hover:text-amber-900 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Patient Not Present (Mark No-Show)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Empty Station State - Ready to Call Next */
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Station Counter Ready</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {queueList.length > 0 
                    ? `${queueList.length} patient(s) waiting in queue. Click Call Next to summon the highest priority patient.`
                    : 'All patients for this station have been attended to.'}
                </p>
              </div>

              <div>
                <button
                  onClick={() => handleCallNext()}
                  disabled={isLoading || queueList.length === 0}
                  className="px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Call Next Patient</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Real-Time Queue & No-Show Roster (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Waiting Queue for Station */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">Station Waiting Queue</h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                {queueList.length} in Line
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {queueList.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span>No patients currently waiting</span>
                </div>
              ) : (
                queueList.map((p, idx) => {
                  const waitMinutes = Math.max(1, Math.round((Date.now() - p.queued_at) / 60000));
                  return (
                    <div 
                      key={p.id}
                      className="pt-2.5 pb-2 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {p.token_number}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-medium text-slate-800 truncate max-w-[110px]">
                            {p.name}
                          </span>
                          {p.priority !== 'NORMAL' && (
                            <span className={`text-[10px] font-bold uppercase ${
                              p.priority === 'URGENT' ? 'text-red-600' :
                              p.priority === 'ELDERLY' ? 'text-amber-600' :
                              p.priority === 'PREGNANT' ? 'text-rose-600' : 'text-sky-600'
                            }`}>
                              ({p.priority})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{p.department}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">{waitMinutes}m wait</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCallNext(p.id)}
                        disabled={isLoading}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer shrink-0"
                      >
                        Call
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* No-Show Patients Panel */}
          {noShowList.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-semibold text-slate-900">Parked No-Show Patients ({noShowList.length})</h4>
                </div>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
                {noShowList.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-amber-50/60 border border-amber-200/50 px-2.5 py-1.5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 tabular-nums">{p.token_number}</span>
                      <span className="text-slate-700 truncate max-w-[120px]">{p.name}</span>
                    </div>
                    <button
                      onClick={() => handleCallNext(p.id)}
                      className="px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200/70 rounded transition-colors"
                      title="Recall patient to station"
                    >
                      Reinstate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
