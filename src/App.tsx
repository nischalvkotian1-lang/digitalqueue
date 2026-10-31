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
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [meta, setMeta] = useState<CampMeta | null>(null);

  // Sync with URL hash or path for TV sticks / bookmarking (e.g. /#display or /#station)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as NavTab;
      if (['register', 'station', 'display', 'analytics', 'tracker'].includes(hash)) {
        setActiveTab(hash);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
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
        {activeTab === 'tracker' && <PatientTracker />}
      </main>

      {/* LAN Setup Modal */}
      <LanConnectModal
        isOpen={isLanModalOpen}
        onClose={() => setIsLanModalOpen(false)}
      />
    </div>
  );
}
