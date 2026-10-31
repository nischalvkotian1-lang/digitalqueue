import { 
  Patient, 
  StationConfig, 
  CampMeta, 
  PublicDisplayState, 
  CampAnalytics, 
  WsMessage,
  StationType
} from '../types/queue';

type WsListener = (msg: WsMessage) => void;

class ApiService {
  private ws: WebSocket | null = null;
  private wsListeners: Set<WsListener> = new Set();
  private reconnectTimer: any = null;
  private isConnected: boolean = false;

  constructor() {
    this.connectWs();
  }

  // Connect to WebSocket server running on same host
  public connectWs() {
    if (typeof window === 'undefined') return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.dispatchWsMessage({ type: 'INIT' });
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.dispatchWsMessage(parsed);
        } catch (e) {
          console.warn('WS message parse error', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connectWs();
      }, 3000);
    }
  }

  public subscribe(listener: WsListener): () => void {
    this.wsListeners.add(listener);
    return () => {
      this.wsListeners.delete(listener);
    };
  }

  private dispatchWsMessage(msg: WsMessage) {
    for (const listener of this.wsListeners) {
      try {
        listener(msg);
      } catch (err) {
        console.error('Listener error', err);
      }
    }
  }

  public getIsWsConnected(): boolean {
    return this.isConnected;
  }

  // API Calls
  public async getStatus() {
    const res = await fetch('/api/status');
    return res.json();
  }

  public async getMeta(): Promise<CampMeta> {
    const res = await fetch('/api/meta');
    return res.json();
  }

  public async updateMeta(data: Partial<CampMeta>): Promise<CampMeta> {
    const res = await fetch('/api/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }

  public async getStations(): Promise<StationConfig[]> {
    const res = await fetch('/api/stations');
    return res.json();
  }

  public async toggleStation(id: string, is_active: boolean) {
    const res = await fetch('/api/stations/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active })
    });
    return res.json();
  }

  public async getQueue(station?: StationType | 'ALL', department?: string): Promise<Patient[]> {
    const params = new URLSearchParams();
    if (station && station !== 'ALL') params.append('station', station);
    if (department && department !== 'All') params.append('department', department);
    
    const res = await fetch(`/api/queue?${params.toString()}`);
    return res.json();
  }

  public async registerPatient(data: {
    name: string;
    age: number;
    gender: 'M' | 'F' | 'O';
    phone?: string;
    department: string;
    priority: string;
    chief_complaint?: string;
  }): Promise<Patient> {
    const res = await fetch('/api/patients/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register patient');
    }
    return res.json();
  }

  public async callNext(params: {
    station_id?: string;
    station_type: StationType;
    counter_label: string;
    department?: string;
    specific_patient_id?: number;
  }): Promise<Patient> {
    const res = await fetch('/api/queue/call-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'No patient available');
    }
    return res.json();
  }

  public async recallPatient(params: {
    patient_id: number;
    counter_label?: string;
    station_type?: StationType;
  }): Promise<Patient> {
    const res = await fetch('/api/queue/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  }

  public async startService(params: {
    patient_id: number;
    station_type: StationType;
    counter_label: string;
  }): Promise<Patient> {
    const res = await fetch('/api/queue/start-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  }

  public async forwardPatient(payload: {
    patient_id: number;
    current_station: StationType;
    counter_label?: string;
    next_station: StationType;
    vitals_data?: any;
    clinical_notes?: string;
    diagnosis?: string;
    prescriptions?: string[];
    lab_tests?: string[];
    doctor_name?: string;
  }): Promise<Patient> {
    const res = await fetch('/api/queue/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  public async markNoShow(params: {
    patient_id: number;
    station_type: StationType;
    counter_label: string;
  }) {
    const res = await fetch('/api/queue/no-show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  }

  public async cancelPatient(patient_id: number, reason?: string) {
    const res = await fetch('/api/queue/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id, reason })
    });
    return res.json();
  }

  public async getDisplayState(): Promise<PublicDisplayState> {
    const res = await fetch('/api/display');
    return res.json();
  }

  public async getAnalytics(): Promise<CampAnalytics> {
    const res = await fetch('/api/analytics');
    return res.json();
  }

  public async getPatientDetails(id: number): Promise<Patient> {
    const res = await fetch(`/api/patients/${id}`);
    return res.json();
  }

  public async searchPatients(q: string): Promise<Patient[]> {
    const res = await fetch(`/api/patients-search?q=${encodeURIComponent(q)}`);
    return res.json();
  }

  public async seedCamp() {
    const res = await fetch('/api/camp/seed', { method: 'POST' });
    return res.json();
  }

  public async resetCamp() {
    const res = await fetch('/api/camp/reset', { method: 'POST' });
    return res.json();
  }
}

export const api = new ApiService();
