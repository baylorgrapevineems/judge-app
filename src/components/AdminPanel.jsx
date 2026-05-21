import { useState, useEffect, useCallback } from 'react';
import CriteriaEditor from './CriteriaEditor';

function AdminScoreStepper({ value, max, onChange }) {
  const handleInput = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(0, v)));
  };
  return (
    <div className="score-stepper">
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}>−</button>
      <input type="number" className="stepper-input" value={value} min={0} max={max} onChange={handleInput} onBlur={handleInput} />
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  );
}

function calcTotals(criteria, scores, criticalFails, timeScore = 0) {
  let earned = 0, possible = 0, deductions = 0;
  criteria.sections.forEach((section) => {
    section.criteria.forEach((c) => {
      if (c.type === 'critical_fail') {
        if (criticalFails?.[c.id]) deductions += c.penalty || 0;
      } else {
        possible += c.maxPoints || 0;
        earned += scores?.[c.id] || 0;
      }
    });
  });
  if (timeScore > 0) { possible += 10; earned += timeScore; }
  const net = Math.max(0, earned - deductions);
  const pct = possible > 0 ? (net / possible) * 100 : 0;
  return { earned, possible, deductions, net, pct };
}

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

function SubmissionDetail({ sub, criteria, adminPassword, onDelete, onUpdate, addToast }) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editScores, setEditScores] = useState({});
  const [editCriticalFails, setEditCriticalFails] = useState({});
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

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

  const startEdit = () => {
    setEditScores({ ...(sub.scores || {}) });
    setEditCriticalFails({ ...(sub.criticalFails || {}) });
    setEditNotes(sub.notes || '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const newTotals = criteria
      ? calcTotals(criteria, editScores, editCriticalFails, sub.timeScore || 0)
      : sub.totals;
    try {
      const res = await fetch(`/api/submissions/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify({ scores: editScores, criticalFails: editCriticalFails, notes: editNotes, totals: newTotals }),
      });
      if (!res.ok) throw new Error();
      onUpdate(sub.id, { scores: editScores, criticalFails: editCriticalFails, notes: editNotes, totals: newTotals });
      setEditing(false);
      addToast('Submission updated', 'success');
    } catch {
      addToast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const { totals, scores, criticalFails, notes } = sub;

  if (editing && criteria) {
    return (
      <div className="submission-detail">
        <div className="detail-section">
          <div className="detail-section-title" style={{ color: 'var(--primary)' }}>✏️ Editing — {sub.teamName} · {sub.judgeName}</div>
        </div>

        {criteria.sections.map((section) => (
          <div className="detail-section" key={section.id}>
            <div className="detail-section-title">{section.name}</div>
            {section.criteria.map((c) => {
              if (c.type === 'critical_fail') {
                const applied = editCriticalFails[c.id] || false;
                return (
                  <div className="critical-row" key={c.id}>
                    <div className="critical-check-wrap">
                      <input type="checkbox" id={`ecf-${c.id}`} checked={applied}
                        onChange={(e) => setEditCriticalFails((p) => ({ ...p, [c.id]: e.target.checked }))} />
                    </div>
                    <label className={`critical-label ${applied ? 'applied' : ''}`} htmlFor={`ecf-${c.id}`}>{c.label}</label>
                    {applied && <span className="critical-penalty">−{c.penalty} pts</span>}
                  </div>
                );
              }
              return (
                <div className="criterion-row" key={c.id}>
                  <span className="criterion-label" style={{ fontSize: '0.85rem' }}>{c.label}</span>
                  <span className="criterion-max">/{c.maxPoints}</span>
                  <AdminScoreStepper
                    value={editScores[c.id] ?? 0}
                    max={c.maxPoints}
                    onChange={(v) => setEditScores((p) => ({ ...p, [c.id]: v }))}
                  />
                </div>
              );
            })}
          </div>
        ))}

        <div className="detail-section">
          <div className="detail-section-title">Notes</div>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', resize: 'vertical' }}
          />
        </div>

        <div className="detail-actions">
          <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="submission-detail">
      <div className="detail-section">
        <div className="detail-section-title">Session Info</div>
        <div className="detail-score-grid">
          <span className="detail-score-label">Judge</span>
          <span className="detail-score-val">{sub.judgeName || '—'}</span>
          <span className="detail-score-label">Scenario</span>
          <span className="detail-score-val">{sub.scenario || '—'}</span>
          <span className="detail-score-label">Submitted</span>
          <span className="detail-score-val">{formatDate(sub.timestamp)}</span>
        </div>
      </div>

      {criteria && criteria.sections.map((section) => {
        const items = section.criteria.filter((c) =>
          c.type === 'critical_fail' ? criticalFails?.[c.id] : scores?.[c.id] !== undefined
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
                    <span key={`${c.id}-v`} className="detail-score-val">{scores[c.id]} / {c.maxPoints}</span>
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
        {criteria && (
          <button className="btn btn-primary btn-sm" onClick={startEdit}>✏️ Edit Scores</button>
        )}
        <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : '🗑 Delete'}
        </button>
      </div>
    </div>
  );
}

function SubmissionCard({ sub: initialSub, criteria, adminPassword, onDelete, onUpdate, addToast }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(initialSub);
  const totals = sub.totals || {};
  const net = totals.net ?? 0;
  const possible = totals.possible ?? 0;
  const pct = possible > 0 ? (net / possible) * 100 : 0;
  const grade = scoreGrade(pct);

  const handleUpdate = (id, updates) => {
    setSub((prev) => ({ ...prev, ...updates }));
    onUpdate(id, updates);
  };

  return (
    <div className="submission-card">
      <div className="submission-card-header" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((v) => !v)}>
        <div>
          <div className="submission-team">{sub.teamName || 'Unknown Team'}</div>
          <div className="submission-meta">{sub.judgeName || ''}{sub.scenario ? ` · ${sub.scenario}` : ''}</div>
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
          onUpdate={handleUpdate}
          addToast={addToast}
        />
      )}
    </div>
  );
}

function TeamsTab({ adminPassword, addToast }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch('/api/teams', { headers: { 'x-admin-password': adminPassword } })
      .then((r) => r.json())
      .then((data) => { setTeams(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { addToast('Failed to load teams', 'error'); setLoading(false); });
  }, [adminPassword, addToast]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'Failed to add team', 'error'); return; }
      setTeams(data.teams);
      setNewName('');
      addToast(`${name} added`, 'success');
    } catch { addToast('Failed to add team', 'error'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (name) => {
    if (!confirm(`Remove "${name}" from the roster?`)) return;
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      if (!res.ok) throw new Error();
      setTeams((prev) => prev.filter((t) => t !== name));
      addToast(`${name} removed`, 'success');
    } catch { addToast('Failed to remove team', 'error'); }
  };

  if (loading) return <div className="loading-wrap"><div className="spinner" /><span>Loading…</span></div>;

  return (
    <>
      <div className="card">
        <div className="card-header"><h2>➕ Add Team</h2></div>
        <div className="card-body">
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Team name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoComplete="off"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={adding || !newName.trim()}>
              {adding ? '…' : 'Add'}
            </button>
          </form>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>No teams yet. Add teams above so judges can select them.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><h2>👥 Team Roster ({teams.length})</h2></div>
          <div className="card-body" style={{ padding: '0 16px' }}>
            {teams.map((name) => (
              <div key={name} className="criterion-row">
                <span className="criterion-label" style={{ fontWeight: 600 }}>{name}</span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(name)}
                  style={{ marginLeft: 'auto' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const EMPTY_DISPLAY = { currentlyIn: '', comingUpNext: '', announcement: '' };

function DisplayInfoControl({ adminPassword, addToast }) {
  const [info, setInfo] = useState(EMPTY_DISPLAY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => setInfo(data.displayInfo || EMPTY_DISPLAY))
      .catch(() => {});
  }, []);

  const setField = (key, val) => setInfo((prev) => ({ ...prev, [key]: val }));

  const push = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/display-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify(info),
      });
      if (!res.ok) throw new Error();
      addToast('Display board updated', 'success');
    } catch {
      addToast('Failed to update display', 'error');
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    const cleared = EMPTY_DISPLAY;
    setInfo(cleared);
    setSaving(true);
    try {
      await fetch('/api/display-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify(cleared),
      });
      addToast('Display bars cleared', 'success');
    } catch {
      addToast('Failed to clear display', 'error');
    } finally {
      setSaving(false);
    }
  };

  const hasAny = info.currentlyIn || info.comingUpNext || info.announcement;

  return (
    <div className="card" style={{ marginBottom: '14px' }}>
      <div className="card-header"><h2>📺 Display Board</h2></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ color: '#16a34a', fontWeight: 700 }}>🎯 Currently In</label>
          <input
            type="text"
            placeholder="e.g. Scenario 2 – Team Alpha"
            value={info.currentlyIn}
            onChange={(e) => setField('currentlyIn', e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ color: '#1d4ed8', fontWeight: 700 }}>⏭ Coming Up Next</label>
          <input
            type="text"
            placeholder="e.g. Scenario 3 – Team Bravo"
            value={info.comingUpNext}
            onChange={(e) => setField('comingUpNext', e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ color: '#b45309', fontWeight: 700 }}>📢 Announcement</label>
          <input
            type="text"
            placeholder="e.g. Lunch break – 30 minutes!"
            value={info.announcement}
            onChange={(e) => setField('announcement', e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary btn-sm" onClick={push} disabled={saving}>
            {saving ? 'Saving…' : '📺 Push to Display'}
          </button>
          {hasAny && (
            <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={saving}>
              ✕ Clear All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardTab({ adminPassword, addToast }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/submissions', { headers: { 'x-admin-password': adminPassword } })
      .then((r) => r.json())
      .then((data) => { setSubmissions(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { addToast('Failed to load submissions', 'error'); setLoading(false); });
  }, [adminPassword, addToast]);

  if (loading) return (
    <>
      <DisplayInfoControl adminPassword={adminPassword} addToast={addToast} />
      <div className="loading-wrap"><div className="spinner" /><span>Loading…</span></div>
    </>
  );

  // Group by team name (case-insensitive)
  const teamMap = {};
  submissions.forEach((sub) => {
    const key = (sub.teamName || 'Unknown').toLowerCase().trim();
    if (!teamMap[key]) {
      teamMap[key] = { teamName: sub.teamName || 'Unknown', submissions: [], totalNet: 0, totalPossible: 0 };
    }
    teamMap[key].submissions.push(sub);
    teamMap[key].totalNet += sub.totals?.net ?? 0;
    teamMap[key].totalPossible += sub.totals?.possible ?? 0;
  });

  const teams = Object.values(teamMap).sort((a, b) => {
    const pa = a.totalPossible > 0 ? a.totalNet / a.totalPossible : 0;
    const pb = b.totalPossible > 0 ? b.totalNet / b.totalPossible : 0;
    return pb - pa;
  });

  if (teams.length === 0) {
    return (
      <>
        <DisplayInfoControl adminPassword={adminPassword} addToast={addToast} />
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <p>No submissions yet. Leaderboard will appear once scores are submitted.</p>
        </div>
      </>
    );
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <DisplayInfoControl adminPassword={adminPassword} addToast={addToast} />
      <div className="alert alert-info" style={{ marginBottom: '16px' }}>
        Top 3 teams advance to finals. Combined score = sum of all submitted scenario scores.
      </div>
      {teams.map((team, idx) => {
        const rank = idx + 1;
        const advances = rank <= 3;
        const pct = team.totalPossible > 0 ? (team.totalNet / team.totalPossible) * 100 : 0;
        const grade = pct >= 90 ? 'excellent' : pct >= 75 ? 'good' : pct >= 60 ? 'fair' : 'poor';
        return (
          <div key={team.teamName} className={`leaderboard-card ${advances ? 'leaderboard-advances' : ''}`}>
            <div className="leaderboard-header">
              <span className="leaderboard-medal">{medals[idx] ?? `#${rank}`}</span>
              <div className="leaderboard-team-info">
                <span className="leaderboard-team-name">{team.teamName}</span>
                {advances && <span className="advances-badge">ADVANCES TO FINALS</span>}
              </div>
              <div className="leaderboard-combined">
                <span className={`leaderboard-score score-${grade}`}>{team.totalNet}</span>
                <span className="leaderboard-possible">/{team.totalPossible}</span>
                <span className="leaderboard-pct">({pct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="leaderboard-breakdown">
              {team.submissions
                .slice()
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .map((sub) => {
                  const sNet = sub.totals?.net ?? 0;
                  const sPoss = sub.totals?.possible ?? 0;
                  const sPct = sPoss > 0 ? (sNet / sPoss) * 100 : 0;
                  return (
                    <div key={sub.id} className="leaderboard-sub-row">
                      <span className="leaderboard-sub-scenario">{sub.scenario || 'Unknown Scenario'}</span>
                      <span className="leaderboard-sub-score">{sNet} / {sPoss} &nbsp;<span className="leaderboard-sub-pct">({sPct.toFixed(1)}%)</span></span>
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubmissionsTab({ adminPassword, criteriaMap, addToast }) {
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
  const handleUpdate = (id, updates) => setSubmissions((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));

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
            criteria={criteriaMap[sub.scenarioId] || null}
            adminPassword={adminPassword}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
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
  const [scenarios, setScenarios] = useState([]);
  const [criteriaMap, setCriteriaMap] = useState({});
  const [editingScenarioId, setEditingScenarioId] = useState('');

  useEffect(() => {
    if (!authed) return;
    fetch('/api/scenarios')
      .then((r) => r.json())
      .then(async (list) => {
        setScenarios(list);
        const entries = await Promise.all(
          list.map((s) =>
            fetch(`/api/criteria/${s.id}`)
              .then((r) => r.json())
              .then((c) => [s.id, c])
          )
        );
        setCriteriaMap(Object.fromEntries(entries));
        if (list.length > 0) setEditingScenarioId(list[0].id);
      })
      .catch(() => addToast('Failed to load scenarios', 'error'));
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
        <button className={`admin-tab ${tab === 'leaderboard' ? 'active' : ''}`} onClick={() => setTab('leaderboard')}>
          🏆 Leaderboard
        </button>
        <button className={`admin-tab ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')}>
          👥 Teams
        </button>
        <button className={`admin-tab ${tab === 'criteria' ? 'active' : ''}`} onClick={() => setTab('criteria')}>
          ✏️ Criteria
        </button>
      </div>

      {tab === 'submissions' && (
        <SubmissionsTab adminPassword={adminPassword} criteriaMap={criteriaMap} addToast={addToast} />
      )}
      {tab === 'leaderboard' && (
        <LeaderboardTab adminPassword={adminPassword} addToast={addToast} />
      )}
      {tab === 'teams' && (
        <TeamsTab adminPassword={adminPassword} addToast={addToast} />
      )}
      {tab === 'criteria' && (
        <>
          <div className="card" style={{ marginBottom: '12px' }}>
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="edit-scenario">Editing criteria for</label>
                <select
                  id="edit-scenario"
                  value={editingScenarioId}
                  onChange={(e) => setEditingScenarioId(e.target.value)}
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {editingScenarioId && criteriaMap[editingScenarioId] && (
            <CriteriaEditor
              key={editingScenarioId}
              criteria={criteriaMap[editingScenarioId]}
              scenarioId={editingScenarioId}
              adminPassword={adminPassword}
              onSave={(updated) => {
                setCriteriaMap((prev) => ({ ...prev, [editingScenarioId]: updated }));
                addToast('Criteria saved!', 'success');
              }}
              addToast={addToast}
            />
          )}
        </>
      )}
    </>
  );
}
