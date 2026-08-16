/**
 * Session construction (shuffle / jitter / carry-over) and the aggregates
 * the summary + weekly screens read.
 */

import {
  Block,
  Mode,
  Session,
  Unit,
  Quota,
  dailyQuota,
  quotaOf,
  uid,
  unitById,
  weeklyTarget,
} from './store';

export interface PlanItem {
  unitId: string;
  count: number;
}

const MAX_ATTEMPTS = 50;
const JITTER_MINUTES = 2;
const MIN_MINUTES = 3;

function shuffle<T>(input: T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface Draft {
  unitId: string;
  mode: Mode;
  minutes: number;
}

/** Adjacent blocks may share neither mode nor unit. */
function satisfiesConstraints(drafts: Draft[]): boolean {
  for (let i = 1; i < drafts.length; i++) {
    if (drafts[i].mode === drafts[i - 1].mode) return false;
    if (drafts[i].unitId === drafts[i - 1].unitId) return false;
  }
  return true;
}

/** ±2분, 3분 하한. Slightly unpredictable lengths help keep attention up. */
function jitter(minutes: number): number {
  const delta = Math.floor(Math.random() * (JITTER_MINUTES * 2 + 1)) - JITTER_MINUTES;
  return Math.max(MIN_MINUTES, minutes + delta);
}

function toBlock(draft: Draft): Block {
  return {
    id: uid(),
    unitId: draft.unitId,
    minutes: jitter(draft.minutes),
    status: 'pending',
  };
}

/** Today's plan, pre-filled from the quotas. Units without any quota are excluded. */
export function planForToday(units: Unit[], quotas: Quota[]): PlanItem[] {
  return units
    .filter((u) => !u.archived)
    .map((u) => ({ unitId: u.id, count: dailyQuota(quotaOf(quotas, u.id)) }))
    .filter((p): p is PlanItem => p.count !== null);
}

/** The most recent session before `date` — the only one that can leave carry-over. */
export function previousSession(sessions: Session[], date: string): Session | undefined {
  return sessions
    .filter((s) => s.date < date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop();
}

export function carryOverBlocks(sessions: Session[], date: string, units: Unit[]): Block[] {
  const prev = previousSession(sessions, date);
  if (!prev) return [];
  return prev.blocks
    .filter((b) => b.status === 'skipped')
    .map((b) => {
      const unit = unitById(units, b.unitId);
      return {
        id: uid(),
        unitId: b.unitId,
        minutes: jitter(unit ? unit.minutes : b.minutes),
        status: 'pending' as const,
      };
    });
}

export interface BuildResult {
  blocks: Block[];
  /** True when 50 attempts could not satisfy the constraints and we shipped the last shuffle anyway. */
  relaxed: boolean;
}

export function buildSessionBlocks(plan: PlanItem[], units: Unit[], carryOver: Block[]): BuildResult {
  const drafts: Draft[] = [];
  for (const item of plan) {
    const unit = unitById(units, item.unitId);
    if (!unit || unit.archived) continue;
    for (let i = 0; i < item.count; i++) {
      drafts.push({ unitId: unit.id, mode: unit.mode, minutes: unit.minutes });
    }
  }

  let ordered = drafts;
  let relaxed = false;
  if (drafts.length > 1) {
    relaxed = true;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      ordered = shuffle(drafts);
      if (satisfiesConstraints(ordered)) {
        relaxed = false;
        break;
      }
    }
  } else {
    ordered = shuffle(drafts);
  }

  // Carry-over is pinned to the front and exempt from the adjacency checks.
  return { blocks: [...carryOver, ...ordered.map(toBlock)], relaxed };
}

export function createSession(
  date: string,
  plan: PlanItem[],
  units: Unit[],
  sessions: Session[],
): Session {
  const carryOver = carryOverBlocks(sessions, date, units);
  const { blocks, relaxed } = buildSessionBlocks(plan, units, carryOver);
  return { date, blocks, currentIndex: 0, relaxed };
}

export interface SessionSummary {
  totalSeconds: number;
  done: number;
  skipped: number;
  avgFocus: number | null;
}

export function summarize(session: Session): SessionSummary {
  const done = session.blocks.filter((b) => b.status === 'done');
  const skipped = session.blocks.filter((b) => b.status === 'skipped');
  const focuses = done.map((b) => b.focus).filter((f): f is 1 | 2 | 3 | 4 | 5 => f != null);
  return {
    totalSeconds: done.reduce((sum, b) => sum + (b.actualSeconds ?? 0), 0),
    done: done.length,
    skipped: skipped.length,
    avgFocus: focuses.length ? focuses.reduce((a, b) => a + b, 0) / focuses.length : null,
  };
}

export function isSessionFinished(session: Session): boolean {
  return session.currentIndex >= session.blocks.length;
}

/* ---------- weekly aggregates ---------- */

/** Monday-start week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return d;
}

export interface UnitWeekStat {
  unit: Unit;
  done: number;
  target: number;
  skipped: number;
}

export function weeklyStats(
  sessions: Session[],
  units: Unit[],
  quotas: Quota[],
  weekStartKey: string,
): UnitWeekStat[] {
  const inWeek = sessions.filter((s) => s.date >= weekStartKey);
  const done = new Map<string, number>();
  const skipped = new Map<string, number>();
  for (const s of inWeek) {
    for (const b of s.blocks) {
      const bucket = b.status === 'done' ? done : b.status === 'skipped' ? skipped : null;
      if (!bucket) continue;
      bucket.set(b.unitId, (bucket.get(b.unitId) ?? 0) + 1);
    }
  }

  return units
    .filter((u) => !u.archived || done.has(u.id) || skipped.has(u.id))
    .map((unit) => ({
      unit,
      done: done.get(unit.id) ?? 0,
      target: weeklyTarget(quotaOf(quotas, unit.id)),
      skipped: skipped.get(unit.id) ?? 0,
    }))
    .filter((row) => row.target > 0 || row.done > 0 || row.skipped > 0);
}

export interface DayTotal {
  date: string;
  label: string;
  minutes: number;
}

/** Last 7 days including today, oldest first. */
export function last7Days(sessions: Session[], todayKey: string): DayTotal[] {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    const seconds = s.blocks
      .filter((b) => b.status === 'done')
      .reduce((sum, b) => sum + (b.actualSeconds ?? 0), 0);
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + seconds);
  }

  const base = new Date(`${todayKey}T00:00:00`);
  const out: DayTotal[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    out.push({
      date: key,
      label: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()],
      minutes: Math.round((byDate.get(key) ?? 0) / 60),
    });
  }
  return out;
}
