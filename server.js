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
const CRITERIA_FILE = path.join(DATA_DIR, 'criteria.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ems2026';

const DEFAULT_CRITERIA = {
  sections: [
    {
      id: 'scene',
      name: 'Scene Management',
      criteria: [
        { id: 'bsi', label: 'BSI / PPE Precautions Taken', maxPoints: 2, type: 'points' },
        { id: 'scene_safety', label: 'Scene Safety Verbalized & Assessed', maxPoints: 3, type: 'points' },
        { id: 'moi', label: 'MOI / NOI Identified', maxPoints: 2, type: 'points' },
        { id: 'additional_resources', label: 'Additional Resources Called If Needed', maxPoints: 3, type: 'points' },
      ],
    },
    {
      id: 'assessment',
      name: 'Patient Assessment',
      criteria: [
        { id: 'general_impression', label: 'General Impression Verbalized', maxPoints: 3, type: 'points' },
        { id: 'loe', label: 'Level of Consciousness (AVPU/GCS)', maxPoints: 3, type: 'points' },
        { id: 'chief_complaint', label: 'Chief Complaint Identified', maxPoints: 2, type: 'points' },
        { id: 'primary_survey', label: 'Primary Survey: Airway, Breathing, Circulation', maxPoints: 6, type: 'points' },
        { id: 'sample_history', label: 'SAMPLE History Obtained', maxPoints: 5, type: 'points' },
        { id: 'opqrst', label: 'OPQRST / Focused Complaint History', maxPoints: 4, type: 'points' },
        { id: 'vitals', label: 'Vital Signs: BP, HR, RR, SpO2, Temp', maxPoints: 5, type: 'points' },
        { id: 'secondary', label: 'Secondary Head-to-Toe Assessment', maxPoints: 5, type: 'points' },
        { id: 'reassessment', label: 'Ongoing Reassessment Performed', maxPoints: 3, type: 'points' },
      ],
    },
    {
      id: 'treatment',
      name: 'Treatment & Interventions',
      criteria: [
        { id: 'oxygen', label: 'Oxygen Therapy (appropriate device & rate)', maxPoints: 4, type: 'points' },
        { id: 'interventions', label: 'Appropriate Treatment Interventions', maxPoints: 10, type: 'points' },
        { id: 'medications', label: 'Medications (correct drug, dose, route, time)', maxPoints: 8, type: 'points' },
        { id: 'packaging', label: 'Patient Packaging & Positioning', maxPoints: 4, type: 'points' },
        { id: 'transport', label: 'Transport Decision & Destination', maxPoints: 4, type: 'points' },
      ],
    },
    {
      id: 'communication',
      name: 'Communication & Professionalism',
      criteria: [
        { id: 'patient_comm', label: 'Patient Communication & Reassurance', maxPoints: 5, type: 'points' },
        { id: 'team_comm', label: 'Team Coordination & Crew Communication', maxPoints: 5, type: 'points' },
        { id: 'radio_report', label: 'Radio / Hospital Report (SBAR/MIST)', maxPoints: 5, type: 'points' },
        { id: 'documentation', label: 'PCR / Documentation Accuracy', maxPoints: 5, type: 'points' },
      ],
    },
    {
      id: 'critical',
      name: 'Critical Criteria (Deductions)',
      criteria: [
        { id: 'cf_airway', label: 'Failed to establish/maintain airway', type: 'critical_fail', penalty: 25 },
        { id: 'cf_bleeding', label: 'Failed to control life-threatening bleeding', type: 'critical_fail', penalty: 25 },
        { id: 'cf_spine', label: 'Inappropriate spinal motion restriction', type: 'critical_fail', penalty: 15 },
        { id: 'cf_medication', label: 'Administered wrong medication or wrong dose', type: 'critical_fail', penalty: 20 },
        { id: 'cf_cpr', label: 'Failed to initiate CPR when indicated', type: 'critical_fail', penalty: 25 },
      ],
    },
  ],
};

const ensureData = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SUBMISSIONS_FILE)) fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2));
  if (!fs.existsSync(CRITERIA_FILE)) fs.writeFileSync(CRITERIA_FILE, JSON.stringify(DEFAULT_CRITERIA, null, 2));
};
ensureData();

const readJSON = (file) => { ensureData(); return JSON.parse(fs.readFileSync(file, 'utf-8')); };
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

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
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/criteria', (req, res) => {
  res.json(readJSON(CRITERIA_FILE));
});

app.put('/api/criteria', requireAdmin, (req, res) => {
  writeJSON(CRITERIA_FILE, req.body);
  res.json({ success: true });
});

app.get('/api/submissions', requireAdmin, (req, res) => {
  res.json(readJSON(SUBMISSIONS_FILE));
});

app.post('/api/submissions', (req, res) => {
  const submissions = readJSON(SUBMISSIONS_FILE);
  const submission = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...req.body,
  };
  submissions.push(submission);
  writeJSON(SUBMISSIONS_FILE, submissions);
  res.json({ success: true, id: submission.id });
});

app.put('/api/submissions/:id', requireAdmin, (req, res) => {
  const submissions = readJSON(SUBMISSIONS_FILE);
  const idx = submissions.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  submissions[idx] = { ...submissions[idx], ...req.body };
  writeJSON(SUBMISSIONS_FILE, submissions);
  res.json({ success: true });
});

app.delete('/api/submissions/:id', requireAdmin, (req, res) => {
  const submissions = readJSON(SUBMISSIONS_FILE);
  writeJSON(SUBMISSIONS_FILE, submissions.filter((s) => s.id !== req.params.id));
  res.json({ success: true });
});

app.delete('/api/submissions', requireAdmin, (req, res) => {
  writeJSON(SUBMISSIONS_FILE, []);
  res.json({ success: true });
});

export default app;

if (!IS_VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}
