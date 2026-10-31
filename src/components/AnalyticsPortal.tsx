import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CampAnalytics, CampMeta } from '../types/queue';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  Activity, 
  AlertTriangle, 
  Download, 
  Sparkles, 
  Trash2, 
  Radio, 
  RefreshCw,
  Building,
  BarChart3,
  Edit3
} from 'lucide-react';

interface AnalyticsPortalProps {
  meta?: CampMeta | null;
  onMetaUpdated?: () => void;
}

export const AnalyticsPortal: React.FC<AnalyticsPortalProps> = ({ meta, onMetaUpdated }) => {
  const [analytics, setAnalytics] = useState<CampAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Edit Announcement State
  const [announcementText, setAnnouncementText] = useState(meta?.announcement || '');
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    if (meta?.announcement) {
      setAnnouncementText(meta.announcement);
    }
    const unsubscribe = api.subscribe((msg) => {
      if (msg.type === 'QUEUE_UPDATED' || msg.type === 'INIT') {
        loadAnalytics();
      }
    });
    return () => unsubscribe();
  }, [meta]);

  const handleSeedData = async () => {
    setIsLoading(true);
    try {
      await api.seedCamp();
      setActionMsg('Realistic camp cohort seeded successfully');
      loadAnalytics();
    } catch (err: any) {
      setActionMsg('Failed to seed cohort');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetCamp = async () => {
    if (window.confirm('Are you sure you want to clear all queue patients and start a fresh day?')) {
      setIsLoading(true);
      try {
        await api.resetCamp();
        setActionMsg('Camp queue reset successfully');
        loadAnalytics();
      } catch (err: any) {
        setActionMsg('Failed to reset');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveAnnouncement = async () => {
    try {
      await api.updateMeta({ announcement: announcementText });
      setIsEditingAnnouncement(false);
      setActionMsg('Display announcement updated');
      if (onMetaUpdated) onMetaUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Camp Operations & Queue Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Mission overview · Bottleneck identification & station throughput metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          {actionMsg && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              {actionMsg}
            </span>
          )}

          <a
            href="/api/camp/export"
            download
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Camp (JSON)</span>
          </a>

          <button
            onClick={handleSeedData}
            disabled={isLoading}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Seed 10 sample patients across stations for simulation"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Seed Demo Cohort</span>
          </button>

          <button
            onClick={handleResetCamp}
            disabled={isLoading}
            className="p-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
            title="Reset Camp Queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Total Registered</span>
          <div className="text-3xl font-extrabold font-mono text-slate-950 mt-1 tabular-nums">
            {analytics?.total_registered ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Admitted today</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Waiting in Queue</span>
          <div className="text-3xl font-extrabold font-mono text-amber-600 mt-1 tabular-nums">
            {analytics?.currently_waiting ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Across stations</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">In Service / Exam</span>
          <div className="text-3xl font-extrabold font-mono text-sky-600 mt-1 tabular-nums">
            {analytics?.in_service ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Active consultations</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Discharged</span>
          <div className="text-3xl font-extrabold font-mono text-emerald-600 mt-1 tabular-nums">
            {analytics?.completed ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Full care completed</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Avg. Wait Time</span>
          <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1 tabular-nums">
            {analytics?.avg_wait_time_minutes ?? 0}m
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">From intake to call</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">No-Shows</span>
          <div className="text-3xl font-extrabold font-mono text-slate-500 mt-1 tabular-nums">
            {analytics?.no_show ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Unresponsive calls</span>
        </div>
      </div>

      {/* Main Grid: Station Bottlenecks & Department Load */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
        {/* Left Column: Station Flow & Queue Lengths (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">Station Stage Bottlenecks</h2>
            </div>
            <span className="text-xs text-slate-500">Real-time load distribution</span>
          </div>

          <div className="space-y-4">
            {analytics?.station_stats && analytics.station_stats.length > 0 ? (
              analytics.station_stats.map((st, i) => {
                const totalStation = st.waiting + st.served;
                const pct = totalStation > 0 ? Math.round((st.waiting / (analytics.total_registered || 1)) * 100) : 0;

                return (
                  <div key={i} className="space-y-1 text-xs">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-slate-800 font-semibold">{st.station}</span>
                      <div className="flex items-center gap-3 font-mono tabular-nums">
                        <span className="text-amber-600 font-bold">{st.waiting} waiting</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-emerald-700">{st.served} served</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-amber-500 h-full transition-all" 
                        style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No station transactions recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Department Caseload (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">Specialty Caseload</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {analytics?.department_stats?.length || 0} Specialties
            </span>
          </div>

          <div className="space-y-3">
            {analytics?.department_stats && analytics.department_stats.length > 0 ? (
              analytics.department_stats.map((dept, i) => {
                return (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-none">
                    <span className="font-medium text-slate-800">{dept.department}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="font-bold text-slate-900">{dept.total} patients</span>
                      <span className="text-slate-400">({dept.waiting} in queue)</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No patient admissions yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Public Display Announcement Ticker Editor */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900">Public Display TV Announcement Ticker</h2>
          </div>
          <span className="text-xs text-slate-400">Broadcasts to all waiting room TVs</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <input
            type="text"
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="e.g. Free Eye Screening camp concludes at 4:00 PM. Please keep receipts safe."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:border-slate-900 focus:outline-hidden"
          />
          <button
            onClick={handleSaveAnnouncement}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            Update Ticker
          </button>
        </div>
      </div>
    </div>
  );
};
