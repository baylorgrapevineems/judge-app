import { useState, useCallback } from 'react';
import JudgeForm from './components/JudgeForm';
import AdminPanel from './components/AdminPanel';
import Toast from './components/Toast';

export default function App() {
  const [view, setView] = useState('judge');
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'default') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

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
