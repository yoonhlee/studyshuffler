import { useEffect, useRef, useState } from 'react';
import { Block, Session, Unit, unitById } from '../lib/store';
import { isSessionFinished, summarize } from '../lib/session';

interface Props {
  session: Session;
  units: Unit[];
  onUpdate: (session: Session) => void;
  onExit: () => void;
}

function mmss(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function RunScreen({ session, units, onUpdate, onExit }: Props) {
  const finished = isSessionFinished(session);
  const current: Block | undefined = session.blocks[session.currentIndex];

  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [accuracy, setAccuracy] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const startedAt = useRef<string>(new Date().toISOString());

  const total = current ? current.minutes * 60 : 0;
  const remaining = total - elapsed;

  // A new block always starts from a clean slate.
  useEffect(() => {
    setElapsed(0);
    setPaused(false);
    setModalOpen(false);
    setAccuracy('');
    startedAt.current = new Date().toISOString();
  }, [session.currentIndex]);

  useEffect(() => {
    if (finished || paused || modalOpen) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [finished, paused, modalOpen]);

  // Timer hits zero: fall through to the completion input. No sound, no notification.
  useEffect(() => {
    if (!finished && !modalOpen && current && elapsed >= total) {
      setElapsed(total);
      setModalOpen(true);
    }
  }, [elapsed, total, modalOpen, finished, current]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  function advance(patch: Partial<Block>) {
    const blocks = session.blocks.map((b, i) =>
      i === session.currentIndex
        ? {
            ...b,
            ...patch,
            startedAt: startedAt.current,
            finishedAt: new Date().toISOString(),
            actualSeconds: Math.min(elapsed, total),
          }
        : b,
    );
    onUpdate({ ...session, blocks, currentIndex: session.currentIndex + 1 });
  }

  function complete(focus: 1 | 2 | 3 | 4 | 5) {
    const parsed = Number(accuracy);
    const validAccuracy =
      accuracy.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
        ? Math.round(parsed)
        : undefined;
    advance({ status: 'done', focus, accuracy: validAccuracy });
  }

  function skip() {
    setToast('스킵 기록됨 · 다음 세션 맨 앞으로 이월됩니다');
    advance({ status: 'skipped' });
  }

  if (finished) {
    const summary = summarize(session);
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-8 px-6">
        <h2 className="text-2xl font-semibold">세션 종료</h2>
        <dl className="w-full space-y-3">
          <Row label="총 학습 시간" value={`${Math.round(summary.totalSeconds / 60)}분`} />
          <Row label="완료" value={`${summary.done}개`} />
          <Row label="스킵" value={`${summary.skipped}개`} />
          <Row
            label="평균 집중도"
            value={summary.avgFocus != null ? summary.avgFocus.toFixed(1) : '—'}
          />
        </dl>
        <button
          onClick={onExit}
          className="w-full rounded-lg bg-neutral-900 py-4 text-base font-medium text-white"
        >
          닫기
        </button>
      </div>
    );
  }

  const unit = current ? unitById(units, current.unitId) : undefined;

  return (
    <div className="mx-auto flex h-full max-w-md flex-col px-6 py-6">
      <div className="flex items-center justify-between">
        <span className="tabular text-sm text-neutral-500">
          {session.currentIndex + 1} / {session.blocks.length}
        </span>
        <button onClick={onExit} className="text-xs text-neutral-400 hover:text-neutral-600">
          나가기
        </button>
      </div>

      {session.relaxed && (
        <p className="mt-2 text-center text-[11px] text-neutral-400">
          유닛 종류가 적어 유형이 연속될 수 있음
        </p>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <h2 className="text-3xl font-semibold leading-snug">{unit?.name ?? '삭제된 유닛'}</h2>
        <p className="tabular text-6xl font-light text-neutral-900">{mmss(remaining)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 pb-2">
        <button
          onClick={() => setPaused((p) => !p)}
          className="rounded-lg border border-neutral-300 py-4 text-sm font-medium hover:bg-neutral-100"
        >
          {paused ? '재개' : '일시정지'}
        </button>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-neutral-900 py-4 text-sm font-medium text-white hover:bg-neutral-800"
        >
          완료
        </button>
        <button
          onClick={skip}
          className="rounded-lg border border-neutral-300 py-4 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
        >
          스킵
        </button>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 flex justify-center px-6">
          <div className="rounded-full bg-neutral-900/90 px-4 py-2 text-xs text-white">{toast}</div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="w-full max-w-md space-y-5 rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <div>
              <label className="text-sm text-neutral-500">정답률 (선택)</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={accuracy}
                  onChange={(e) => setAccuracy(e.target.value)}
                  placeholder="건너뛰기"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
                <span className="text-sm text-neutral-400">%</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">집중도를 고르면 바로 다음 블록으로 넘어갑니다</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => complete(n)}
                    className="tabular rounded-lg border border-neutral-300 py-5 text-lg font-semibold hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
                <span>산만함</span>
                <span>몰입</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-neutral-100 pb-2">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="tabular text-sm font-medium">{value}</dd>
    </div>
  );
}
