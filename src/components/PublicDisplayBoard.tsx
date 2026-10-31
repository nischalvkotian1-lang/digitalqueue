import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { audioService } from '../services/audio';
import { PublicDisplayState } from '../types/queue';
import { 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Radio, 
  Bell, 
  Clock, 
  AlertCircle,
  Sparkles
} from 'lucide-react';

export const PublicDisplayBoard: React.FC = () => {
  const [displayState, setDisplayState] = useState<PublicDisplayState | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [lastCalledToken, setLastCalledToken] = useState<string | null>(null);
  const [flashCall, setFlashCall] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Update live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch display data
  const loadDisplay = async () => {
    try {
      const state = await api.getDisplayState();
      setDisplayState(state);
    } catch (err) {
      console.error('Failed to load display state', err);
    }
  };

  useEffect(() => {
    loadDisplay();
    // Subscribe to WebSocket events
    const unsubscribe = api.subscribe((msg) => {
      if (msg.type === 'PATIENT_CALLED') {
        const payload = msg.data;
        if (payload?.patient) {
          const token = payload.patient.token_number;
          const counter = payload.counter_label;
          setLastCalledToken(token);
          setFlashCall(true);

          if (isAudioEnabled) {
            audioService.announceCall(token, counter, payload.station_type);
          }

          setTimeout(() => setFlashCall(false), 8000);
        }
        loadDisplay();
      } else if (msg.type === 'QUEUE_UPDATED' || msg.type === 'META_UPDATED' || msg.type === 'INIT') {
        loadDisplay();
      }
    });

    // Fallback refresh every 10s
    const fallbackTimer = setInterval(loadDisplay, 10000);

    return () => {
      unsubscribe();
      clearInterval(fallbackTimer);
    };
  }, [isAudioEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleTestAudio = () => {
    audioService.init();
    audioService.announceCall('GEN-101', 'Room 1');
  };

  const handleAudioToggle = () => {
    const next = !isAudioEnabled;
    setIsAudioEnabled(next);
    audioService.setVoiceEnabled(next);
    audioService.setChimeEnabled(next);
    if (next) {
      audioService.init();
    }
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-[calc(100vh-65px)] bg-slate-950 text-slate-100 flex flex-col justify-between p-6 select-none"
    >
      {/* Top Banner / TV Header */}
      <div>
        <div className="flex flex-col sm:flex-row items-center justify-between pb-4 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white uppercase">
                Aegis Community Health Camp · Token Board
              </h1>
              <p className="text-xs text-slate-400">
                Please listen for voice chimes and proceed to your assigned counter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Clock */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-sm font-mono tabular-nums text-slate-300">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>{currentTime}</span>
            </div>

            {/* Audio Toggle & Test */}
            <button
              onClick={handleAudioToggle}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                isAudioEnabled 
                  ? 'bg-slate-900 text-emerald-400 border-slate-700 hover:bg-slate-800' 
                  : 'bg-red-950/60 text-red-300 border-red-800'
              }`}
              title="Toggle Audio & Voice Announcements"
            >
              {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{isAudioEnabled ? 'Voice Active' : 'Muted'}</span>
            </button>

            <button
              onClick={handleTestAudio}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 transition-colors"
              title="Test Chime Sound"
            >
              Test Chime
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Toggle Fullscreen for Projector/TV"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Big Alert Banner when a token is called */}
        {flashCall && lastCalledToken && (
          <div className="my-4 p-4 bg-emerald-500 text-slate-950 font-bold rounded-xl flex items-center justify-between shadow-lg shadow-emerald-500/20 animate-bounce">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 animate-spin" />
              <span className="text-xl tracking-tight uppercase">
                ATTENTION: TOKEN <span className="font-mono text-2xl tabular-nums underline">{lastCalledToken}</span> CALLED TO COUNTER
              </span>
            </div>
            <span className="text-xs uppercase tracking-wider bg-slate-950 text-emerald-400 px-3 py-1 rounded-md">
              Please Step Forward
            </span>
          </div>
        )}

        {/* Main TV Dashboard Grid */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* NOW SERVING SECTION (8 Columns) */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>Now Serving at Counters</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {displayState?.now_serving?.length || 0} Counter(s) Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayState?.now_serving && displayState.now_serving.length > 0 ? (
                displayState.now_serving.map((serving, idx) => {
                  const isLatest = serving.token_number === lastCalledToken;

                  return (
                    <div 
                      key={idx}
                      className={`rounded-2xl p-5 border transition-all ${
                        isLatest 
                          ? 'bg-slate-900 border-emerald-400 shadow-xl shadow-emerald-500/10 scale-[1.01]' 
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold mb-2">
                        <span className="text-emerald-400 uppercase tracking-wide">
                          {serving.counter_label}
                        </span>
                        <span className="text-slate-400 truncate max-w-[150px]">
                          {serving.station_name}
                        </span>
                      </div>

                      <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-white my-2 tabular-nums">
                        {serving.token_number}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80 text-slate-400">
                        <span className="text-slate-300 font-medium truncate max-w-[160px]">
                          {serving.patient_name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {serving.department}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 h-64 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <Clock className="w-8 h-8 text-slate-600" />
                  <p className="text-sm font-medium">All counters are currently open and waiting</p>
                  <p className="text-xs text-slate-600">New tokens will appear here when called</p>
                </div>
              )}
            </div>
          </div>

          {/* UPCOMING IN LINE QUEUE (4 Columns) */}
          <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col h-[460px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Next In Line (Upcoming)
              </h3>
              <span className="text-xs font-mono text-emerald-400 tabular-nums">
                {displayState?.total_waiting || 0} Waiting
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 divide-y divide-slate-800/60">
              {displayState?.upcoming_by_station && Object.keys(displayState.upcoming_by_station).map((st) => {
                const list = displayState.upcoming_by_station[st] || [];
                if (list.length === 0) return null;

                const stationLabel = 
                  st === 'TRIAGE' ? 'Triage (Vitals)' :
                  st === 'CONSULTATION' ? 'Doctor Consultation' :
                  st === 'LAB' ? 'Diagnostic Lab' : 'Dispensary & Pharmacy';

                return (
                  <div key={st} className="pt-2 first:pt-0">
                    <span className="text-[11px] font-semibold uppercase text-slate-500 block mb-1.5">
                      {stationLabel}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {list.map((item, i) => (
                        <div
                          key={i}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-200 tabular-nums flex items-center gap-1.5"
                        >
                          <span>{item.token_number}</span>
                          {item.priority !== 'NORMAL' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title={`Priority: ${item.priority}`}></span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Emergency / Announcement Ticker */}
      <div className="mt-6 pt-3 border-t border-slate-800 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold shrink-0 uppercase tracking-wide">
          <AlertCircle className="w-4 h-4" />
          <span>Announcements:</span>
        </div>

        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className="text-slate-300 font-medium">
            {displayState?.announcement || 'Welcome to AegisField Camp. Please wait for your token to be called on the display.'}
          </div>
        </div>

        <div className="text-slate-500 font-mono text-[11px] shrink-0">
          LAN Server Local Sync
        </div>
      </div>
    </div>
  );
};
