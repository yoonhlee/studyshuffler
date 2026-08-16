import { useMemo, useState } from 'react';
import {
  MODES,
  MODE_LABEL,
  Mode,
  Quota,
  Unit,
  dailyQuota,
  quotaOf,
  uid,
} from '../lib/store';

interface Props {
  units: Unit[];
  quotas: Quota[];
  seedNotice: boolean;
  onDismissNotice: () => void;
  onSave: (unit: Unit, quota: Quota) => void;
  onArchive: (unitId: string) => void;
  onRestore: (unitId: string) => void;
}

interface Draft {
  id: string;
  name: string;
  category: string;
  mode: Mode;
  minutes: string;
  daily: string;
  weekly: string;
  monthly: string;
}

function emptyDraft(): Draft {
  return {
    id: uid(),
    name: '',
    category: '',
    mode: 'reading',
    minutes: '20',
    daily: '1',
    weekly: '',
    monthly: '',
  };
}

function draftFrom(unit: Unit, quota: Quota | undefined): Draft {
  return {
    id: unit.id,
    name: unit.name,
    category: unit.category,
    mode: unit.mode,
    minutes: String(unit.minutes),
    daily: quota?.daily != null ? String(quota.daily) : '',
    weekly: quota?.weekly != null ? String(quota.weekly) : '',
    monthly: quota?.monthly != null ? String(quota.monthly) : '',
  };
}

function num(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

function quotaLabel(quota: Quota | undefined): string {
  if (!quota) return '할당량 없음 · 세션 제외';
  const parts: string[] = [];
  if (quota.daily != null) parts.push(`일 ${quota.daily}`);
  if (quota.weekly != null) parts.push(`주 ${quota.weekly}`);
  if (quota.monthly != null) parts.push(`월 ${quota.monthly}`);
  const derived = dailyQuota(quota);
  return `${parts.join(' · ')} → 오늘 ${derived ?? 0}개`;
}

export default function UnitsScreen({
  units,
  quotas,
  seedNotice,
  onDismissNotice,
  onSave,
  onArchive,
  onRestore,
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);

  const active = units.filter((u) => !u.archived);
  const archived = units.filter((u) => u.archived);

  const grouped = useMemo(() => {
    const map = new Map<string, Unit[]>();
    for (const u of active) {
      const key = u.category.trim() || '미분류';
      const list = map.get(key) ?? [];
      list.push(u);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'));
  }, [active]);

  function submit() {
    if (!draft) return;
    const minutes = num(draft.minutes);
    if (!draft.name.trim() || !minutes || minutes < 1) return;
    onSave(
      {
        id: draft.id,
        name: draft.name.trim(),
        category: draft.category.trim() || '미분류',
        mode: draft.mode,
        minutes,
        archived: false,
      },
      {
        unitId: draft.id,
        daily: num(draft.daily),
        weekly: num(draft.weekly),
        monthly: num(draft.monthly),
      },
    );
    setDraft(null);
  }

  return (
    <div className="space-y-4">
      {seedNotice && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex-1 leading-relaxed">
            아래 유닛은 <strong>예시</strong>입니다. 본인 학습에 맞게 수정하거나 보관 처리하세요.
          </p>
          <button
            onClick={onDismissNotice}
            className="shrink-0 rounded border border-amber-300 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
          >
            확인
          </button>
        </div>
      )}

      {grouped.map(([category, list]) => {
        const isCollapsed = collapsed[category];
        return (
          <section key={category} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
            >
              <span className="font-medium">
                {category}
                <span className="ml-2 text-xs text-neutral-500">{list.length}</span>
              </span>
              <span className="text-neutral-400">{isCollapsed ? '▸' : '▾'}</span>
            </button>

            {!isCollapsed && (
              <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                {list.map((unit) => {
                  const quota = quotaOf(quotas, unit.id);
                  return (
                    <li key={unit.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{unit.name}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {MODE_LABEL[unit.mode]} · {unit.minutes}분 · {quotaLabel(quota)}
                        </p>
                      </div>
                      <button
                        onClick={() => setDraft(draftFrom(unit, quota))}
                        className="rounded border border-neutral-200 px-2.5 py-1 text-xs hover:bg-neutral-100"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => onArchive(unit.id)}
                        className="rounded border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
                      >
                        보관
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {active.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500">
          등록된 유닛이 없습니다.
        </p>
      )}

      <button
        onClick={() => setDraft(emptyDraft())}
        className="w-full rounded-lg border border-neutral-900 bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
      >
        + 유닛 추가
      </button>

      {archived.length > 0 && (
        <section>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs text-neutral-500 hover:text-neutral-800"
          >
            보관된 유닛 {archived.length}개 {showArchived ? '숨기기' : '보기'}
          </button>
          {showArchived && (
            <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {archived.map((unit) => (
                <li key={unit.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-500">{unit.name}</span>
                  <button
                    onClick={() => onRestore(unit.id)}
                    className="rounded border border-neutral-200 px-2.5 py-1 text-xs hover:bg-neutral-100"
                  >
                    복구
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {draft && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="text-base font-semibold">
              {units.some((u) => u.id === draft.id) ? '유닛 수정' : '유닛 추가'}
            </h2>

            <label className="block">
              <span className="text-xs text-neutral-500">이름</span>
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Part 5 문법 20문항"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-neutral-500">카테고리</span>
                <input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="TOEIC"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-neutral-500">유형</span>
                <select
                  value={draft.mode}
                  onChange={(e) => setDraft({ ...draft, mode: e.target.value as Mode })}
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-neutral-500">1유닛 예상 시간 (분)</span>
              <input
                type="number"
                min={1}
                value={draft.minutes}
                onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>

            <div>
              <span className="text-xs text-neutral-500">
                할당량 (일간만 있으면 충분합니다. 주·월간은 선택)
              </span>
              <div className="mt-1 grid grid-cols-3 gap-3">
                {(['daily', 'weekly', 'monthly'] as const).map((key) => (
                  <label key={key} className="block">
                    <span className="text-[11px] text-neutral-400">
                      {{ daily: '일', weekly: '주', monthly: '월' }[key]}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      className="mt-0.5 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDraft(null)}
                className="flex-1 rounded-md border border-neutral-300 py-2.5 text-sm"
              >
                취소
              </button>
              <button
                onClick={submit}
                className="flex-1 rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
