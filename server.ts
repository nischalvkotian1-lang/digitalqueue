import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = express();
const server = http.createServer(app);

app.use(express.json());

// Initialize SQLite database
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.resolve(dataDir, 'camp_queue.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrent performance on local LAN
db.pragma('journal_mode = WAL');

// Create database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS camp_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    date TEXT NOT NULL,
    announcement TEXT,
    emergency_note TEXT
  );

  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    station_type TEXT NOT NULL,
    department TEXT NOT NULL,
    counter_label TEXT NOT NULL,
    operator_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    phone TEXT,
    department TEXT NOT NULL,
    priority TEXT NOT NULL,
    chief_complaint TEXT,
    current_station TEXT NOT NULL,
    current_counter TEXT,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    queued_at INTEGER NOT NULL,
    called_at INTEGER,
    service_started_at INTEGER,
    completed_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_patients_station_status 
  ON patients(current_station, status, priority, queued_at);

  CREATE TABLE IF NOT EXISTS vitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL UNIQUE,
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    pulse INTEGER,
    temperature REAL,
    spo2 INTEGER,
    blood_sugar INTEGER,
    weight REAL,
    notes TEXT,
    recorded_at INTEGER NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS clinical_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    station TEXT NOT NULL,
    notes TEXT,
    diagnosis TEXT,
    prescriptions TEXT,
    lab_tests TEXT,
    doctor_name TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    token_number TEXT NOT NULL,
    action TEXT NOT NULL,
    station TEXT NOT NULL,
    counter TEXT NOT NULL,
    details TEXT,
    timestamp INTEGER NOT NULL
  );
`);

// Seed default camp meta if missing
const metaCount = db.prepare('SELECT COUNT(*) as count FROM camp_meta').get() as { count: number };
if (metaCount.count === 0) {
  db.prepare(`
    INSERT INTO camp_meta (id, title, location, date, announcement, emergency_note)
    VALUES (1, ?, ?, ?, ?, ?)
  `).run(
    'Aegis Community Health Camp',
    'Sector 4 Field Center & Mobile Unit',
    new Date().toISOString().split('T')[0],
    'Welcome to AegisField Camp. Please wait for your token on the display screen. Keep your receipt safe.',
    'Urgent emergency cases please report directly to Triage Station 1'
  );
}

// Seed default stations if missing
const stationCount = db.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number };
if (stationCount.count === 0) {
  const defaultStations = [
    { id: 'tri-1', name: 'Triage Desk 1', station_type: 'TRIAGE', department: 'All', counter_label: 'Desk A', operator_name: 'Nurse Priya', is_active: 1 },
    { id: 'tri-2', name: 'Triage Desk 2', station_type: 'TRIAGE', department: 'All', counter_label: 'Desk B', operator_name: 'Nurse Joseph', is_active: 1 },
    { id: 'doc-gen1', name: 'General Medicine 1', station_type: 'CONSULTATION', department: 'General Medicine', counter_label: 'Room 1', operator_name: 'Dr. Ramesh Kumar', is_active: 1 },
    { id: 'doc-gen2', name: 'General Medicine 2', station_type: 'CONSULTATION', department: 'General Medicine', counter_label: 'Room 2', operator_name: 'Dr. Sunita Sen', is_active: 1 },
    { id: 'doc-eye', name: 'Eye Clinic', station_type: 'CONSULTATION', department: 'Ophthalmology', counter_label: 'Room 3', operator_name: 'Dr. Anand Verma', is_active: 1 },
    { id: 'doc-ped', name: 'Pediatric Care', station_type: 'CONSULTATION', department: 'Pediatrics', counter_label: 'Room 4', operator_name: 'Dr. Anita Roy', is_active: 1 },
    { id: 'doc-gyn', name: 'Maternal & Women Health', station_type: 'CONSULTATION', department: 'Gynecology', counter_label: 'Room 5', operator_name: 'Dr. Fatima Khan', is_active: 1 },
    { id: 'doc-den', name: 'Dental Care', station_type: 'CONSULTATION', department: 'Dental', counter_label: 'Room 6', operator_name: 'Dr. George Philip', is_active: 1 },
    { id: 'lab-1', name: 'Diagnostic Testing Lab', station_type: 'LAB', department: 'All', counter_label: 'Lab Desk 1', operator_name: 'Tech Alok', is_active: 1 },
    { id: 'pharm-1', name: 'Dispensary & Pharmacy', station_type: 'PHARMACY', department: 'All', counter_label: 'Pharmacy Counter 1', operator_name: 'Pharm. Meena', is_active: 1 }
  ];

  const insertStation = db.prepare(`
    INSERT INTO stations (id, name, station_type, department, counter_label, operator_name, is_active)
    VALUES (@id, @name, @station_type, @department, @counter_label, @operator_name, @is_active)
  `);
  for (const st of defaultStations) {
    insertStation.run(st);
  }
}

// WebSocket Server initialization
const wss = new WebSocketServer({ server });

function broadcast(type: string, data?: any) {
  const payload = JSON.stringify({ type, data, timestamp: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('WS broadcast error', err);
      }
    }
  }
}

wss.on('connection', (ws) => {
  // Send welcome / ping packet
  ws.send(JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() }));
});

// Helper function to log audit trail
function logAudit(patientId: number, tokenNumber: string, action: string, station: string, counter: string, details?: string) {
  db.prepare(`
    INSERT INTO audit_log (patient_id, token_number, action, station, counter, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(patientId, tokenNumber, action, station, counter, details || '', Date.now());
}

// Helper: Department prefix
function getPrefixForDepartment(dept: string): string {
  switch (dept) {
    case 'General Medicine': return 'GEN';
    case 'Ophthalmology': return 'EYE';
    case 'Pediatrics': return 'PED';
    case 'Gynecology': return 'GYN';
    case 'Dental': return 'DEN';
    case 'Cardiology': return 'CRD';
    case 'Orthopedics': return 'ORT';
    default: return 'GEN';
  }
}

// Helper: Local IP addresses
function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      // Skip internal (i.e. 127.0.0.1) and non-ipv4
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  if (addresses.length === 0) {
    addresses.push('127.0.0.1');
  }
  return addresses;
}

// Priority rank helper for SQL queries
// URGENT=1, ELDERLY=2, PREGNANT=3, PEDIATRIC=4, NORMAL=5
const PRIORITY_ORDER_SQL = `
  CASE priority
    WHEN 'URGENT' THEN 1
    WHEN 'ELDERLY' THEN 2
    WHEN 'PREGNANT' THEN 3
    WHEN 'PEDIATRIC' THEN 4
    ELSE 5
  END
`;

// ======================== API ROUTES ========================

// System & Network Status
app.get('/api/status', (req, res) => {
  const ips = getLocalIps();
  res.json({
    status: 'ONLINE',
    mode: 'LOCAL_FIRST_LAN',
    port: PORT,
    ips,
    localUrls: ips.map(ip => `http://${ip}:${PORT}`),
    dbPath,
    connectedClients: wss.clients.size,
    timestamp: Date.now()
  });
});

// Camp Meta
app.get('/api/meta', (req, res) => {
  const meta = db.prepare('SELECT * FROM camp_meta WHERE id = 1').get();
  res.json(meta);
});

app.post('/api/meta', (req, res) => {
  const { title, location, date, announcement, emergency_note } = req.body;
  db.prepare(`
    UPDATE camp_meta 
    SET title = COALESCE(?, title),
        location = COALESCE(?, location),
        date = COALESCE(?, date),
        announcement = COALESCE(?, announcement),
        emergency_note = COALESCE(?, emergency_note)
    WHERE id = 1
  `).run(title, location, date, announcement, emergency_note);

  const updated = db.prepare('SELECT * FROM camp_meta WHERE id = 1').get();
  broadcast('META_UPDATED', updated);
  res.json(updated);
});

// Stations list & management
app.get('/api/stations', (req, res) => {
  const stations = db.prepare('SELECT * FROM stations ORDER BY station_type, name').all();
  res.json(stations);
});

app.post('/api/stations/toggle', (req, res) => {
  const { id, is_active } = req.body;
  db.prepare('UPDATE stations SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
  broadcast('STATION_STATUS_CHANGED', { id, is_active });
  res.json({ success: true });
});

// Register New Patient
app.post('/api/patients/register', (req, res) => {
  const { name, age, gender, phone, department, priority, chief_complaint } = req.body;

  if (!name || !age || !department) {
    return res.status(400).json({ error: 'Name, age, and department are required' });
  }

  const prefix = getPrefixForDepartment(department);

  // Generate next sequential token number for this prefix today
  const lastPatient = db.prepare(`
    SELECT token_number FROM patients 
    WHERE token_number LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}-%`) as { token_number: string } | undefined;

  let nextSeq = 101;
  if (lastPatient && lastPatient.token_number) {
    const parts = lastPatient.token_number.split('-');
    if (parts.length === 2 && !isNaN(parseInt(parts[1], 10))) {
      nextSeq = parseInt(parts[1], 10) + 1;
    }
  }

  const token_number = `${prefix}-${nextSeq}`;
  const now = Date.now();

  // All patients initially route to TRIAGE (Vitals Station)
  const result = db.prepare(`
    INSERT INTO patients (
      token_number, name, age, gender, phone, department, priority, chief_complaint,
      current_station, current_counter, status, created_at, queued_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TRIAGE', NULL, 'WAITING', ?, ?)
  `).run(
    token_number,
    name.trim(),
    parseInt(age, 10),
    gender || 'O',
    phone ? phone.trim() : null,
    department,
    priority || 'NORMAL',
    chief_complaint ? chief_complaint.trim() : null,
    now,
    now
  );

  const patientId = Number(result.lastInsertRowid);
  logAudit(patientId, token_number, 'REGISTERED', 'REGISTRATION', 'Desk', `Registered for ${department}`);

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  broadcast('QUEUE_UPDATED', { patient, station: 'TRIAGE' });
  res.status(201).json(patient);
});

// Get Queue for Station or All
app.get('/api/queue', (req, res) => {
  const station = req.query.station as string | undefined;
  const dept = req.query.department as string | undefined;

  let query = `
    SELECT p.*,
      v.bp_systolic, v.bp_diastolic, v.pulse, v.temperature, v.spo2, v.blood_sugar, v.weight, v.notes as vitals_notes
    FROM patients p
    LEFT JOIN vitals v ON v.patient_id = p.id
    WHERE p.status IN ('WAITING', 'CALLED', 'IN_SERVICE')
  `;
  const params: any[] = [];

  if (station && station !== 'ALL') {
    query += ' AND p.current_station = ?';
    params.push(station);
  }

  if (dept && dept !== 'All') {
    query += ' AND (p.department = ? OR p.current_station IN ("TRIAGE", "LAB", "PHARMACY"))';
    params.push(dept);
  }

  query += ` ORDER BY ${PRIORITY_ORDER_SQL} ASC, p.queued_at ASC`;

  const rows = db.prepare(query).all(...params) as any[];

  // Structure records with vitals object
  const formatted = rows.map(r => ({
    ...r,
    vitals: r.bp_systolic ? {
      bp_systolic: r.bp_systolic,
      bp_diastolic: r.bp_diastolic,
      pulse: r.pulse,
      temperature: r.temperature,
      spo2: r.spo2,
      blood_sugar: r.blood_sugar,
      weight: r.weight,
      notes: r.vitals_notes
    } : null
  }));

  res.json(formatted);
});

// Call Next Patient for a Station
app.post('/api/queue/call-next', (req, res) => {
  const { station_id, station_type, counter_label, department, specific_patient_id } = req.body;

  if (!station_type || !counter_label) {
    return res.status(400).json({ error: 'station_type and counter_label are required' });
  }

  let patient: any = null;

  if (specific_patient_id) {
    patient = db.prepare(`
      SELECT * FROM patients 
      WHERE id = ? AND current_station = ? AND status IN ('WAITING', 'NO_SHOW')
    `).get(specific_patient_id, station_type);
  } else {
    // Pick highest priority waiting patient
    let sql = `
      SELECT * FROM patients
      WHERE current_station = ? AND status = 'WAITING'
    `;
    const params: any[] = [station_type];

    if (department && department !== 'All' && station_type === 'CONSULTATION') {
      sql += ' AND department = ?';
      params.push(department);
    }

    sql += ` ORDER BY ${PRIORITY_ORDER_SQL} ASC, queued_at ASC LIMIT 1`;
    patient = db.prepare(sql).get(...params);
  }

  if (!patient) {
    return res.status(404).json({ error: 'No waiting patients found for this station' });
  }

  const now = Date.now();
  db.prepare(`
    UPDATE patients 
    SET status = 'CALLED',
        current_counter = ?,
        called_at = ?
    WHERE id = ?
  `).run(counter_label, now, patient.id);

  logAudit(patient.id, patient.token_number, 'CALLED', station_type, counter_label);

  const updatedPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient.id);

  // Broadcast PATIENT_CALLED to all screens (TVs will chime and announce)
  broadcast('PATIENT_CALLED', {
    patient: updatedPatient,
    station_type,
    counter_label,
    department: patient.department,
    called_at: now
  });

  broadcast('QUEUE_UPDATED');
  res.json(updatedPatient);
});

// Repeat Call / Re-chime
app.post('/api/queue/recall', (req, res) => {
  const { patient_id, counter_label, station_type } = req.body;
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const now = Date.now();
  db.prepare(`
    UPDATE patients 
    SET status = 'CALLED',
        current_counter = COALESCE(?, current_counter),
        called_at = ?
    WHERE id = ?
  `).run(counter_label || patient.current_counter, now, patient.id);

  logAudit(patient.id, patient.token_number, 'RECALLED', station_type || patient.current_station, counter_label || patient.current_counter);

  const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient.id);
  broadcast('PATIENT_CALLED', {
    patient: updated,
    station_type: station_type || patient.current_station,
    counter_label: counter_label || patient.current_counter,
    department: patient.department,
    called_at: now
  });
  broadcast('QUEUE_UPDATED');
  res.json(updated);
});

// Start Service
app.post('/api/queue/start-service', (req, res) => {
  const { patient_id, station_type, counter_label } = req.body;
  const now = Date.now();

  db.prepare(`
    UPDATE patients 
    SET status = 'IN_SERVICE',
        service_started_at = COALESCE(service_started_at, ?),
        current_counter = COALESCE(?, current_counter)
    WHERE id = ?
  `).run(now, counter_label, patient_id);

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id) as any;
  logAudit(patient.id, patient.token_number, 'STARTED_SERVICE', station_type, counter_label || patient.current_counter);

  broadcast('QUEUE_UPDATED');
  res.json(patient);
});

// Forward Patient to Next Station or Discharge
app.post('/api/queue/forward', (req, res) => {
  const {
    patient_id,
    current_station,
    counter_label,
    next_station, // 'CONSULTATION' | 'LAB' | 'PHARMACY' | 'DISCHARGED'
    vitals_data,
    clinical_notes,
    diagnosis,
    prescriptions,
    lab_tests,
    doctor_name
  } = req.body;

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const now = Date.now();

  // Run in a transaction for data consistency
  const forwardTx = db.transaction(() => {
    // 1. Save Vitals if provided
    if (vitals_data && Object.keys(vitals_data).length > 0) {
      db.prepare(`
        INSERT INTO vitals (
          patient_id, bp_systolic, bp_diastolic, pulse, temperature, spo2, blood_sugar, weight, notes, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(patient_id) DO UPDATE SET
          bp_systolic = excluded.bp_systolic,
          bp_diastolic = excluded.bp_diastolic,
          pulse = excluded.pulse,
          temperature = excluded.temperature,
          spo2 = excluded.spo2,
          blood_sugar = excluded.blood_sugar,
          weight = excluded.weight,
          notes = excluded.notes,
          recorded_at = excluded.recorded_at
      `).run(
        patient.id,
        vitals_data.bp_systolic || null,
        vitals_data.bp_diastolic || null,
        vitals_data.pulse || null,
        vitals_data.temperature || null,
        vitals_data.spo2 || null,
        vitals_data.blood_sugar || null,
        vitals_data.weight || null,
        vitals_data.notes || null,
        now
      );
    }

    // 2. Save Clinical Note if provided
    if (clinical_notes || diagnosis || prescriptions || lab_tests) {
      db.prepare(`
        INSERT INTO clinical_notes (
          patient_id, station, notes, diagnosis, prescriptions, lab_tests, doctor_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patient.id,
        current_station,
        clinical_notes || null,
        diagnosis || null,
        prescriptions ? JSON.stringify(prescriptions) : null,
        lab_tests ? JSON.stringify(lab_tests) : null,
        doctor_name || null,
        now
      );
    }

    // 3. Update Patient Station & Status
    if (next_station === 'DISCHARGED') {
      db.prepare(`
        UPDATE patients 
        SET current_station = 'DISCHARGED',
            status = 'COMPLETED',
            current_counter = NULL,
            completed_at = ?
        WHERE id = ?
      `).run(now, patient.id);

      logAudit(patient.id, patient.token_number, 'DISCHARGED', current_station, counter_label || 'Desk', 'Camp treatment completed');
    } else {
      db.prepare(`
        UPDATE patients 
        SET current_station = ?,
            status = 'WAITING',
            current_counter = NULL,
            queued_at = ?
        WHERE id = ?
      `).run(next_station, now, patient.id);

      logAudit(patient.id, patient.token_number, 'FORWARDED', current_station, counter_label || 'Desk', `Forwarded to ${next_station}`);
    }
  });

  forwardTx();

  const updatedPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient.id);
  broadcast('QUEUE_UPDATED');
  res.json(updatedPatient);
});

// Mark No-Show
app.post('/api/queue/no-show', (req, res) => {
  const { patient_id, station_type, counter_label } = req.body;
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  db.prepare(`
    UPDATE patients 
    SET status = 'NO_SHOW',
        current_counter = NULL
    WHERE id = ?
  `).run(patient.id);

  logAudit(patient.id, patient.token_number, 'NO_SHOW', station_type, counter_label || 'Desk', 'Patient did not respond to call');

  broadcast('QUEUE_UPDATED');
  res.json({ success: true, patient_id });
});

// Cancel Patient Token
app.post('/api/queue/cancel', (req, res) => {
  const { patient_id, reason } = req.body;
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  db.prepare(`
    UPDATE patients 
    SET status = 'CANCELLED',
        current_counter = NULL
    WHERE id = ?
  `).run(patient.id);

  logAudit(patient.id, patient.token_number, 'CANCELLED', patient.current_station, 'Desk', reason || 'Patient left / cancelled');

  broadcast('QUEUE_UPDATED');
  res.json({ success: true });
});

// Public Display Board state
app.get('/api/display', (req, res) => {
  const nowServing = db.prepare(`
    SELECT p.token_number, p.name as patient_name, p.department, p.priority, p.called_at,
           p.current_counter as counter_label, p.current_station as station_type,
           s.name as station_name
    FROM patients p
    LEFT JOIN stations s ON (s.station_type = p.current_station AND s.counter_label = p.current_counter)
    WHERE p.status IN ('CALLED', 'IN_SERVICE') AND p.current_counter IS NOT NULL
    ORDER BY p.called_at DESC
    LIMIT 6
  `).all() as any[];

  // Upcoming in queue grouped by station
  const upcomingRows = db.prepare(`
    SELECT token_number, current_station, department, priority, queued_at
    FROM patients
    WHERE status = 'WAITING'
    ORDER BY ${PRIORITY_ORDER_SQL} ASC, queued_at ASC
  `).all() as any[];

  const upcomingByStation: Record<string, any[]> = {
    'TRIAGE': [],
    'CONSULTATION': [],
    'LAB': [],
    'PHARMACY': []
  };

  for (const row of upcomingRows) {
    if (upcomingByStation[row.current_station]) {
      if (upcomingByStation[row.current_station].length < 8) {
        upcomingByStation[row.current_station].push(row);
      }
    }
  }

  // Recent calls (last 5)
  const recentCalls = db.prepare(`
    SELECT token_number, counter as counter_label, timestamp as called_at
    FROM audit_log
    WHERE action IN ('CALLED', 'RECALLED')
    ORDER BY timestamp DESC
    LIMIT 5
  `).all();

  const meta = db.prepare('SELECT announcement, emergency_note FROM camp_meta WHERE id = 1').get() as any;
  const activeCounters = db.prepare('SELECT COUNT(*) as count FROM stations WHERE is_active = 1').get() as { count: number };
  const totalWaiting = db.prepare("SELECT COUNT(*) as count FROM patients WHERE status = 'WAITING'").get() as { count: number };

  res.json({
    now_serving: nowServing.map(s => ({
      ...s,
      station_name: s.station_name || `${s.station_type} - ${s.counter_label}`
    })),
    upcoming_by_station: upcomingByStation,
    recent_calls: recentCalls,
    announcement: meta ? meta.announcement : '',
    emergency_note: meta ? meta.emergency_note : '',
    active_counters_count: activeCounters.count,
    total_waiting: totalWaiting.count
  });
});

// Patient Detail & Journey Trail
app.get('/api/patients/:id', (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const vitals = db.prepare('SELECT * FROM vitals WHERE patient_id = ?').get(patientId);
  const records = db.prepare('SELECT * FROM clinical_notes WHERE patient_id = ? ORDER BY created_at ASC').all(patientId) as any[];
  const audit = db.prepare('SELECT * FROM audit_log WHERE patient_id = ? ORDER BY timestamp ASC').all(patientId);

  // Parse JSON strings in records
  const formattedRecords = records.map(rec => ({
    ...rec,
    prescriptions: rec.prescriptions ? JSON.parse(rec.prescriptions) : [],
    lab_tests: rec.lab_tests ? JSON.parse(rec.lab_tests) : []
  }));

  res.json({
    ...patient,
    vitals: vitals || null,
    records: formattedRecords,
    audit
  });
});

// Search Patients
app.get('/api/patients-search', (req, res) => {
  const q = (req.query.q as string || '').trim();
  if (!q) return res.json([]);

  const results = db.prepare(`
    SELECT p.*, v.bp_systolic, v.bp_diastolic, v.pulse, v.temperature
    FROM patients p
    LEFT JOIN vitals v ON v.patient_id = p.id
    WHERE p.token_number LIKE ? OR p.name LIKE ? OR p.phone LIKE ?
    ORDER BY p.id DESC
    LIMIT 20
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);

  res.json(results);
});

// Camp Supervisor Analytics & Metrics
app.get('/api/analytics', (req, res) => {
  const counts = db.prepare(`
    SELECT 
      COUNT(*) as total_registered,
      SUM(CASE WHEN status = 'WAITING' THEN 1 ELSE 0 END) as currently_waiting,
      SUM(CASE WHEN status IN ('CALLED', 'IN_SERVICE') THEN 1 ELSE 0 END) as in_service,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) as no_show,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
    FROM patients
  `).get() as any;

  // Average wait time (ms) for patients who have been called or completed
  const waitAvg = db.prepare(`
    SELECT AVG(called_at - queued_at) as avg_wait_ms
    FROM patients
    WHERE called_at IS NOT NULL AND called_at > queued_at
  `).get() as { avg_wait_ms: number | null };

  const avgWaitMin = waitAvg.avg_wait_ms ? Math.round(waitAvg.avg_wait_ms / 60000) : 8;

  // Station level stats
  const stationStats = db.prepare(`
    SELECT 
      current_station as station,
      SUM(CASE WHEN status = 'WAITING' THEN 1 ELSE 0 END) as waiting,
      SUM(CASE WHEN status IN ('COMPLETED', 'IN_SERVICE') THEN 1 ELSE 0 END) as served
    FROM patients
    GROUP BY current_station
  `).all() as any[];

  // Department distribution
  const deptStats = db.prepare(`
    SELECT 
      department,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'WAITING' THEN 1 ELSE 0 END) as waiting,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
    FROM patients
    GROUP BY department
    ORDER BY total DESC
  `).all() as any[];

  // Hourly registrations
  const hourly = db.prepare(`
    SELECT 
      strftime('%H:00', datetime(created_at / 1000, 'unixepoch', 'localtime')) as hour,
      COUNT(*) as registered,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
    FROM patients
    GROUP BY hour
    ORDER BY hour ASC
  `).all() as any[];

  res.json({
    total_registered: counts.total_registered || 0,
    currently_waiting: counts.currently_waiting || 0,
    in_service: counts.in_service || 0,
    completed: counts.completed || 0,
    no_show: counts.no_show || 0,
    cancelled: counts.cancelled || 0,
    avg_wait_time_minutes: avgWaitMin,
    avg_service_time_minutes: 12,
    station_stats: stationStats,
    department_stats: deptStats,
    hourly_throughput: hourly
  });
});

// Seed Camp Sample Data
app.post('/api/camp/seed', (req, res) => {
  const seedTx = db.transaction(() => {
    const now = Date.now();
    const samplePatients = [
      { name: 'Kavita Sharma', age: 68, gender: 'F', phone: '9876543210', dept: 'General Medicine', priority: 'ELDERLY', comp: 'Chronic joint pain, hypertension review', station: 'CONSULTATION', status: 'IN_SERVICE', counter: 'Room 1', offset: -45 },
      { name: 'Aarav Patel', age: 4, gender: 'M', phone: '9845123456', dept: 'Pediatrics', priority: 'PEDIATRIC', comp: 'High fever for 2 days, persistent cough', station: 'CONSULTATION', status: 'WAITING', counter: null, offset: -35 },
      { name: 'Ananya Deshmukh', age: 26, gender: 'F', phone: '9822334455', dept: 'Gynecology', priority: 'PREGNANT', comp: '2nd trimester routine antenatal checkup', station: 'TRIAGE', status: 'IN_SERVICE', counter: 'Desk A', offset: -25 },
      { name: 'Rameshwar Lal', age: 72, gender: 'M', phone: '9811223344', dept: 'Ophthalmology', priority: 'ELDERLY', comp: 'Cataract assessment, blurred vision', station: 'CONSULTATION', status: 'WAITING', counter: null, offset: -20 },
      { name: 'Vikramaditya Rao', age: 45, gender: 'M', phone: '9988776655', dept: 'General Medicine', priority: 'URGENT', comp: 'Severe chest tightness, sweating, dizziness', station: 'TRIAGE', status: 'CALLED', counter: 'Desk B', offset: -10 },
      { name: 'Sunita Mehra', age: 34, gender: 'F', phone: '9765432109', dept: 'Dental', priority: 'NORMAL', comp: 'Severe molar toothache with swelling', station: 'TRIAGE', status: 'WAITING', counter: null, offset: -18 },
      { name: 'Mohammed Farooq', age: 52, gender: 'M', phone: '9654321098', dept: 'General Medicine', priority: 'NORMAL', comp: 'Routine diabetes blood sugar monitoring', station: 'LAB', status: 'WAITING', counter: null, offset: -50 },
      { name: 'Pooja Bhatt', age: 29, gender: 'F', phone: '9543210987', dept: 'General Medicine', priority: 'NORMAL', comp: 'Prescription refill for thyroid medication', station: 'PHARMACY', status: 'WAITING', counter: null, offset: -60 },
      { name: 'Harish Chandra', age: 58, gender: 'M', phone: '9432109876', dept: 'General Medicine', priority: 'NORMAL', comp: 'General wellness check', station: 'DISCHARGED', status: 'COMPLETED', counter: null, offset: -90 }
    ];

    for (let i = 0; i < samplePatients.length; i++) {
      const sp = samplePatients[i];
      const prefix = getPrefixForDepartment(sp.dept);
      const token = `${prefix}-${101 + i}`;
      const createdTime = now + (sp.offset * 60000);
      const queuedTime = createdTime + 60000;
      const calledTime = (sp.status === 'CALLED' || sp.status === 'IN_SERVICE' || sp.status === 'COMPLETED') ? queuedTime + 300000 : null;
      const startedTime = (sp.status === 'IN_SERVICE' || sp.status === 'COMPLETED') ? queuedTime + 360000 : null;
      const completedTime = sp.status === 'COMPLETED' ? queuedTime + 1200000 : null;

      const pRes = db.prepare(`
        INSERT INTO patients (
          token_number, name, age, gender, phone, department, priority, chief_complaint,
          current_station, current_counter, status, created_at, queued_at, called_at, service_started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        token, sp.name, sp.age, sp.gender, sp.phone, sp.dept, sp.priority, sp.comp,
        sp.station, sp.counter, sp.status, createdTime, queuedTime, calledTime, startedTime, completedTime
      );

      const pId = Number(pRes.lastInsertRowid);

      // Add vitals for some
      if (sp.age > 20) {
        db.prepare(`
          INSERT INTO vitals (patient_id, bp_systolic, bp_diastolic, pulse, temperature, spo2, blood_sugar, weight, notes, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          pId,
          120 + Math.floor(Math.random() * 25),
          80 + Math.floor(Math.random() * 12),
          72 + Math.floor(Math.random() * 15),
          98.4 + (Math.random() * 0.8),
          97 + Math.floor(Math.random() * 3),
          110 + Math.floor(Math.random() * 40),
          55 + Math.floor(Math.random() * 25),
          'Vitals normal for camp protocol',
          createdTime + 120000
        );
      }

      // Add audit log
      db.prepare(`
        INSERT INTO audit_log (patient_id, token_number, action, station, counter, details, timestamp)
        VALUES (?, ?, 'REGISTERED', 'REGISTRATION', 'Desk', 'Camp admission', ?)
      `).run(pId, token, createdTime);
    }
  });

  seedTx();
  broadcast('QUEUE_UPDATED');
  res.json({ success: true, message: 'Sample camp cohort generated successfully' });
});

// Reset Camp Queue
app.post('/api/camp/reset', (req, res) => {
  const resetTx = db.transaction(() => {
    db.prepare('DELETE FROM audit_log').run();
    db.prepare('DELETE FROM clinical_notes').run();
    db.prepare('DELETE FROM vitals').run();
    db.prepare('DELETE FROM patients').run();
  });
  resetTx();
  broadcast('QUEUE_UPDATED');
  res.json({ success: true, message: 'Queue reset for fresh camp day' });
});

// Export Database JSON
app.get('/api/camp/export', (req, res) => {
  const meta = db.prepare('SELECT * FROM camp_meta WHERE id = 1').get();
  const patients = db.prepare('SELECT * FROM patients ORDER BY id ASC').all();
  const vitals = db.prepare('SELECT * FROM vitals').all();
  const notes = db.prepare('SELECT * FROM clinical_notes').all();
  const audit = db.prepare('SELECT * FROM audit_log ORDER BY timestamp ASC').all();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="camp_export_${Date.now()}.json"`);
  res.json({
    exported_at: new Date().toISOString(),
    meta,
    patients_count: patients.length,
    patients,
    vitals,
    clinical_notes: notes,
    audit_log: audit
  });
});

// ======================== FRONTEND VITE MOUNTING ========================

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIps();
    console.log(`\n======================================================`);
    console.log(`🚀 AegisField DQMS Server running on port ${PORT}`);
    console.log(`📡 Local-First LAN Accessible via:`);
    ips.forEach(ip => console.log(`   👉 http://${ip}:${PORT}`));
    console.log(`💾 SQLite Database embedded at: ${dbPath}`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
