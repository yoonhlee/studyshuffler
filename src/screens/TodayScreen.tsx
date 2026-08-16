import { useMemo, useState } from 'react';
import { AppState, Session, unitById } from '../lib/store';
import {
  createSession,
  isSessionFinished,
  planForToday,
  previousSession,
  summarize,
} from '../lib/session';

interface Props {
  state: AppState;
  session: Session | undefined;
  todayKey: string;
  onCreate: (session: Session) => void;
  onResume: () => void;
}

export default function TodayScreen({ state, session, todayKey, onCreate, onResume }: Props) {
  const { units, quotas, sessions } = state;
  const [counts, setCounts] = useState<Record<string, number>>({});

  const plan = useMemo(() => planForToday(units, quotas), [units, quotas]);

  const carriedOver = useMemo(() => {
    const prev = previousSession(sessions, todayKey);
    return prev ? prev.blocks.filter((b) => b.status === 'skipped') : [];
  }, [sessions, todayKey]);

  const rows = plan.map((item) => ({
    ...item,
    count: counts[item.unitId] ?? item.count,
    unit: unitById(units, item.unitId)!,
  }));

  const plannedBlocks = rows.reduce((n, r) => n + r.count, 0);
  const totalMinutes =
    rows.reduce((m, r) => m + r.count * r.unit.minutes, 0) +
    carriedOver.reduce((m, b) => m + (unitById(units, b.unitId)?.minutes ?? b.minutes), 0);
  const totalBlocks = plannedBlocks + carriedOver.length;

  if (session) {
    const summary = summarize(session);
    const done = isSessionFinished(session);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-400">오늘 세션</p>
          <p className="mt-1 text-lg font-semibold">
            {done ? '오늘 세션 완료' : '진행 중'}
            <span className="tabular ml-2 text-sm font-normal text-neutral-500">
              {Math.min(session.currentIndex, session.blocks.length)} / {session.blocks.length} 블록
            </span>
          </p>
          <p className="mt-3 text-sm text-neutral-600">
            완료 {summary.done} · 스킵 {summary.skipped} · 학습 {Math.round(summary.totalSeconds / 60)}분
            {summary.avgFocus != null && ` · 평균 집중도 ${summary.avgFocus.toFixed(1)}`}
          </p>
          {!done && (
            <button
              onClick={onResume}
              className="mt-4 w-full rounded-md bg-neutral-900 py-3 text-sm font-medium text-white hover:bg-neutral-800"
            >
              이어서 진행
            </button>
          )}
        </div>
        <p className="px-1 text-xs text-neutral-500">
          오늘 할당량은 세션 생성 시점에 잠깁니다. 개수 조정은 내일 세션 생성 전에 가능합니다.
        </p>
      </div>
    );
  }

  if (plan.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-500">
        할당량이 지정된 유닛이 없습니다.
        <br />
        설정 탭에서 유닛에 일간 할당량을 넣어주세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {carriedOver.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          지난 세션에서 스킵한 {carriedOver.length}개가 오늘 세션 맨 앞에 이월됩니다.
        </div>
      )}

      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {rows.map((row) => (
          <li key={row.unitId} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.unit.name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {row.unit.category} · {row.unit.minutes}분/유닛
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setCounts((c) => ({ ...c, [row.unitId]: Math.max(0, row.count - 1) }))
                }
                className="h-8 w-8 rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                aria-label={`${row.unit.name} 개수 줄이기`}
              >
                −
              </button>
              <span className="tabular w-8 text-center text-sm font-medium">{row.count}</span>
              <button
                onClick={() => setCounts((c) => ({ ...c, [row.unitId]: row.count + 1 }))}
                className="h-8 w-8 rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                aria-label={`${row.unit.name} 개수 늘리기`}
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between px-1 text-sm text-neutral-600">
        <span>
          총 {totalBlocks}블록
          {carriedOver.length > 0 && ` (이월 ${carriedOver.length} 포함)`}
        </span>
        <span className="tabular">예상 {totalMinutes}분</span>
      </div>

      <button
        disabled={totalBlocks === 0}
        onClick={() =>
          onCreate(
            createSession(
              todayKey,
              rows.map((r) => ({ unitId: r.unitId, count: r.count })),
              units,
              sessions,
            ),
          )
        }
        className="w-full rounded-lg bg-neutral-900 py-4 text-base font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        세션 시작
      </button>

      <p className="px-1 text-xs text-neutral-500">
        개수는 지금만 조정할 수 있습니다. 시작하면 순서와 개수가 잠깁니다.
      </p>
    </div>
  );
}
