import { useState } from 'react';

let idCounter = Date.now();
const uid = () => `c_${++idCounter}`;

export default function CriteriaEditor({ criteria, adminPassword, onSave, addToast }) {
  const [sections, setSections] = useState(() => JSON.parse(JSON.stringify(criteria.sections)));
  const [saving, setSaving] = useState(false);

  const updateSection = (sIdx, field, value) =>
    setSections((prev) => prev.map((s, i) => (i === sIdx ? { ...s, [field]: value } : s)));

  const removeSection = (sIdx) =>
    setSections((prev) => prev.filter((_, i) => i !== sIdx));

  const addSection = () =>
    setSections((prev) => [
      ...prev,
      { id: uid(), name: 'New Section', criteria: [{ id: uid(), label: 'New criterion', type: 'points', maxPoints: 5 }] },
    ]);

  const moveSectionUp = (sIdx) => {
    if (sIdx === 0) return;
    setSections((prev) => {
      const arr = [...prev];
      [arr[sIdx - 1], arr[sIdx]] = [arr[sIdx], arr[sIdx - 1]];
      return arr;
    });
  };

  const moveSectionDown = (sIdx) => {
    setSections((prev) => {
      if (sIdx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[sIdx], arr[sIdx + 1]] = [arr[sIdx + 1], arr[sIdx]];
      return arr;
    });
  };

  const updateCriterion = (sIdx, cIdx, field, value) =>
    setSections((prev) =>
      prev.map((s, i) =>
        i !== sIdx
          ? s
          : {
              ...s,
              criteria: s.criteria.map((c, j) =>
                j !== cIdx ? c : { ...c, [field]: field === 'maxPoints' || field === 'penalty' ? Number(value) : value }
              ),
            }
      )
    );

  const removeCriterion = (sIdx, cIdx) =>
    setSections((prev) =>
      prev.map((s, i) =>
        i !== sIdx ? s : { ...s, criteria: s.criteria.filter((_, j) => j !== cIdx) }
      )
    );

  const addCriterion = (sIdx) =>
    setSections((prev) =>
      prev.map((s, i) =>
        i !== sIdx
          ? s
          : { ...s, criteria: [...s.criteria, { id: uid(), label: 'New criterion', type: 'points', maxPoints: 5 }] }
      )
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/criteria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify({ sections }),
      });
      if (!res.ok) throw new Error();
      onSave({ sections });
    } catch {
      addToast('Failed to save criteria', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="alert alert-info" style={{ marginBottom: '12px' }}>
        Changes take effect immediately for new judge sessions. Existing submissions are not affected.
      </div>

      {sections.map((section, sIdx) => (
        <div className="criteria-section-card" key={section.id}>
          <div className="criteria-section-header">
            <input
              className="criteria-section-name-input"
              value={section.name}
              onChange={(e) => updateSection(sIdx, 'name', e.target.value)}
              placeholder="Section name"
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => moveSectionUp(sIdx)}
              disabled={sIdx === 0}
              title="Move up"
            >↑</button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => moveSectionDown(sIdx)}
              disabled={sIdx === sections.length - 1}
              title="Move down"
            >↓</button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => { if (confirm(`Remove section "${section.name}"?`)) removeSection(sIdx); }}
              title="Remove section"
            >✕</button>
          </div>

          <div className="criteria-list">
            {section.criteria.map((c, cIdx) => (
              <div className="criteria-item" key={c.id}>
                <input
                  className="criteria-item-label"
                  value={c.label}
                  onChange={(e) => updateCriterion(sIdx, cIdx, 'label', e.target.value)}
                  placeholder="Criterion label"
                />
                <select
                  className="criteria-item-type"
                  value={c.type}
                  onChange={(e) => updateCriterion(sIdx, cIdx, 'type', e.target.value)}
                >
                  <option value="points">Points</option>
                  <option value="critical_fail">Crit Fail</option>
                </select>
                {c.type === 'points' && (
                  <input
                    className="criteria-item-points"
                    type="number"
                    min={0}
                    max={999}
                    value={c.maxPoints ?? 5}
                    onChange={(e) => updateCriterion(sIdx, cIdx, 'maxPoints', e.target.value)}
                    title="Max points"
                  />
                )}
                {c.type === 'critical_fail' && (
                  <input
                    className="criteria-item-points"
                    type="number"
                    min={0}
                    max={999}
                    value={c.penalty ?? 10}
                    onChange={(e) => updateCriterion(sIdx, cIdx, 'penalty', e.target.value)}
                    title="Penalty points"
                    placeholder="Penalty"
                  />
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeCriterion(sIdx, cIdx)}
                  title="Remove"
                  style={{ padding: '6px 9px', flexShrink: 0 }}
                >✕</button>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-ghost btn-sm add-criterion-btn"
              onClick={() => addCriterion(sIdx)}
            >
              + Add Criterion
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-ghost btn-lg" onClick={addSection} style={{ marginBottom: '12px' }}>
        + Add Section
      </button>

      <button
        type="button"
        className="btn btn-success btn-lg"
        onClick={handleSave}
        disabled={saving}
        style={{ marginBottom: '24px' }}
      >
        {saving ? 'Saving…' : '💾 Save Criteria'}
      </button>
    </>
  );
}
