import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { registerKronoxServiceWorker } from '@/lib/notificationApi'

function scheduleKronoxServiceWorkerRegistration() {
  const register = () => registerKronoxServiceWorker();
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(register, { timeout: 2500 });
    return;
  }
  window.setTimeout(register, 1200);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// Remove the pre-React branded splash once React has painted
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('pre-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 380);
    }
    scheduleKronoxServiceWorkerRegistration();
  });
});
