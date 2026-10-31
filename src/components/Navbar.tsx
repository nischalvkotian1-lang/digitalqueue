import React from 'react';
import { Wifi, Lock } from 'lucide-react';

export type NavTab = 'register' | 'station' | 'display' | 'analytics' | 'tracker';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenLanModal: () => void;
  isWsConnected: boolean;
  isAuthenticated: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenLanModal,
  isWsConnected,
  isAuthenticated,
  onLogout
}) => {
  const isProtectedTab = activeTab === 'station' || activeTab === 'analytics';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onTabChange('register')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-slate-700 transition-colors cursor-pointer text-left"
        >
          AegisField DQMS
        </button>

        {/* Zone 2: 4–5 clean single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => onTabChange('register')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              activeTab === 'register' ? 'text-slate-950 font-semibold' : ''
            }`}
          >
            Registration
          </button>

          <button
            onClick={() => onTabChange('station')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer flex items-center gap-1 ${
              activeTab === 'station' ? 'text-slate-950 font-semibold' : ''
            }`}
          >
            <span>Station Desk</span>
            {!isAuthenticated && <Lock className="w-3 h-3 text-slate-400" />}
          </button>

          <button
            onClick={() => onTabChange('display')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              activeTab === 'display' ? 'text-slate-950 font-semibold' : ''
            }`}
          >
            Public TV
          </button>

          <button
            onClick={() => onTabChange('analytics')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer flex items-center gap-1 ${
              activeTab === 'analytics' ? 'text-slate-950 font-semibold' : ''
            }`}
          >
            <span>Supervisor</span>
            {!isAuthenticated && <Lock className="w-3 h-3 text-slate-400" />}
          </button>

          <button
            onClick={() => onTabChange('tracker')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              activeTab === 'tracker' ? 'text-slate-950 font-semibold' : ''
            }`}
          >
            Tracker
          </button>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {isAuthenticated && isProtectedTab && (
            <button
              onClick={onLogout}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Lock session and return to Registration Desk"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Lock</span>
            </button>
          )}

          <button
            onClick={onOpenLanModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <Wifi className={`w-3.5 h-3.5 ${isWsConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>LAN Connect</span>
          </button>
        </div>
      </div>
    </header>
  );
};
