import { useState, useEffect, useCallback } from 'react';
import CriteriaEditor from './CriteriaEditor';

function scoreGrade(pct) {
  if (pct >= 90) return 'excellent';
  if (pct >= 75) return 'good';
  if (pct >= 60) return 'fair';
  return 'poor';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function SubmissionDetail({ sub, criteria, adminPassword, onDelete, addToast }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete submission for ${sub.teamName}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/submissions/${sub.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      if (!res.ok) throw new Error();
      onDelete(sub.id);
      addToast('Submission deleted', 'success');
    } catch {
      addToast('Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const { totals, scores, criticalFails, notes } = sub;

  return (
    <div className="submission-detail">
      <div className="detail-section">
        <div className="detail-section-title">Session Info</div>
        <div className="detail-score-grid">
          <span className="detail-score-label">Judge</span>
          <span className="detail-score-val">{sub.judgeName || '—'}</span>
          <span className="detail-score-label">Station</span>
          <span className="detail-score-val">{sub.station || '—'}</span>
          <span className="detail-score-label">Scenario</span>
          <span className="detail-score-val">{sub.scenario || '—'}</span>
          <span className="detail-score-label">Submitted</span>
          <span className="detail-score-val">{formatDate(sub.timestamp)}</span>
        </div>
      </div>

      {criteria && criteria.sections.map((section) => {
        const items = section.criteria.filter((c) =>
          c.type === 'critical_fail'
            ? criticalFails?.[c.id]
            : scores?.[c.id] !== undefined
        );
        if (!items.length) return null;
        return (
          <div className="detail-section" key={section.id}>
            <div className="detail-section-title">{section.name}</div>
            <div className="detail-score-grid">
              {section.criteria.map((c) => {
                if (c.type === 'critical_fail') {
                  if (!criticalFails?.[c.id]) return null;
                  return (
                    <span key={c.id} className="detail-score-label" style={{ gridColumn: '1/-1' }}>
                      <span className="detail-score-val cf-applied">⚠ {c.label} (−{c.penalty} pts)</span>
                    </span>
                  );
                }
                if (scores?.[c.id] === undefined) return null;
                return (
                  <>
                    <span key={`${c.id}-l`} className="detail-score-label">{c.label}</span>
                    <span key={`${c.id}-v`} className="detail-score-val">
                      {scores[c.id]} / {c.maxPoints}
                    </span>
                  </>
                );
              })}
            </div>
          </div>
        );
      })}

      {notes && (
        <div className="detail-section">
          <div className="detail-section-title">Notes</div>
          <div className="detail-notes">{notes}</div>
        </div>
      )}

      {totals && (
        <div className="detail-section">
          <div className="detail-section-title">Score Breakdown</div>
          <div className="detail-score-grid">
            <span className="detail-score-label">Points Earned</span>
            <span className="detail-score-val">{totals.earned}</span>
            {totals.deductions > 0 && (
              <>
                <span className="detail-score-label">Deductions</span>
                <span className="detail-score-val cf-applied">−{totals.deductions}</span>
              </>
            )}
            <span className="detail-score-label">Net Score</span>
            <span className="detail-score-val">{totals.net} / {totals.possible}</span>
          </div>
        </div>
      )}

      <div className="detail-actions">
        <button
          className="btn btn-danger btn-sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : '🗑 Delete'}
        </button>
      </div>
    </div>
  );
}

function SubmissionCard({ sub, criteria, adminPassword, onDelete, addToast }) {
  const [open, setOpen] = useState(false);
  const totals = sub.totals || {};
  const net = totals.net ?? 0;
  const possible = totals.possible ?? 0;
  const pct = possible > 0 ? (net / possible) * 100 : 0;
  const grade = scoreGrade(pct);

  return (
    <div className="submission-card">
      <div className="submission-card-header" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((v) => !v)}>
        <div>
          <div className="submission-team">{sub.teamName || 'Unknown Team'}</div>
          <div className="submission-meta">{sub.judgeName || ''}{sub.station ? ` · ${sub.station}` : ''}{sub.scenario ? ` · ${sub.scenario}` : ''}</div>
          <div className="submission-meta">{formatDate(sub.timestamp)}</div>
        </div>
        <span className={`submission-score-badge badge-${grade}`}>
          {net}/{possible}
        </span>
        <span className={`expand-icon ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && (
        <SubmissionDetail
          sub={sub}
          criteria={criteria}
          adminPassword={adminPassword}
          onDelete={onDelete}
          addToast={addToast}
        />
      )}
    </div>
  );
}

function SubmissionsTab({ adminPassword, criteria, addToast }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clearingAll, setClearingAll] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/submissions', { headers: { 'x-admin-password': adminPassword } })
      .then((r) => r.json())
      .then((data) => {
        setSubmissions(Array.isArray(data) ? data.reverse() : []);
        setLoading(false);
      })
      .catch(() => {
        addToast('Failed to load submissions', 'error');
        setLoading(false);
      });
  }, [adminPassword, addToast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (id) => setSubmissions((prev) => prev.filter((s) => s.id !== id));

  const handleClearAll = async () => {
    if (!confirm('Delete ALL submissions? This cannot be undone.')) return;
    setClearingAll(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      if (!res.ok) throw new Error();
      setSubmissions([]);
      addToast('All submissions cleared', 'success');
    } catch {
      addToast('Failed to clear submissions', 'error');
    } finally {
      setClearingAll(false);
    }
  };

  const handleExportCSV = () => {
    if (!submissions.length) return;
    const rows = [
      ['Team', 'Judge', 'Station', 'Scenario', 'Net Score', 'Possible', 'Pct', 'Deductions', 'Timestamp'],
    ];
    submissions.forEach((s) => {
      const t = s.totals || {};
      const pct = t.possible > 0 ? ((t.net / t.possible) * 100).toFixed(1) : '0';
      rows.push([s.teamName, s.judgeName, s.station, s.scenario, t.net ?? '', t.possible ?? '', pct + '%', t.deductions ?? 0, s.timestamp]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ems-scores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = submissions.filter(
    (s) => !search || (s.teamName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.judgeName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.scenario || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalNet = submissions.reduce((s, sub) => s + (sub.totals?.net || 0), 0);
  const avgPct =
    submissions.length > 0
      ? submissions.reduce((s, sub) => {
          const t = sub.totals || {};
          return s + (t.possible > 0 ? (t.net / t.possible) * 100 : 0);
        }, 0) / submissions.length
      : 0;

  if (loading) {
    return <div className="loading-wrap"><div className="spinner" /><span>Loading…</span></div>;
  }

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{submissions.length}</div>
          <div className="stat-label">Submissions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avgPct.toFixed(0)}%</div>
          <div className="stat-label">Avg Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            {submissions.length > 0
              ? (submissions.reduce((best, s) => {
                  const t = s.totals || {};
                  const pct = t.possible > 0 ? (t.net / t.possible) * 100 : 0;
                  return pct > best ? pct : best;
                }, 0).toFixed(0)) + '%'
              : '—'}
          </div>
          <div className="stat-label">Top Score</div>
        </div>
      </div>

      <div className="submissions-toolbar">
        <input
          type="search"
          placeholder="Search team, judge, scenario…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-ghost btn-sm" onClick={handleExportCSV} disabled={!submissions.length}>
          ⬇ CSV
        </button>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
        {submissions.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={handleClearAll} disabled={clearingAll}>
            {clearingAll ? '…' : '🗑 Clear All'}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>{search ? 'No matching submissions.' : 'No submissions yet.'}</p>
        </div>
      ) : (
        filtered.map((sub) => (
          <SubmissionCard
            key={sub.id}
            sub={sub}
            criteria={criteria}
            adminPassword={adminPassword}
            onDelete={handleDelete}
            addToast={addToast}
          />
        ))
      )}
    </>
  );
}

function PasswordGate({ onAuth }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onAuth(password);
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-gate">
      <div className="password-gate-card">
        <div className="lock-icon">🔒</div>
        <h2>Admin Access</h2>
        <p>Enter the admin password to continue.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Checking…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPanel({ addToast }) {
  const [adminPassword, setAdminPassword] = useState(() => sessionStorage.getItem('adminPwd') || '');
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('adminPwd'));
  const [tab, setTab] = useState('submissions');
  const [criteria, setCriteria] = useState(null);

  useEffect(() => {
    if (authed) {
      fetch('/api/criteria')
        .then((r) => r.json())
        .then(setCriteria)
        .catch(() => addToast('Failed to load criteria', 'error'));
    }
  }, [authed, addToast]);

  const handleAuth = (pwd) => {
    setAdminPassword(pwd);
    setAuthed(true);
    sessionStorage.setItem('adminPwd', pwd);
  };

  const handleLogout = () => {
    setAuthed(false);
    setAdminPassword('');
    sessionStorage.removeItem('adminPwd');
  };

  if (!authed) return <PasswordGate onAuth={handleAuth} />;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>🔓 Logout</button>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'submissions' ? 'active' : ''}`} onClick={() => setTab('submissions')}>
          📋 Submissions
        </button>
        <button className={`admin-tab ${tab === 'criteria' ? 'active' : ''}`} onClick={() => setTab('criteria')}>
          ✏️ Criteria
        </button>
      </div>

      {tab === 'submissions' && (
        <SubmissionsTab adminPassword={adminPassword} criteria={criteria} addToast={addToast} />
      )}
      {tab === 'criteria' && criteria && (
        <CriteriaEditor
          criteria={criteria}
          adminPassword={adminPassword}
          onSave={(updated) => { setCriteria(updated); addToast('Criteria saved!', 'success'); }}
          addToast={addToast}
        />
      )}
    </>
  );
}
