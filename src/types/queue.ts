export type StationType = 'REGISTRATION' | 'TRIAGE' | 'CONSULTATION' | 'LAB' | 'PHARMACY' | 'DISCHARGED';

export type TokenStatus = 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

export type PriorityLevel = 'NORMAL' | 'URGENT' | 'ELDERLY' | 'PREGNANT' | 'PEDIATRIC';

export type Department = 
  | 'General Medicine'
  | 'Ophthalmology'
  | 'Pediatrics'
  | 'Gynecology'
  | 'Dental'
  | 'Cardiology'
  | 'Orthopedics';

export interface Vitals {
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  blood_sugar?: number | null;
  weight?: number | null;
  notes?: string | null;
  recorded_at?: number;
}

export interface ClinicalRecord {
  id?: number;
  patient_id: number;
  station: StationType;
  notes?: string;
  diagnosis?: string;
  prescriptions?: string[];
  lab_tests?: string[];
  doctor_name?: string;
  created_at: number;
}

export interface AuditEntry {
  id: number;
  patient_id: number;
  token_number: string;
  action: string;
  station: string;
  counter: string;
  details?: string;
  timestamp: number;
}

export interface Patient {
  id: number;
  token_number: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'O';
  phone?: string;
  department: Department;
  priority: PriorityLevel;
  chief_complaint?: string;
  current_station: StationType;
  current_counter?: string | null;
  status: TokenStatus;
  created_at: number;
  queued_at: number;
  called_at?: number | null;
  service_started_at?: number | null;
  completed_at?: number | null;
  vitals?: Vitals | null;
  records?: ClinicalRecord[];
}

export interface StationConfig {
  id: string;
  name: string;
  station_type: StationType;
  department?: Department | 'All';
  counter_label: string;
  operator_name?: string;
  is_active: boolean;
}

export interface CampMeta {
  title: string;
  location: string;
  date: string;
  announcement: string;
  emergency_note: string;
}

export interface PublicDisplayState {
  now_serving: Array<{
    token_number: string;
    patient_name: string;
    station_name: string;
    counter_label: string;
    department: string;
    priority: PriorityLevel;
    called_at: number;
  }>;
  upcoming_by_station: Record<string, Array<{
    token_number: string;
    priority: PriorityLevel;
    queued_at: number;
  }>>;
  recent_calls: Array<{
    token_number: string;
    counter_label: string;
    called_at: number;
  }>;
  announcement: string;
  active_counters_count: number;
  total_waiting: number;
}

export interface CampAnalytics {
  total_registered: number;
  currently_waiting: number;
  in_service: number;
  completed: number;
  no_show: number;
  cancelled: number;
  avg_wait_time_minutes: number;
  avg_service_time_minutes: number;
  station_stats: Array<{
    station: StationType;
    waiting: number;
    served: number;
    avg_wait_min: number;
  }>;
  department_stats: Array<{
    department: string;
    total: number;
    waiting: number;
    completed: number;
  }>;
  hourly_throughput: Array<{
    hour: string;
    registered: number;
    completed: number;
  }>;
}

export interface WsMessage {
  type: 'INIT' | 'QUEUE_UPDATED' | 'PATIENT_CALLED' | 'META_UPDATED' | 'STATION_STATUS_CHANGED';
  data?: any;
}
