import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Patient, Department, PriorityLevel, CampMeta } from '../types/queue';
import { PrintableToken } from './PrintableToken';
import { 
  UserPlus, 
  Printer, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search, 
  User, 
  Activity, 
  ShieldAlert,
  Flame,
  Baby,
  Heart
} from 'lucide-react';

interface RegistrationPortalProps {
  meta?: CampMeta | null;
}

export const RegistrationPortal: React.FC<RegistrationPortalProps> = ({ meta }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'O'>('M');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<Department>('General Medicine');
  const [priority, setPriority] = useState<PriorityLevel>('NORMAL');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [autoPrint, setAutoPrint] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeModalPatient, setActiveModalPatient] = useState<Patient | null>(null);

  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadRecent = async () => {
    try {
      const q = await api.getQueue('ALL');
      // Sort recent registrations
      const sorted = [...q].sort((a, b) => b.created_at - a.created_at);
      setRecentPatients(sorted.slice(0, 15));
    } catch (err) {
      console.error('Failed to load recent registrations', err);
    }
  };

  useEffect(() => {
    loadRecent();
    const unsubscribe = api.subscribe((msg) => {
      if (msg.type === 'QUEUE_UPDATED' || msg.type === 'INIT') {
        loadRecent();
      }
    });
    return () => unsubscribe();
  }, []);

  // Priority helper based on age input
  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAge(val);
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num >= 65 && priority === 'NORMAL') {
        setPriority('ELDERLY');
      } else if (num < 12 && priority === 'NORMAL') {
        setPriority('PEDIATRIC');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Patient name is required');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 125) {
      setErrorMsg('Please enter a valid age between 1 and 125');
      return;
    }

    setIsSubmitting(true);
    try {
      const newPatient = await api.registerPatient({
        name: name.trim(),
        age: ageNum,
        gender,
        phone: phone.trim() || undefined,
        department,
        priority,
        chief_complaint: chiefComplaint.trim() || undefined
      });

      // Clear input fields for rapid next entry
      setName('');
      setAge('');
      setPhone('');
      setChiefComplaint('');
      setPriority('NORMAL');

      // Show print token modal
      setActiveModalPatient(newPatient);
      loadRecent();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const departmentsList: Department[] = [
    'General Medicine',
    'Ophthalmology',
    'Pediatrics',
    'Gynecology',
    'Dental',
    'Cardiology',
    'Orthopedics'
  ];

  const filteredRecents = recentPatients.filter(p => 
    p.token_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Editorial Title & Context */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Registration & Token Dispatch
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Local intake terminal · Auto-assigns department prefix & priority weighting
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
              className="rounded text-slate-900 focus:ring-slate-900"
            />
            <span>Auto-open print dialog on generate</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Intake Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
            <UserPlus className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">Patient Intake Form</h2>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Patient Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Ramesh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mobile / Contact (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Age, Gender & Department */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Age (Years) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="125"
                  placeholder="Age"
                  value={age}
                  onChange={handleAgeChange}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-hidden"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Specialty / Dept <span className="text-red-500">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-hidden font-medium"
                >
                  {departmentsList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority Flag Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Queue Priority Assignment
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority('NORMAL')}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-colors ${
                    priority === 'NORMAL' 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Normal (FIFO)
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('URGENT')}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-lg border text-center transition-colors flex items-center justify-center gap-1 ${
                    priority === 'URGENT' 
                      ? 'bg-red-600 text-white border-red-600 shadow-xs' 
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  Urgent
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('ELDERLY')}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-colors ${
                    priority === 'ELDERLY' 
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Elderly (65+)
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('PREGNANT')}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-colors flex items-center justify-center gap-1 ${
                    priority === 'PREGNANT' 
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <Heart className="w-3 h-3" />
                  Pregnant
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('PEDIATRIC')}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-colors flex items-center justify-center gap-1 ${
                    priority === 'PEDIATRIC' 
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs' 
                      : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                  }`}
                >
                  <Baby className="w-3.5 h-3.5" />
                  Pediatric
                </button>
              </div>
            </div>

            {/* Chief Complaint / Symptoms */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Chief Complaint / Symptoms
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Fever for 3 days, headaches, joint pain, coughing"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden"
              />
            </div>

            {/* Submit CTA */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Press Enter to register · Directs patient to Triage
              </span>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isSubmitting ? 'Generating...' : 'Generate & Print Token'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Admissions Log (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col h-[560px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Recent Registrations</h2>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {recentPatients.length} Total
            </span>
          </div>

          {/* Search filter */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by token, name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
            {filteredRecents.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                <User className="w-8 h-8 mb-2 stroke-[1.5] text-slate-300" />
                <span>No registered patients match search</span>
              </div>
            ) : (
              filteredRecents.map((p) => {
                const timeStr = new Date(p.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                });

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
                        <span className="font-medium text-slate-800 truncate max-w-[120px]">
                          {p.name}
                        </span>
                        {p.priority !== 'NORMAL' && (
                          <span className={`text-[10px] font-semibold uppercase ${
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
                        <span className="font-mono tabular-nums">{timeStr}</span>
                        <span>·</span>
                        <span className="capitalize">{p.current_station.toLowerCase()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveModalPatient(p)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors"
                      title="Reprint Token Receipt"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {activeModalPatient && (
        <PrintableToken
          patient={activeModalPatient}
          meta={meta}
          autoPrint={autoPrint}
          onClose={() => setActiveModalPatient(null)}
        />
      )}
    </div>
  );
};
