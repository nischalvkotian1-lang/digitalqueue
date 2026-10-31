import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { RegistrationPortal } from './components/RegistrationPortal';
import { StationOperatorPortal } from './components/StationOperatorPortal';
import { PublicDisplayBoard } from './components/PublicDisplayBoard';
import { AnalyticsPortal } from './components/AnalyticsPortal';
import { PatientTracker } from './components/PatientTracker';
import { LanConnectModal } from './components/LanConnectModal';
import { api } from './services/api';
import { CampMeta } from './types/queue';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('register');
  const [trackedToken, setTrackedToken] = useState<string>('');
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [meta, setMeta] = useState<CampMeta | null>(null);

  // Sync with URL hash or query params (e.g. /#tracker?token=GEN-110, ?token=GEN-110, /#display)
  useEffect(() => {
    const handleUrlRouting = () => {
      let route: NavTab | null = null;
      let token = '';

      // 1. Check search params: ?token=GEN-110
      if (typeof window !== 'undefined' && window.location.search) {
        const searchParams = new URLSearchParams(window.location.search);
        const searchToken = searchParams.get('token');
        if (searchToken) {
          token = searchToken;
          route = 'tracker';
        }
      }

      // 2. Check hash route: #tracker?token=GEN-110 or #display or #station
      if (typeof window !== 'undefined' && window.location.hash) {
        const rawHash = window.location.hash.replace(/^#/, '');
        const [hashRoute, hashQuery] = rawHash.split('?');
        if (['register', 'station', 'display', 'analytics', 'tracker'].includes(hashRoute)) {
          route = hashRoute as NavTab;
        }
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          const hashToken = hashParams.get('token');
          if (hashToken) {
            token = hashToken;
            route = 'tracker';
          }
        }
      }

      if (route) {
        setActiveTab(route);
      }
      if (token) {
        setTrackedToken(token);
      }
    };

    handleUrlRouting();
    window.addEventListener('hashchange', handleUrlRouting);
    window.addEventListener('popstate', handleUrlRouting);
    return () => {
      window.removeEventListener('hashchange', handleUrlRouting);
      window.removeEventListener('popstate', handleUrlRouting);
    };
  }, []);

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const loadMeta = () => {
    api.getMeta().then(data => setMeta(data)).catch(err => console.warn(err));
  };

  useEffect(() => {
    loadMeta();
    setIsWsConnected(api.getIsWsConnected());

    const unsubscribe = api.subscribe((msg) => {
      setIsWsConnected(api.getIsWsConnected());
      if (msg.type === 'META_UPDATED') {
        loadMeta();
      }
    });

    const interval = setInterval(() => {
      setIsWsConnected(api.getIsWsConnected());
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenLanModal={() => setIsLanModalOpen(true)}
        isWsConnected={isWsConnected}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {activeTab === 'register' && <RegistrationPortal meta={meta} />}
        {activeTab === 'station' && <StationOperatorPortal />}
        {activeTab === 'display' && <PublicDisplayBoard />}
        {activeTab === 'analytics' && <AnalyticsPortal meta={meta} onMetaUpdated={loadMeta} />}
        {activeTab === 'tracker' && <PatientTracker initialToken={trackedToken} />}
      </main>

      {/* LAN Setup Modal */}
      <LanConnectModal
        isOpen={isLanModalOpen}
        onClose={() => setIsLanModalOpen(false)}
      />
    </div>
  );
}
