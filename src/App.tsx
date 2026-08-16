import { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Quota,
  Session,
  Unit,
  loadState,
  saveState,
  today,
} from './lib/store';
import UnitsScreen from './screens/UnitsScreen';
import TodayScreen from './screens/TodayScreen';
import RunScreen from './screens/RunScreen';
import WeeklyScreen from './screens/WeeklyScreen';

type Tab = 'today' | 'units' | 'weekly';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: '오늘' },
  { id: 'units', label: '설정' },
  { id: 'weekly', label: '주간' },
];

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<Tab>('today');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const todayKey = today();
  const session = useMemo(
    () => state.sessions.find((s) => s.date === todayKey),
    [state.sessions, todayKey],
  );

  function upsertSession(next: Session) {
    setState((prev) => {
      const exists = prev.sessions.some((s) => s.date === next.date);
      return {
        ...prev,
        sessions: exists
          ? prev.sessions.map((s) => (s.date === next.date ? next : s))
          : [...prev.sessions, next],
      };
    });
  }

  function saveUnit(unit: Unit, quota: Quota) {
    setState((prev) => {
      const exists = prev.units.some((u) => u.id === unit.id);
      const hasQuota = quota.daily != null || quota.weekly != null || quota.monthly != null;
      const quotas = prev.quotas.filter((q) => q.unitId !== unit.id);
      if (hasQuota) quotas.push(quota);
      return {
        ...prev,
        units: exists ? prev.units.map((u) => (u.id === unit.id ? unit : u)) : [...prev.units, unit],
        quotas,
      };
    });
  }

  function setArchived(unitId: string, archived: boolean) {
    setState((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === unitId ? { ...u, archived } : u)),
    }));
  }

  if (running && session) {
    return (
      <RunScreen
        session={session}
        units={state.units}
        onUpdate={upsertSession}
        onExit={() => setRunning(false)}
      />
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="flex items-baseline justify-between px-5 pb-2 pt-6">
        <h1 className="text-lg font-semibold tracking-tight">Study Shuffler</h1>
        <span className="tabular text-xs text-neutral-500">{todayKey}</span>
      </header>

      <nav className="flex gap-1 px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab === t.id
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-200/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'today' && (
          <TodayScreen
            state={state}
            session={session}
            todayKey={todayKey}
            onCreate={(s) => {
              upsertSession(s);
              setRunning(true);
            }}
            onResume={() => setRunning(true)}
          />
        )}
        {tab === 'units' && (
          <UnitsScreen
            units={state.units}
            quotas={state.quotas}
            seedNotice={state.seedNotice}
            onDismissNotice={() => setState((prev) => ({ ...prev, seedNotice: false }))}
            onSave={saveUnit}
            onArchive={(id) => setArchived(id, true)}
            onRestore={(id) => setArchived(id, false)}
          />
        )}
        {tab === 'weekly' && (
          <WeeklyScreen
            sessions={state.sessions}
            units={state.units}
            quotas={state.quotas}
            todayKey={todayKey}
          />
        )}
      </main>
    </div>
  );
}
