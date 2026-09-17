import { useCallback, useEffect, useState } from 'react';
import { messages } from '../features/i18n/messages';
import { MapWorkspace } from '../features/map/MapWorkspace.tsx';
import { mapMessages } from '../features/map/messages.ts';
import { ui } from '../features/fleet/messages.ts';
import { Dialog } from '../features/fleet/Dialog.tsx';
import { readPreferences, PREFERENCES_KEY, type Preferences } from '../features/storage/preferences.ts';
import { storageMessages } from '../features/storage/messages.ts';

export default function Home() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [preferencesError, setPreferencesError] = useState(false);
  const language = preferences.language;
  const updatePreferences = useCallback((patch: Partial<Preferences>) => setPreferences((current) => {
    const next = { ...current, ...patch }; return JSON.stringify(next) === JSON.stringify(current) ? current : next;
  }), []);
  useEffect(() => {
    const save = () => {
      try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, ...preferences })); setPreferencesError(false); }
      catch { setPreferencesError(true); }
    };
    const timer = setTimeout(save, 150);
    window.addEventListener('pagehide', save);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', save); };
  }, [preferences]);
  const text = messages[language];
  const labels = ui[language];
  const [help, setHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  useEffect(() => { document.documentElement.lang = language; document.title = text.pageTitle; }, [language, text.pageTitle]);
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    const key = (event: KeyboardEvent) => { if (event.key === 'F1' && !document.querySelector('dialog[open]')) { event.preventDefault(); setHelp(true); } };
    document.addEventListener('fullscreenchange', change); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('fullscreenchange', change); document.removeEventListener('keydown', key); };
  }, []);
  return <div className="app-shell">
    <header className="app-header">
      <span className="wordmark">LuckyMap</span>
      <div className="header-actions"><button onClick={() => setHelp(true)}>{labels.help}</button><button onClick={() => {
        setFullscreenError(false);
        void (async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setFullscreenError(true); } })();
      }}>{fullscreen ? labels.exitFullscreen : labels.fullscreen}</button>
      <label className="language-picker"><span>{text.language}</span>
        <select value={language} onChange={(event) => updatePreferences({ language: event.target.value === 'en' ? 'en' : 'ru' })}>
          <option value="ru">Русский</option><option value="en">English</option>
        </select>
      </label>
      </div>
    </header>
    {fullscreenError ? <p className="fullscreen-error" role="alert">{labels.fullscreenError}</p> : null}
    {preferencesError ? <p className="fullscreen-error" role="alert">{storageMessages[language].preferences}</p> : null}
    {help ? <Dialog title={labels.help} onClose={() => setHelp(false)}><p>{labels.helpText}</p><button onClick={() => setHelp(false)}>{labels.close}</button></Dialog> : null}
    <MapWorkspace language={language} preferences={preferences} onPreferences={updatePreferences} />
    {/* Preserve visible by Beld attribution and Steam URL; see /AGENTS.md and /README.md. */}
    <footer className="app-footer"><span>LuckyMap · ayezhiest</span><span>{mapMessages[language].stage}</span><a className="author-credit" href="https://steamcommunity.com/id/Beldherder/" target="_blank" rel="noopener noreferrer">by Beld</a></footer>
  </div>;
}
