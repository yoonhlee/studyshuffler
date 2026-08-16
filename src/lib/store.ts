/**
 * Data model + localStorage persistence + quota arithmetic.
 * No server, no accounts: everything lives in one localStorage key.
 */

export type Mode = 'listening' | 'reading' | 'grammar' | 'memorize' | 'analysis';

export const MODES: Mode[] = ['listening', 'reading', 'grammar', 'memorize', 'analysis'];

export const MODE_LABEL: Record<Mode, string> = {
  listening: '듣기',
  reading: '독해',
  grammar: '문법',
  memorize: '암기',
  analysis: '분석',
};

export interface Unit {
  id: string;
  name: string;
  category: string;
  mode: Mode;
  minutes: number;
  archived: boolean;
}

export interface Quota {
  unitId: string;
  daily?: number;
  weekly?: number;
  monthly?: number;
}

export interface Block {
  id: string;
  unitId: string;
  minutes: number;
  status: 'pending' | 'done' | 'skipped';
  actualSeconds?: number;
  accuracy?: number;
  focus?: 1 | 2 | 3 | 4 | 5;
  startedAt?: string;
  finishedAt?: string;
}

export interface Session {
  date: string; // 'YYYY-MM-DD'
  blocks: Block[];
  currentIndex: number;
  /** Set when the shuffler could not satisfy the adjacency constraints. */
  relaxed?: boolean;
}

export interface AppState {
  units: Unit[];
  quotas: Quota[];
  sessions: Session[];
  /** Seed data is still on screen and the "이건 예시입니다" notice has not been dismissed. */
  seedNotice: boolean;
}

const STORAGE_KEY = 'studyshuffler.v1';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function today(): string {
  return toDateKey(new Date());
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Four examples so the first run is not an empty screen. */
function seedState(): AppState {
  const units: Unit[] = [
    { id: 'seed-1', name: 'Part 5 문법 20문항', category: 'TOEIC', mode: 'grammar', minutes: 15, archived: false },
    { id: 'seed-2', name: 'Part 3 리스닝 1세트', category: 'TOEIC', mode: 'listening', minutes: 20, archived: false },
    { id: 'seed-3', name: 'NCS 의사소통 10문항', category: 'NCS', mode: 'reading', minutes: 18, archived: false },
    { id: 'seed-4', name: '논문 1편 정독', category: '연구', mode: 'analysis', minutes: 40, archived: false },
  ];
  const quotas: Quota[] = [
    { unitId: 'seed-1', daily: 2 },
    { unitId: 'seed-2', daily: 1 },
    { unitId: 'seed-3', weekly: 7 },
    { unitId: 'seed-4', monthly: 30 },
  ];
  return { units, quotas, sessions: [], seedNotice: true };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      units: parsed.units ?? [],
      quotas: parsed.quotas ?? [],
      sessions: parsed.sessions ?? [],
      seedNotice: parsed.seedNotice ?? false,
    };
  } catch {
    return seedState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked — nothing useful to do in an offline-only app.
  }
}

export function quotaOf(quotas: Quota[], unitId: string): Quota | undefined {
  return quotas.find((q) => q.unitId === unitId);
}

/**
 * Spec §4 — first rule that applies wins.
 * Returns null when the unit has no quota at all (excluded from today's session).
 */
export function dailyQuota(quota: Quota | undefined): number | null {
  if (!quota) return null;
  if (quota.daily != null) return quota.daily;
  if (quota.weekly != null) return Math.round(quota.weekly / 7);
  if (quota.monthly != null) return Math.round(quota.monthly / 30);
  return null;
}

/** Same priority order, projected onto a week — used by the weekly screen. */
export function weeklyTarget(quota: Quota | undefined): number {
  if (!quota) return 0;
  if (quota.daily != null) return quota.daily * 7;
  if (quota.weekly != null) return quota.weekly;
  if (quota.monthly != null) return Math.round((quota.monthly * 7) / 30);
  return 0;
}

export function unitById(units: Unit[], id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}
