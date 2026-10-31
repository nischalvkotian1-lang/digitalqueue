import React, { useState, useEffect, useRef } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { RegistrationPortal } from './components/RegistrationPortal';
import { StationOperatorPortal } from './components/StationOperatorPortal';
import { PublicDisplayBoard } from './components/PublicDisplayBoard';
import { AnalyticsPortal } from './components/AnalyticsPortal';
import { PatientTracker } from './components/PatientTracker';
import { LanConnectModal } from './components/LanConnectModal';
import { LoginModal } from './components/LoginModal';
import { api } from './services/api';
import { CampMeta } from './types/queue';

const PROTECTED_TABS: NavTab[] = ['station', 'analytics'];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('register');
  const [trackedToken, setTrackedToken] = useState<string>('');
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [meta, setMeta] = useState<CampMeta | null>(null);

  // Pure in-memory ephemeral authentication state (strictly resets on every page reload/refresh)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const isAuthenticatedRef = useRef<boolean>(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<NavTab | null>(null);

  // Clear any legacy persistent storage on startup
  useEffect(() => {
    try {
      localStorage.removeItem('aegis_auth_authenticated');
      sessionStorage.removeItem('aegis_auth_authenticated');
    } catch {}
  }, []);

  const setAuthSession = (val: boolean) => {
    setIsAuthenticated(val);
    isAuthenticatedRef.current = val;
  };

  // Route guarding navigation handler
  const navigateToTab = (tab: NavTab) => {
    if (PROTECTED_TABS.includes(tab) && !isAuthenticatedRef.current) {
      setPendingTab(tab);
      setIsLoginModalOpen(true);
      return;
    }

    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Sync with URL hash or query params (e.g. /#tracker?token=GEN-110, ?token=GEN-110, /#station)
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

      // 2. Check hash route: #tracker?token=GEN-110 or #display or #station or #login
      if (typeof window !== 'undefined' && window.location.hash) {
        const rawHash = window.location.hash.replace(/^#/, '');
        const [hashRoute, hashQuery] = rawHash.split('?');

        if (hashRoute === 'login') {
          setIsLoginModalOpen(true);
          setPendingTab('station');
        } else if (['register', 'station', 'display', 'analytics', 'tracker'].includes(hashRoute)) {
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

      if (token) {
        setTrackedToken(token);
      }

      if (route) {
        // Guard protected routes using purely in-memory authentication state
        if (PROTECTED_TABS.includes(route) && !isAuthenticatedRef.current) {
          setPendingTab(route);
          setIsLoginModalOpen(true);
        } else {
          setActiveTab(route);
        }
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

  const handleLoginSuccess = () => {
    setAuthSession(true);
    setIsLoginModalOpen(false);
    const dest = pendingTab || 'station';
    setActiveTab(dest);
    window.location.hash = dest;
    setPendingTab(null);
  };

  const handleLoginCancel = () => {
    setIsLoginModalOpen(false);
    setPendingTab(null);
    // Keep user on safe active tab in hash
    if (PROTECTED_TABS.includes(activeTab)) {
      setActiveTab('register');
      window.location.hash = 'register';
    } else {
      window.location.hash = activeTab;
    }
  };

  const handleLogout = () => {
    setAuthSession(false);
    setActiveTab('register');
    window.location.hash = 'register';
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

  const getTargetTabTitle = (tab: NavTab | null) => {
    switch (tab) {
      case 'station': return 'Station Desk (Operators & Doctors)';
      case 'analytics': return 'Supervisor Operations & Analytics';
      default: return 'Restricted Staff Area';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={navigateToTab}
        onOpenLanModal={() => setIsLanModalOpen(true)}
        isWsConnected={isWsConnected}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {activeTab === 'register' && <RegistrationPortal meta={meta} />}
        {activeTab === 'station' && (
          isAuthenticated ? <StationOperatorPortal /> : <RegistrationPortal meta={meta} />
        )}
        {activeTab === 'display' && <PublicDisplayBoard />}
        {activeTab === 'analytics' && (
          isAuthenticated ? <AnalyticsPortal meta={meta} onMetaUpdated={loadMeta} /> : <RegistrationPortal meta={meta} />
        )}
        {activeTab === 'tracker' && <PatientTracker initialToken={trackedToken} />}
      </main>

      {/* Staff Password Login Gate Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        targetTabName={getTargetTabTitle(pendingTab)}
        onSuccess={handleLoginSuccess}
        onCancel={handleLoginCancel}
      />

      {/* LAN Setup Modal */}
      <LanConnectModal
        isOpen={isLanModalOpen}
        onClose={() => setIsLanModalOpen(false)}
      />
    </div>
  );
}
