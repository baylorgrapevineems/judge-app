import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vercel serverless: /tmp is the only writable dir, but it's per-instance.
// For multi-device competitions, replace with a real DB (ask Claude).
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const SCENARIOS_FILE = path.join(DATA_DIR, 'scenarios.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ems2026';

const DEFAULT_SCENARIOS = [
  {
    id: 's1',
    name: 'Scenario 1 – CHF / Flash Pulmonary Edema',
    description: '65yo male, sudden onset SOB, HTN/CAD, hypertensive crisis, A-fib with RVR',
    sections: [
      {
        id: 's1_general',
        name: 'General & Team Performance',
        criteria: [
          { id: 's1_gen_bsi', label: 'BSI / PPE precautions taken', maxPoints: 2, type: 'points' },
          { id: 's1_gen_scene', label: 'Scene safety verbalized and assessed', maxPoints: 3, type: 'points' },
          { id: 's1_gen_primary', label: 'Primary survey: Airway, Breathing, Circulation', maxPoints: 5, type: 'points' },
          { id: 's1_gen_history', label: 'SAMPLE / focused history obtained', maxPoints: 4, type: 'points' },
          { id: 's1_gen_team', label: 'Team coordination and delegation of duties', maxPoints: 5, type: 'points' },
        ],
      },
      {
        id: 's1_assessment',
        name: 'Assessment & Vitals',
        criteria: [
          { id: 's1_vitals', label: 'Full set of vitals obtained (BP, HR, RR, SpO2, Capno, Temp, BGL)', maxPoints: 5, type: 'points' },
          { id: 's1_12lead', label: '12-lead ECG obtained (no STEMI identified)', maxPoints: 5, type: 'points' },
          { id: 's1_manual_bp', label: 'Manual BP obtained [Extra Credit]', maxPoints: 2, type: 'points' },
        ],
      },
      {
        id: 's1_respiratory',
        name: 'Respiratory Management',
        criteria: [
          { id: 's1_cpap', label: 'CPAP/BiPAP initiated promptly', maxPoints: 8, type: 'points' },
          { id: 's1_cpap_titration', label: 'CPAP/BiPAP appropriately titrated', maxPoints: 5, type: 'points' },
          { id: 's1_hfnc', label: 'HFNC application [Extra Credit]', maxPoints: 3, type: 'points' },
        ],
      },
      {
        id: 's1_medications',
        name: 'Medications & Cardiac Management',
        criteria: [
          { id: 's1_nitro', label: 'Aggressive SL/IV Nitroglycerin with titration', maxPoints: 8, type: 'points' },
          { id: 's1_cardizem', label: 'IV Cardizem for A-fib RVR rate control', maxPoints: 6, type: 'points' },
        ],
      },
      {
        id: 's1_rsi',
        name: 'RSI & Advanced Airway',
        criteria: [
          { id: 's1_failure_recognized', label: 'CPAP failure recognized (altered mental status, max sats 80%); decision to intubate', maxPoints: 5, type: 'points' },
          { id: 's1_ketamine', label: 'RSI: Ketamine used as induction agent', maxPoints: 6, type: 'points' },
          { id: 's1_roc', label: 'RSI: Rocuronium used as paralytic', maxPoints: 5, type: 'points' },
          { id: 's1_sga', label: 'SGA placed as bridge device prior to ET intubation', maxPoints: 4, type: 'points' },
          { id: 's1_peep', label: 'PEEP valve titrated to improve oxygenation', maxPoints: 4, type: 'points' },
          { id: 's1_et_tube', label: 'Successful ET intubation (7–7.5 ET tube)', maxPoints: 6, type: 'points' },
          { id: 's1_capno', label: 'Post-intubation capnography confirmed', maxPoints: 4, type: 'points' },
          { id: 's1_resedate', label: 'Re-sedation: Ketamine or Versed/Fentanyl (appropriate for elevated BP)', maxPoints: 4, type: 'points' },
        ],
      },
      {
        id: 's1_transport',
        name: 'Transport & Reassessment',
        criteria: [
          { id: 's1_transport', label: 'Transport to appropriate facility', maxPoints: 3, type: 'points' },
          { id: 's1_reassess', label: 'Constant reassessments performed en route', maxPoints: 3, type: 'points' },
        ],
      },
      {
        id: 's1_critical',
        name: 'Critical Criteria (Deductions)',
        criteria: [
          { id: 's1_cf_albuterol', label: 'Used Albuterol/Atrovent (contraindicated – worsens tachycardia/RVR)', type: 'critical_fail', penalty: 15 },
          { id: 's1_cf_no_cpap', label: 'Failed to initiate CPAP/BiPAP for severe respiratory distress', type: 'critical_fail', penalty: 25 },
          { id: 's1_cf_early_intub', label: 'Intubated without first attempting CPAP/BiPAP optimization', type: 'critical_fail', penalty: 20 },
          { id: 's1_cf_wrong_meds', label: 'Used wrong induction agent for RSI', type: 'critical_fail', penalty: 15 },
        ],
      },
    ],
  },
  {
    id: 's2',
    name: 'Scenario 2 – STEMI with VT Arrest',
    description: '55yo female, chest pain, paced rhythm with Scarbossa STEMI, VT cardiac arrest',
    sections: [
      {
        id: 's2_general',
        name: 'General & Team Performance',
        criteria: [
          { id: 's2_gen_bsi', label: 'BSI / PPE precautions taken', maxPoints: 2, type: 'points' },
          { id: 's2_gen_scene', label: 'Scene safety verbalized and assessed', maxPoints: 3, type: 'points' },
          { id: 's2_gen_primary', label: 'Primary survey: Airway, Breathing, Circulation', maxPoints: 5, type: 'points' },
          { id: 's2_gen_history', label: 'SAMPLE / focused history obtained', maxPoints: 4, type: 'points' },
          { id: 's2_gen_team', label: 'Team coordination and delegation of duties', maxPoints: 5, type: 'points' },
        ],
      },
      {
        id: 's2_assessment',
        name: 'Initial Assessment & Vitals',
        criteria: [
          { id: 's2_vitals', label: 'Full set of vitals obtained', maxPoints: 5, type: 'points' },
          { id: 's2_manual_bp', label: 'Manual BP obtained [Extra Credit]', maxPoints: 2, type: 'points' },
          { id: 's2_o2', label: 'Supplemental O2 for sat goal >94%', maxPoints: 3, type: 'points' },
          { id: 's2_12lead', label: '12-lead ECG obtained and interpreted', maxPoints: 5, type: 'points' },
          { id: 's2_scarbossa', label: 'Scarbossa criteria + STEMI identified in paced rhythm', maxPoints: 7, type: 'points' },
          { id: 's2_nitro', label: 'SL Nitroglycerin administered with BP titration', maxPoints: 4, type: 'points' },
        ],
      },
      {
        id: 's2_arrest',
        name: 'Cardiac Arrest Management',
        criteria: [
          { id: 's2_cpr_immediate', label: 'CPR initiated immediately on arrest with timer started', maxPoints: 8, type: 'points' },
          { id: 's2_compressor_rotation', label: 'Alternating compressors every 2 minutes', maxPoints: 5, type: 'points' },
          { id: 's2_metronome', label: 'Metronome used for CPR rate feedback', maxPoints: 3, type: 'points' },
          { id: 's2_sga', label: 'SGA placed with O2 and capnography at RR 10', maxPoints: 5, type: 'points' },
          { id: 's2_pads', label: 'Pads placed (AP position preferred)', maxPoints: 4, type: 'points' },
          { id: 's2_defib', label: 'Pre-charge and defibrillation at appropriate joules', maxPoints: 8, type: 'points' },
          { id: 's2_repeat_defib', label: 'Continued pre-charge and pulse/rhythm check every 2 minutes', maxPoints: 4, type: 'points' },
          { id: 's2_lucas', label: 'Lucas device applied at rhythm check [Extra Credit]', maxPoints: 2, type: 'points' },
        ],
      },
      {
        id: 's2_meds',
        name: 'Medications',
        criteria: [
          { id: 's2_amio_300', label: 'Amiodarone 300mg administered', maxPoints: 6, type: 'points' },
          { id: 's2_amio_150', label: 'Amiodarone 150mg (2nd dose) with Epinephrine', maxPoints: 5, type: 'points' },
          { id: 's2_capno_trend', label: 'Capnography trending 25 → 45 monitored during CPR', maxPoints: 4, type: 'points' },
        ],
      },
      {
        id: 's2_rosc',
        name: 'Post-ROSC Care',
        criteria: [
          { id: 's2_rosc_confirm', label: 'ROSC confirmed; vitals reassessed', maxPoints: 3, type: 'points' },
          { id: 's2_repeat_12lead', label: 'Repeat 12-lead obtained – Scarbossa + STEMI identified', maxPoints: 5, type: 'points' },
          { id: 's2_cath_lab', label: 'Cath lab activated', maxPoints: 8, type: 'points' },
          { id: 's2_preoxygenate', label: 'Pre-oxygenation with HFNC and NRB flush flow', maxPoints: 4, type: 'points' },
          { id: 's2_no_bvm', label: 'Did NOT BVM patient with adequate spontaneous RR of 14', maxPoints: 3, type: 'points' },
        ],
      },
      {
        id: 's2_rsi',
        name: 'RSI & Transport',
        criteria: [
          { id: 's2_rsi', label: 'RSI: Ketamine/paralytic for intubation', maxPoints: 5, type: 'points' },
          { id: 's2_et_tube', label: 'ET intubation (7–7.5 ET tube) with capnography confirmed', maxPoints: 6, type: 'points' },
          { id: 's2_resedate', label: 'Re-sedation: Ketamine or Versed/Fentanyl', maxPoints: 4, type: 'points' },
          { id: 's2_transport', label: 'Transport to appropriate facility with reassessments', maxPoints: 3, type: 'points' },
        ],
      },
      {
        id: 's2_critical',
        name: 'Critical Criteria (Deductions)',
        criteria: [
          { id: 's2_cf_cpr', label: 'Failed to initiate CPR immediately on cardiac arrest', type: 'critical_fail', penalty: 25 },
          { id: 's2_cf_defib', label: 'Failed to defibrillate shockable VT/VF rhythm', type: 'critical_fail', penalty: 25 },
          { id: 's2_cf_cath_lab', label: 'Failed to activate cath lab post-ROSC with confirmed STEMI', type: 'critical_fail', penalty: 20 },
          { id: 's2_cf_moved_pt', label: 'Moved hypoxic/hypotensive patient without optimization', type: 'critical_fail', penalty: 15 },
          { id: 's2_cf_wrong_meds', label: 'Wrong induction medications used for RSI', type: 'critical_fail', penalty: 15 },
        ],
      },
    ],
  },
  {
    id: 's3',
    name: 'Scenario 3 – MCI / Trauma (Construction Collapse)',
    description: '4 patients, 40ft fall from scaffolding; 3 asystole, 1 PEA – only crew on scene',
    sections: [
      {
        id: 's3_general',
        name: 'General & Team Performance',
        criteria: [
          { id: 's3_gen_bsi', label: 'BSI / PPE precautions taken', maxPoints: 2, type: 'points' },
          { id: 's3_gen_scene', label: 'Scene safety verbalized and assessed', maxPoints: 3, type: 'points' },
          { id: 's3_gen_primary', label: 'Primary survey: Airway, Breathing, Circulation', maxPoints: 5, type: 'points' },
          { id: 's3_gen_history', label: 'SAMPLE / focused history obtained', maxPoints: 4, type: 'points' },
          { id: 's3_gen_team', label: 'Team coordination and delegation of duties', maxPoints: 5, type: 'points' },
        ],
      },
      {
        id: 's3_triage',
        name: 'Mass Casualty Triage',
        criteria: [
          { id: 's3_black_calls', label: '3 asystole patients correctly called BLACK (no resuscitation)', maxPoints: 10, type: 'points' },
          { id: 's3_no_cpr_black', label: 'No CPR performed on asystole/BLACK patients (resource preservation)', maxPoints: 5, type: 'points' },
          { id: 's3_pea_identified', label: 'PEA patient correctly identified as the salvageable patient', maxPoints: 5, type: 'points' },
        ],
      },
      {
        id: 's3_trauma',
        name: 'Trauma Interventions',
        criteria: [
          { id: 's3_decompress', label: 'Needle decompression or finger thoracostomies performed bilaterally', maxPoints: 8, type: 'points' },
          { id: 's3_pericardio', label: 'Pericardiocentesis attempted', maxPoints: 5, type: 'points' },
          { id: 's3_blood_fluid', label: 'Blood or crystalloids administered', maxPoints: 5, type: 'points' },
          { id: 's3_pelvic_binder', label: 'Pelvic binder applied', maxPoints: 5, type: 'points' },
          { id: 's3_expose_exam', label: 'Patient exposed; head-to-toe exam; c-spine considered', maxPoints: 5, type: 'points' },
          { id: 's3_sga_et', label: 'SGA or ET tube placed at RR 10', maxPoints: 5, type: 'points' },
        ],
      },
      {
        id: 's3_resuscitation',
        name: 'Resuscitation',
        criteria: [
          { id: 's3_cpr_after_skills', label: 'CPR initiated AFTER other skills prioritized (correct sequencing)', maxPoints: 6, type: 'points' },
          { id: 's3_rosc', label: 'ROSC achieved', maxPoints: 3, type: 'points' },
          { id: 's3_vitals_post_rosc', label: 'Full vitals including BGL obtained post-ROSC', maxPoints: 5, type: 'points' },
          { id: 's3_chest_seals', label: 'Bilateral chest seals applied (if finger thoracostomy used)', maxPoints: 4, type: 'points' },
          { id: 's3_manual_bp', label: 'Manual BP obtained [Extra Credit]', maxPoints: 2, type: 'points' },
        ],
      },
      {
        id: 's3_postrosc',
        name: 'Post-ROSC Optimization',
        criteria: [
          { id: 's3_reassess', label: 'Secondary assessment performed post-ROSC', maxPoints: 4, type: 'points' },
          { id: 's3_txa_calcium', label: 'TXA and calcium considered and administered', maxPoints: 5, type: 'points' },
          { id: 's3_hfnc', label: 'HFNC flush flow applied', maxPoints: 3, type: 'points' },
          { id: 's3_goals', label: 'Sats optimized to ≥94% and SBP ≥90 (blood preferred over crystalloid)', maxPoints: 5, type: 'points' },
        ],
      },
      {
        id: 's3_rsi',
        name: 'RSI & Transport',
        criteria: [
          { id: 's3_rsi', label: 'RSI: Ketamine/paralytic used for intubation', maxPoints: 5, type: 'points' },
          { id: 's3_et_tube', label: 'ET intubation (7–7.5 ET tube)', maxPoints: 5, type: 'points' },
          { id: 's3_resedate', label: 'Re-sedation with Ketamine (appropriate given hypotension)', maxPoints: 4, type: 'points' },
          { id: 's3_transport', label: 'Transport to appropriate facility with constant reassessments', maxPoints: 3, type: 'points' },
          { id: 's3_enroute', label: 'En route deterioration managed – ET tube burped or repositioned with improvement', maxPoints: 4, type: 'points' },
        ],
      },
      {
        id: 's3_critical',
        name: 'Critical Criteria (Deductions)',
        criteria: [
          { id: 's3_cf_cpr_black', label: 'Performed CPR on non-survivable asystole patients (wasted resources)', type: 'critical_fail', penalty: 20 },
          { id: 's3_cf_decompress', label: 'Failed to decompress suspected tension pneumothorax', type: 'critical_fail', penalty: 25 },
          { id: 's3_cf_hemorrhage', label: 'Failed to address hemorrhage control', type: 'critical_fail', penalty: 25 },
          { id: 's3_cf_moved_pt', label: 'Moved hypoxic or hypotensive patient before optimization', type: 'critical_fail', penalty: 15 },
        ],
      },
    ],
  },
  {
    id: 's4',
    name: 'Scenario 4 – Eclampsia / OB Emergency',
    description: '28yo female, 38wk pregnancy, active labor, prolapsed cord, seizure, eclampsia',
    sections: [
      {
        id: 's4_general',
        name: 'General & Team Performance',
        criteria: [
          { id: 's4_gen_bsi', label: 'BSI / PPE precautions taken', maxPoints: 2, type: 'points' },
          { id: 's4_gen_scene', label: 'Scene safety verbalized and assessed', maxPoints: 3, type: 'points' },
          { id: 's4_gen_primary', label: 'Primary survey: Airway, Breathing, Circulation', maxPoints: 5, type: 'points' },
          { id: 's4_gen_history', label: 'SAMPLE / focused history obtained', maxPoints: 4, type: 'points' },
          { id: 's4_gen_team', label: 'Team coordination and delegation of duties', maxPoints: 5, type: 'points' },
        ],
      },
      {
        id: 's4_scene',
        name: 'Scene & Assessment',
        criteria: [
          { id: 's4_scene_safety', label: 'Scene cleared and patient protected during generalized seizure', maxPoints: 4, type: 'points' },
          { id: 's4_vitals', label: 'Full set of vitals obtained (BP, HR, RR, SpO2, Capno, Temp, BGL)', maxPoints: 5, type: 'points' },
          { id: 's4_manual_bp', label: 'Manual BP obtained [Extra Credit]', maxPoints: 2, type: 'points' },
        ],
      },
      {
        id: 's4_ob',
        name: 'OB Emergency Management',
        criteria: [
          { id: 's4_cord_relief', label: 'Hand in vagina to manually relieve pressure on prolapsed cord', maxPoints: 10, type: 'points' },
          { id: 's4_delivery', label: 'Baby delivery managed appropriately', maxPoints: 8, type: 'points' },
          { id: 's4_cord_cut', label: 'Umbilical cord cut', maxPoints: 3, type: 'points' },
          { id: 's4_second_unit', label: 'Second unit called for neonate care', maxPoints: 4, type: 'points' },
        ],
      },
      {
        id: 's4_eclampsia',
        name: 'Eclampsia Treatment',
        criteria: [
          { id: 's4_mag', label: 'Magnesium sulfate: 4g IV over 20 min OR 5g IM each buttock', maxPoints: 10, type: 'points' },
          { id: 's4_mag_drip', label: 'Magnesium maintenance drip continued at 2g/hr', maxPoints: 4, type: 'points' },
          { id: 's4_benzo', label: 'Benzodiazepine for seizure (Versed 10mg IM, 5mg IV, or equivalent)', maxPoints: 6, type: 'points' },
          { id: 's4_labetalol', label: 'Labetalol 20mg IV for hypertensive emergency', maxPoints: 5, type: 'points' },
          { id: 's4_labetalol_doubled', label: 'Labetalol dose doubled on repeat if BP not controlled', maxPoints: 3, type: 'points' },
        ],
      },
      {
        id: 's4_hemorrhage',
        name: 'Hemorrhage & Pre-Intubation Optimization',
        criteria: [
          { id: 's4_txa', label: 'TXA and calcium given for postpartum hemorrhage', maxPoints: 6, type: 'points' },
          { id: 's4_blood_ivf', label: 'Blood/IVF administered', maxPoints: 4, type: 'points' },
          { id: 's4_sats_goal', label: 'SpO2 ≥94% achieved before intubation', maxPoints: 5, type: 'points' },
          { id: 's4_sbp_goal', label: 'SBP ≥90 achieved before intubation', maxPoints: 5, type: 'points' },
        ],
      },
      {
        id: 's4_rsi',
        name: 'RSI & Transport',
        criteria: [
          { id: 's4_rsi', label: 'RSI: Ketamine/paralytic for intubation', maxPoints: 5, type: 'points' },
          { id: 's4_et_tube', label: 'ET intubation (7–7.5 ET tube) with capnography', maxPoints: 5, type: 'points' },
          { id: 's4_resedate', label: 'Re-sedation with Ketamine', maxPoints: 4, type: 'points' },
          { id: 's4_transport', label: 'Transport to appropriate facility', maxPoints: 3, type: 'points' },
          { id: 's4_reassess', label: 'Constant reassessments en route', maxPoints: 3, type: 'points' },
        ],
      },
      {
        id: 's4_critical',
        name: 'Critical Criteria (Deductions)',
        criteria: [
          { id: 's4_cf_cord', label: 'Failed to manually relieve pressure on prolapsed cord', type: 'critical_fail', penalty: 25 },
          { id: 's4_cf_mag', label: 'Failed to administer Magnesium sulfate for eclampsia', type: 'critical_fail', penalty: 20 },
          { id: 's4_cf_moved_pt', label: 'Moved hypoxic or hypotensive patient before optimization', type: 'critical_fail', penalty: 20 },
          { id: 's4_cf_intub_goals', label: 'Intubated before achieving SpO2 ≥94% and SBP ≥90', type: 'critical_fail', penalty: 15 },
          { id: 's4_cf_wrong_meds', label: 'Wrong induction/re-sedation medications used based on vitals', type: 'critical_fail', penalty: 15 },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Storage: Vercel KV (Redis) when env vars present, local files otherwise
// ---------------------------------------------------------------------------
const KV_ENABLED = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
let kv = null;
if (KV_ENABLED) {
  const mod = await import('@vercel/kv');
  kv = mod.kv;
}

const fileRead = (file) => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) {
    const init = file === SUBMISSIONS_FILE ? [] : DEFAULT_SCENARIOS;
    fs.writeFileSync(file, JSON.stringify(init, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
};
const fileWrite = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const store = {
  async getSubmissions() {
    if (kv) return (await kv.get('submissions')) ?? [];
    return fileRead(SUBMISSIONS_FILE);
  },
  async setSubmissions(data) {
    if (kv) { await kv.set('submissions', data); return; }
    fileWrite(SUBMISSIONS_FILE, data);
  },
  async getScenarios() {
    if (kv) {
      const d = await kv.get('scenarios');
      if (d) return d;
      await kv.set('scenarios', DEFAULT_SCENARIOS);
      return DEFAULT_SCENARIOS;
    }
    return fileRead(SCENARIOS_FILE);
  },
  async setScenarios(data) {
    if (kv) { await kv.set('scenarios', data); return; }
    fileWrite(SCENARIOS_FILE, data);
  },
  async getTeams() {
    if (kv) return (await kv.get('teams')) ?? [];
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const f = path.join(DATA_DIR, 'teams.json');
    if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify([], null, 2));
    return JSON.parse(fs.readFileSync(f, 'utf-8'));
  },
  async setTeams(data) {
    if (kv) { await kv.set('teams', data); return; }
    fileWrite(path.join(DATA_DIR, 'teams.json'), data);
  },
  async getDisplayInfo() {
    const empty = { currentlyIn: '', comingUpNext: '', announcement: '' };
    if (kv) return (await kv.get('displayInfo')) ?? empty;
    const f = path.join(DATA_DIR, 'displayInfo.json');
    if (!fs.existsSync(f)) return empty;
    return JSON.parse(fs.readFileSync(f, 'utf-8'));
  },
  async setDisplayInfo(data) {
    if (kv) { await kv.set('displayInfo', data); return; }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fileWrite(path.join(DATA_DIR, 'displayInfo.json'), data);
  },
};

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const requireAdmin = (req, res, next) => {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) res.json({ success: true });
  else res.status(401).json({ error: 'Invalid password' });
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const submissions = await store.getSubmissions();
    const teamMap = {};
    submissions.forEach((sub) => {
      const key = (sub.teamName || 'Unknown').toLowerCase().trim();
      if (!teamMap[key]) {
        teamMap[key] = { teamName: sub.teamName || 'Unknown', submissions: [], totalNet: 0, totalPossible: 0 };
      }
      teamMap[key].submissions.push({
        scenario: sub.scenario || sub.scenarioId || 'Unknown',
        net: sub.totals?.net ?? 0,
        possible: sub.totals?.possible ?? 0,
      });
      teamMap[key].totalNet += sub.totals?.net ?? 0;
      teamMap[key].totalPossible += sub.totals?.possible ?? 0;
    });
    const teams = Object.values(teamMap).sort((a, b) => {
      const pa = a.totalPossible > 0 ? a.totalNet / a.totalPossible : 0;
      const pb = b.totalPossible > 0 ? b.totalNet / b.totalPossible : 0;
      return pb - pa;
    });
    const displayInfo = await store.getDisplayInfo();
    res.json({ teams, displayInfo, updatedAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.get('/api/teams', async (req, res) => {
  try { res.json(await store.getTeams()); }
  catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.post('/api/teams', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const teams = await store.getTeams();
    if (teams.includes(name.trim())) return res.status(400).json({ error: 'Team already exists' });
    teams.push(name.trim());
    await store.setTeams(teams);
    res.json({ success: true, teams });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.put('/api/display-info', requireAdmin, async (req, res) => {
  try {
    const current = await store.getDisplayInfo();
    await store.setDisplayInfo({ ...current, ...req.body });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.delete('/api/teams/:name', requireAdmin, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const teams = await store.getTeams();
    await store.setTeams(teams.filter((t) => t !== name));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

const FINALS_ONLY_IDS = new Set(['s4']);

app.get('/api/scenarios', async (req, res) => {
  try {
    const scenarios = await store.getScenarios();
    res.json(scenarios.map(({ id, name, description }) => ({
      id, name, description, finalsOnly: FINALS_ONLY_IDS.has(id),
    })));
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.get('/api/criteria/:scenarioId', async (req, res) => {
  try {
    const scenarios = await store.getScenarios();
    const scenario = scenarios.find((s) => s.id === req.params.scenarioId);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    res.json({ sections: scenario.sections });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.put('/api/criteria/:scenarioId', requireAdmin, async (req, res) => {
  try {
    const scenarios = await store.getScenarios();
    const idx = scenarios.findIndex((s) => s.id === req.params.scenarioId);
    if (idx === -1) return res.status(404).json({ error: 'Scenario not found' });
    scenarios[idx].sections = req.body.sections;
    await store.setScenarios(scenarios);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.get('/api/submissions', requireAdmin, async (req, res) => {
  try {
    res.json(await store.getSubmissions());
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.post('/api/submissions', async (req, res) => {
  try {
    const submissions = await store.getSubmissions();
    const submission = { id: randomUUID(), timestamp: new Date().toISOString(), ...req.body };
    submissions.push(submission);
    await store.setSubmissions(submissions);
    res.json({ success: true, id: submission.id });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.put('/api/submissions/:id', requireAdmin, async (req, res) => {
  try {
    const submissions = await store.getSubmissions();
    const idx = submissions.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    submissions[idx] = { ...submissions[idx], ...req.body };
    await store.setSubmissions(submissions);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.delete('/api/submissions/:id', requireAdmin, async (req, res) => {
  try {
    const submissions = await store.getSubmissions();
    await store.setSubmissions(submissions.filter((s) => s.id !== req.params.id));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

app.delete('/api/submissions', requireAdmin, async (req, res) => {
  try {
    await store.setSubmissions([]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Storage error' }); }
});

export default app;

if (!IS_VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}
