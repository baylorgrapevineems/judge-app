import { useState, useCallback } from 'react';
import JudgeForm from './components/JudgeForm';
import AdminPanel from './components/AdminPanel';
import DisplayBoard from './components/DisplayBoard';
import Toast from './components/Toast';

export default function App() {
  const [view, setView] = useState('judge');
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'default') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  if (view === 'display') {
    return (
      <>
        <DisplayBoard />
        <button
          className="db-exit-btn"
          onClick={() => setView('judge')}
          title="Exit display mode"
        >
          ✕
        </button>
      </>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚑 EMS Judge</h1>
        <nav className="header-nav">
          <button
            className={`nav-btn ${view === 'judge' ? 'active' : ''}`}
            onClick={() => setView('judge')}
          >
            Judge
          </button>
          <button
            className={`nav-btn ${view === 'display' ? 'active' : ''}`}
            onClick={() => setView('display')}
          >
            📺 Display
          </button>
          <button
            className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
            onClick={() => setView('admin')}
          >
            Admin
          </button>
        </nav>
      </header>

      <main className="main-content">
        {view === 'judge' && <JudgeForm addToast={addToast} />}
        {view === 'admin' && <AdminPanel addToast={addToast} />}
      </main>

      <Toast toasts={toasts} />
    </div>
  );
}
