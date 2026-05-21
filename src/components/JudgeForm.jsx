import { useState, useEffect, useCallback } from 'react';

function ScoreStepper({ value, max, onChange }) {
  const pct = max > 0 ? value / max : 0;
  const colorClass = pct >= 1 ? 'score-full' : pct > 0 ? 'score-partial' : 'score-zero';

  const handleInput = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(0, v)));
  };

  return (
    <div className="score-stepper">
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        className={`stepper-input ${colorClass}`}
        value={value}
        min={0}
        max={max}
        onChange={handleInput}
        onBlur={handleInput}
        aria-label={`Score out of ${max}`}
      />
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

const TIME_ON_SCENE_MAX = 10;

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calcTotals(criteria, scores, criticalFails, timeScore = 0) {
  let earned = 0;
  let possible = 0;
  let deductions = 0;

  criteria.sections.forEach((section) => {
    section.criteria.forEach((c) => {
      if (c.type === 'critical_fail') {
        if (criticalFails[c.id]) deductions += c.penalty || 0;
      } else {
        possible += c.maxPoints || 0;
        earned += scores[c.id] || 0;
      }
    });
  });

  possible += TIME_ON_SCENE_MAX;
  earned += timeScore;

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

function initScoreState(criteria) {
  const scores = {};
  const criticalFails = {};
  criteria.sections.forEach((s) =>
    s.criteria.forEach((c) => {
      if (c.type === 'critical_fail') criticalFails[c.id] = false;
      else scores[c.id] = c.maxPoints || 0;
    })
  );
  return { scores, criticalFails };
}

const INITIAL_INFO = { teamName: '', judgeName: '', judgeDept: '', scenario: '' };

export default function JudgeForm({ addToast }) {
  const [teams, setTeams] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [criteria, setCriteria] = useState(null);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [info, setInfo] = useState(INITIAL_INFO);
  const [scores, setScores] = useState({});
  const [criticalFails, setCriticalFails] = useState({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Timer
  const [timerState, setTimerState] = useState('idle'); // 'idle' | 'running' | 'stopped'
  const [timerStart, setTimerStart] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timeScore, setTimeScore] = useState(0);

  useEffect(() => {
    fetch('/api/teams').then((r) => r.json()).then((data) => setTeams(Array.isArray(data) ? data : [])).catch(() => {});
    fetch('/api/scenarios')
      .then((r) => r.json())
      .then((data) => {
        setScenarios(data);
        setScenariosLoading(false);
      })
      .catch(() => {
        addToast('Failed to load scenarios', 'error');
        setScenariosLoading(false);
      });
  }, [addToast]);

  useEffect(() => {
    if (timerState !== 'running') return;
    const id = setInterval(() => setElapsedMs(Date.now() - timerStart), 100);
    return () => clearInterval(id);
  }, [timerState, timerStart]);

  const startTimer = useCallback(() => {
    const now = Date.now();
    setTimerStart(now);
    setElapsedMs(0);
    setTimerState('running');
  }, []);

  const stopTimer = useCallback(() => {
    setTimerState('stopped');
  }, []);

  const handleScenarioChange = useCallback((scenarioId) => {
    setTimerState('idle');
    setTimerStart(null);
    setElapsedMs(0);
    setTimeScore(0);
    if (!scenarioId) {
      setSelectedScenarioId('');
      setCriteria(null);
      setScores({});
      setCriticalFails({});
      return;
    }
    setSelectedScenarioId(scenarioId);
    setCriteria(null);
    setTimeScore(TIME_ON_SCENE_MAX);
    setCriteriaLoading(true);
    fetch(`/api/criteria/${scenarioId}`)
      .then((r) => r.json())
      .then((data) => {
        setCriteria(data);
        const { scores: s, criticalFails: cf } = initScoreState(data);
        setScores(s);
        setCriticalFails(cf);
        setCriteriaLoading(false);
      })
      .catch(() => {
        addToast('Failed to load criteria', 'error');
        setCriteriaLoading(false);
      });
  }, [addToast]);

  const setScore = useCallback((id, val) => setScores((p) => ({ ...p, [id]: val })), []);
  const setCF = useCallback((id, val) => setCriticalFails((p) => ({ ...p, [id]: val })), []);
  const setField = useCallback((f, v) => setInfo((p) => ({ ...p, [f]: v })), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!info.teamName.trim() || !info.judgeName.trim()) {
      addToast('Team name and judge name are required', 'error');
      return;
    }
    if (!selectedScenarioId || !criteria) {
      addToast('Please select a scenario before submitting', 'error');
      return;
    }
    setSubmitting(true);
    const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...info,
          scenarioId: selectedScenarioId,
          scenario: selectedScenario?.name || selectedScenarioId,
          scores,
          criticalFails,
          notes,
          elapsedSeconds: Math.floor(elapsedMs / 1000),
          timeScore,
          totals: calcTotals(criteria, scores, criticalFails, timeScore),
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
      addToast('Scores submitted successfully!', 'success');
      setTimeout(() => {
        setSubmitted(false);
        setInfo(INITIAL_INFO);
        setSelectedScenarioId('');
        setCriteria(null);
        setScores({});
        setCriticalFails({});
        setNotes('');
        setTimerState('idle');
        setTimerStart(null);
        setElapsedMs(0);
        setTimeScore(TIME_ON_SCENE_MAX);
      }, 2500);
    } catch {
      addToast('Submission failed. Check server connection.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px', color: 'var(--success)' }}>
          Submitted!
        </h2>
        <p style={{ color: 'var(--gray-500)' }}>Score saved. Resetting form…</p>
      </div>
    );
  }

  const totals = criteria ? calcTotals(criteria, scores, criticalFails, timeScore) : { earned: 0, possible: 0, deductions: 0, net: 0, pct: 0 };
  const { earned, possible, deductions, net, pct } = totals;
  const grade = scoreGrade(pct);

  return (
    <form onSubmit={handleSubmit}>
      {/* Info Card */}
      <div className="card">
        <div className="card-header">
          <h2>📋 Session Info</h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="teamName">Team *</label>
              <select
                id="teamName"
                value={info.teamName}
                onChange={(e) => setField('teamName', e.target.value)}
                required
              >
                <option value="">— Select a team —</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {teams.length === 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                  No teams set up yet — ask admin to add teams.
                </span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="judgeName">Judge Name *</label>
              <input
                id="judgeName"
                type="text"
                placeholder="e.g. Judge Smith"
                value={info.judgeName}
                onChange={(e) => setField('judgeName', e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="judgeDept">Department</label>
              <input
                id="judgeDept"
                type="text"
                placeholder="e.g. Grapevine Fire"
                value={info.judgeDept}
                onChange={(e) => setField('judgeDept', e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="form-row single">
            <div className="form-group">
              <label htmlFor="scenario">Scenario *</label>
              <select
                id="scenario"
                value={selectedScenarioId}
                onChange={(e) => handleScenarioChange(e.target.value)}
                disabled={scenariosLoading}
                required
              >
                <option value="">
                  {scenariosLoading ? 'Loading scenarios…' : '— Select a scenario —'}
                </option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.finalsOnly ? ' — FINALS ONLY' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Timer Card */}
      {selectedScenarioId && (
        <div className="card">
          <div className="card-header">
            <h2>⏱️ Scenario Timer</h2>
            {timerState !== 'idle' && (
              <span className={`timer-elapsed ${timerState}`}>{formatElapsed(elapsedMs)}</span>
            )}
          </div>
          <div className="card-body">
            <div className="criterion-row" style={{ marginBottom: '10px' }}>
              <span className="criterion-label">Appropriate time on scene</span>
              <span className="criterion-max">/{TIME_ON_SCENE_MAX}</span>
              <ScoreStepper value={timeScore} max={TIME_ON_SCENE_MAX} onChange={setTimeScore} />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {timerState === 'idle' && (
                <button type="button" className="btn btn-timer-start" onClick={startTimer}>
                  ▶ Start Timer
                </button>
              )}
              {timerState === 'running' && (
                <button type="button" className="btn btn-timer-stop" onClick={stopTimer}>
                  ⏹ Stop Timer
                </button>
              )}
              {timerState === 'stopped' && (
                <button type="button" className="btn btn-timer-restart" onClick={startTimer}>
                  ↺ Restart Timer
                </button>
              )}
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>Timer is optional</span>
            </div>
          </div>
        </div>
      )}

      {/* Criteria loading spinner */}
      {criteriaLoading && (
        <div className="loading-wrap">
          <div className="spinner" />
          <span>Loading criteria…</span>
        </div>
      )}

      {/* Prompt to select scenario */}
      {!criteriaLoading && !criteria && (
        <div className="alert alert-info">
          Select a scenario above to load its scoring criteria.
        </div>
      )}

      {/* Scoring Sections */}
      {criteria && criteria.sections.map((section) => {
        const isCritical = section.criteria.every((c) => c.type === 'critical_fail');
        const sectionEarned = section.criteria.reduce((sum, c) => {
          if (c.type === 'critical_fail') return sum;
          return sum + (scores[c.id] || 0);
        }, 0);
        const sectionMax = section.criteria.reduce((sum, c) => {
          if (c.type === 'critical_fail') return sum;
          return sum + (c.maxPoints || 0);
        }, 0);

        return (
          <div className="card" key={section.id}>
            <div className="card-header">
              <h2>{isCritical ? '⚠️' : '📊'} {section.name}</h2>
              {!isCritical && sectionMax > 0 && (
                <span className="section-points">
                  {sectionEarned} / {sectionMax} pts
                </span>
              )}
            </div>
            <div className="card-body" style={{ padding: '0 16px' }}>
              {section.criteria.map((c) => {
                if (c.type === 'critical_fail') {
                  const applied = criticalFails[c.id] || false;
                  return (
                    <div className="critical-row" key={c.id}>
                      <div className="critical-check-wrap">
                        <input
                          type="checkbox"
                          id={`cf-${c.id}`}
                          checked={applied}
                          onChange={(e) => setCF(c.id, e.target.checked)}
                        />
                      </div>
                      <label className={`critical-label ${applied ? 'applied' : ''}`} htmlFor={`cf-${c.id}`}>
                        {c.label}
                      </label>
                      {applied && (
                        <span className="critical-penalty">−{c.penalty} pts</span>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="criterion-row" key={c.id}>
                    <span className="criterion-label">{c.label}</span>
                    <span className="criterion-max">/{c.maxPoints}</span>
                    <ScoreStepper
                      value={scores[c.id] || 0}
                      max={c.maxPoints}
                      onChange={(v) => setScore(c.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Notes */}
      {criteria && (
        <div className="card">
          <div className="card-header">
            <h2>📝 Notes</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <textarea
                placeholder="Optional: observations, feedback, notable actions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>
      )}

      {/* Deduction summary */}
      {deductions > 0 && (
        <div className="alert alert-error">
          ⚠️ Critical deductions applied: −{deductions} pts &nbsp;|&nbsp; Net score: {net} / {possible}
        </div>
      )}

      {/* Submit */}
      {criteria && (
        <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} style={{ marginBottom: '80px' }}>
          {submitting ? 'Submitting…' : `Submit Score (${net} / ${possible})`}
        </button>
      )}

      {/* Sticky score bar */}
      {criteria && (
        <div className="score-summary">
          <div className="score-total-display">
            <span className="label">Score</span>
            <span className={`value score-${grade}`}>{net}<span style={{ fontSize: '1rem', fontWeight: 500 }}>/{possible}</span></span>
          </div>
          <div className="score-bar-wrap">
            <div className="score-bar-bg">
              <div className={`score-bar-fill score-${grade}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="score-pct">{pct.toFixed(1)}%</div>
          </div>
        </div>
      )}
    </form>
  );
}
