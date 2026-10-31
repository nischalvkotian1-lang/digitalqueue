import React from 'react';
import { Wifi } from 'lucide-react';

export type NavTab = 'register' | 'station' | 'display' | 'analytics' | 'tracker';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenLanModal: () => void;
  isWsConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenLanModal,
  isWsConnected
}) => {
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
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              activeTab === 'station' ? 'text-slate-950 font-semibold' : ''
            }`}
          >
            Station Desk
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
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              activeTab === 'analytics' ? 'text-slate-950 font-semibold' : ''
            }`}
          >
            Supervisor
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

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
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
