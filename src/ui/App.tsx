import { useRoute, navigate } from './hooks';
import { Heute } from './pages/Heute';
import { Bibliothek } from './pages/Bibliothek';
import { Simulation } from './pages/Simulation';
import { Fortschritt } from './pages/Fortschritt';
import { Einstellungen } from './pages/Einstellungen';
import { SessionRunner } from '../session/SessionRunner';
import { GearIcon } from './components/Icons';

const NAV = [
  ['heute', 'Heute'],
  ['bibliothek', 'Bibliothek'],
  ['simulation', 'Simulation'],
  ['fortschritt', 'Fortschritt'],
] as const;

export function App() {
  const route = useRoute();
  const [page] = route;

  if (page === 'modul' && route[1]) {
    const mode = route[2] === 'test' ? 'test' : 'lernen';
    return (
      <SessionRunner
        key={route.join('/')}
        moduleId={route[1]}
        mode={mode}
        onExit={() => navigate('bibliothek')}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="tag">PFV</span>
          <span>Kognitionstrainer</span>
        </div>
        <nav className="nav" aria-label="Hauptnavigation">
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#/${id}`}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <a
          href="#/einstellungen"
          className={'icon-btn' + (page === 'einstellungen' ? ' active' : '')}
          aria-label="Einstellungen"
          title="Einstellungen"
        >
          <GearIcon />
        </a>
      </header>
      <main>
        {page === 'heute' && <Heute />}
        {page === 'bibliothek' && <Bibliothek />}
        {page === 'simulation' && <Simulation />}
        {page === 'fortschritt' && <Fortschritt />}
        {page === 'einstellungen' && <Einstellungen />}
        {!['heute', 'bibliothek', 'simulation', 'fortschritt', 'einstellungen'].includes(page) && (
          <div className="page">
            <p>Seite nicht gefunden.</p>
            <a href="#/heute">Zur Startseite</a>
          </div>
        )}
      </main>
    </div>
  );
}
