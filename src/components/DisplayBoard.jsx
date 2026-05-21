import { useState, useEffect } from 'react';

const POLL_MS = 6000;
const MEDALS = ['🥇', '🥈', '🥉'];

function SecondsAgo({ since }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [since]);
  return <span className="db-updated">Updated {secs}s ago</span>;
}

const EMPTY_INFO = { currentlyIn: '', comingUpNext: '', announcement: '' };

export default function DisplayBoard() {
  const [teams, setTeams] = useState([]);
  const [displayInfo, setDisplayInfo] = useState(EMPTY_INFO);
  const [lastFetch, setLastFetch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(false);

  const fetchData = () => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => {
        setTeams(data.teams || []);
        setDisplayInfo(data.displayInfo || EMPTY_INFO);
        setLastFetch(Date.now());
        setLoading(false);
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="db-root">
      {/* Header */}
      <div className="db-header">
        <div className="db-title-block">
          <span className="db-ambulance">🚑</span>
          <div>
            <div className="db-title">EMS Sim War</div>
            <div className="db-subtitle">Live Standings</div>
          </div>
        </div>
        <div className="db-status">
          <span className={`db-live-dot ${flash ? 'db-live-flash' : ''}`} />
          <span className="db-live-label">LIVE</span>
          {lastFetch && <SecondsAgo since={lastFetch} />}
        </div>
      </div>

      {/* Body */}
      <div className="db-body">
        {loading && (
          <div className="db-center-msg">Loading standings…</div>
        )}

        {!loading && teams.length === 0 && (
          <div className="db-center-msg">
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏁</div>
            No scores submitted yet — standings will appear here automatically.
          </div>
        )}

        {!loading && teams.length > 0 && (
          <div className="db-teams">
            {teams.map((team, idx) => {
              const advances = idx < 3;
              const pct = team.totalPossible > 0
                ? (team.totalNet / team.totalPossible) * 100
                : 0;
              return (
                <div
                  key={team.teamName}
                  className={`db-card ${advances ? 'db-card-advances' : ''}`}
                >
                  <div className="db-card-main">
                    <span className="db-rank">{MEDALS[idx] ?? `#${idx + 1}`}</span>
                    <span className="db-name">{team.teamName}</span>
                    {advances && (
                      <span className="db-advances-badge">ADVANCES TO FINALS</span>
                    )}
                    <div className="db-score">
                      <span className="db-score-net">{team.totalNet}</span>
                      <span className="db-score-denom">/{team.totalPossible}</span>
                      <span className="db-score-pct">{pct.toFixed(1)}%</span>
                    </div>
                  </div>

                  {team.submissions.length > 0 && (
                    <div className="db-scenarios">
                      <div className="db-scenario-row">
                        <span className="db-scenario-name" style={{ color: 'var(--db-muted)' }}>
                          {team.submissions.length} {team.submissions.length === 1 ? 'submission' : 'submissions'} scored
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom info bars */}
      {(displayInfo.currentlyIn || displayInfo.comingUpNext || displayInfo.announcement) && (
        <div className="db-info-bars">
          {displayInfo.currentlyIn && (
            <div className="db-info-bar db-currently-in">
              <span className="db-info-label">🎯 Currently In</span>
              <span className="db-info-text">{displayInfo.currentlyIn}</span>
            </div>
          )}
          {displayInfo.comingUpNext && (
            <div className="db-info-bar db-coming-up-next">
              <span className="db-info-label">⏭ Coming Up Next</span>
              <span className="db-info-text">{displayInfo.comingUpNext}</span>
            </div>
          )}
          {displayInfo.announcement && (
            <div className="db-info-bar db-announcement">
              <span className="db-info-label">📢 Announcement</span>
              <span className="db-info-text">{displayInfo.announcement}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
