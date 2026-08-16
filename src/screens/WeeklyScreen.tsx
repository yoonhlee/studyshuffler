import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Quota, Session, Unit, toDateKey } from '../lib/store';
import { last7Days, startOfWeek, weeklyStats } from '../lib/session';

interface Props {
  sessions: Session[];
  units: Unit[];
  quotas: Quota[];
  todayKey: string;
}

const SERIES = '#2a78d6';
const DEFICIT = '#e4e4e1';

export default function WeeklyScreen({ sessions, units, quotas, todayKey }: Props) {
  const weekStartKey = useMemo(
    () => toDateKey(startOfWeek(new Date(`${todayKey}T00:00:00`))),
    [todayKey],
  );

  const stats = useMemo(
    () => weeklyStats(sessions, units, quotas, weekStartKey),
    [sessions, units, quotas, weekStartKey],
  );

  const days = useMemo(() => last7Days(sessions, todayKey), [sessions, todayKey]);
  const skips = stats.filter((s) => s.skipped > 0).sort((a, b) => b.skipped - a.skipped);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 text-sm font-semibold">이번 주 소화 / 목표</h2>
        <p className="mb-3 text-xs text-neutral-500">{weekStartKey} 시작 (월요일 기준)</p>
        {stats.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500">
            아직 집계할 기록이 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {stats.map(({ unit, done, target }) => {
              const denom = Math.max(target, done, 1);
              const pct = Math.round((done / denom) * 100);
              return (
                <li key={unit.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="truncate pr-3">
                      {unit.name}
                      <span className="ml-2 text-xs text-neutral-400">{unit.category}</span>
                    </span>
                    <span className="tabular shrink-0 text-neutral-600">
                      {done} / {target || '—'}
                    </span>
                  </div>
                  {/* Unfilled remainder stays gray so the shortfall is visible. */}
                  <div
                    className="h-2.5 w-full overflow-hidden rounded"
                    style={{ backgroundColor: DEFICIT }}
                    role="img"
                    aria-label={`${unit.name} 목표 ${target}개 중 ${done}개 완료`}
                  >
                    <div
                      className="h-full rounded"
                      style={{ width: `${pct}%`, backgroundColor: SERIES }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">이번 주 스킵</h2>
        {skips.length === 0 ? (
          <p className="text-sm text-neutral-500">스킵 없음.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {skips.map(({ unit, skipped }) => (
              <li key={unit.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="truncate pr-3">{unit.name}</span>
                <span className="tabular shrink-0 font-semibold" style={{ color: '#e34948' }}>
                  {skipped}회
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">최근 7일 학습 시간 (분)</h2>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke="#ececea" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: '#52514e' }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 12, fill: '#52514e' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                formatter={(value: number) => [`${value}분`, '학습']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e1' }}
              />
              <Bar dataKey="minutes" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
