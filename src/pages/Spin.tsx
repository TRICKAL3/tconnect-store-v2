import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/getApiBase';
import { readResponseJson } from '../lib/parseResponseJson';
import {
  WHEEL_CX,
  WHEEL_CY,
  WHEEL_LETTER_RADIUS_RATIO,
  WHEEL_R,
  WHEEL_SIZE,
  wheelDividerEndpoints,
  wheelLetterFontSize,
  isNoWinWheelSlice,
  wheelRotationDegreesForSlice,
  wheelSectorFill,
  wheelSectorPath,
  wheelSectorTextFill,
  wheelSliceAngle,
  wheelSliceLetter,
  wheelSliceShowsLetter,
} from '../lib/spinWheel';
import { describeSpinPrizeFromSlice } from '../lib/spinPrizeDisplay';
import { MIN_LIFETIME_PURCHASE_USD_FOR_POINTS, TCONNECT_POINTS_TERMS } from '../lib/tconnectPoints';

type SpinStatus = {
  canSpin: boolean;
  pointsBalance: number;
  spinsUsedToday: number;
  spinsRemainingToday: number;
  maxSpinsPerDay: number;
  nextSpinAt: string | null;
};

type SpinPlaySuccess = {
  rewardId: string;
  slotIndex?: number;
  rewardLabel: string;
  rewardLetter?: string;
  prizeDescription?: string;
  rewardType: string;
  pointsWon: number;
  productId?: string | null;
  productName?: string | null;
  productWinId?: string | null;
  needsClaim?: boolean;
  detailKind?: 'paypal_email' | 'binance_id' | null;
  orderId?: string | null;
  pointsBalance: number;
  spinsUsedToday: number;
  spinsRemainingToday: number;
  maxSpinsPerDay: number;
  nextSpinAt: string | null;
};

type WheelSlice = {
  id: string;
  slotIndex: number;
  label: string;
  letter?: string;
  description?: string;
  rewardType?: string;
  showLetter?: boolean;
  points?: number;
  productName?: string | null;
};

function mapWheelSlicesFromApi(raw: unknown): WheelSlice[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s, i) => {
    const row = s as {
      id: string;
      slotIndex?: number;
      label?: string;
      letter?: string;
      showLetter?: boolean;
      description?: string;
      rewardType?: string;
      points?: number;
      productName?: string | null;
      prizeAmountUsd?: number | null;
    };
    const noWin = String(row.rewardType || '').trim() === 'no_win';
    const letter = noWin ? '' : (row.letter || row.label || '');
    const slotIndex = typeof row.slotIndex === 'number' ? row.slotIndex : i;
    return {
      id: row.id,
      slotIndex,
      label: letter,
      letter,
      showLetter: noWin ? false : row.showLetter !== false,
      description: row.description,
      rewardType: row.rewardType,
      points: row.points,
      productName: row.productName,
    };
  });
}

type PendingClaim = {
  winId: string;
  productName: string;
  detailKind: 'paypal_email' | 'binance_id';
};

const SPIN_DURATION_MS = 10000;

const Spin: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SpinStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastWinningIndex, setLastWinningIndex] = useState<number | null>(null);
  const [isAnimatingWheel, setIsAnimatingWheel] = useState(false);
  const [wheelSlices, setWheelSlices] = useState<WheelSlice[]>([]);
  const [wheelLoading, setWheelLoading] = useState(true);
  const [wheelComplete, setWheelComplete] = useState(false);
  const [wheelConfigMessage, setWheelConfigMessage] = useState<string | null>(null);
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);
  const [claimPaypal, setClaimPaypal] = useState('');
  const [claimBinance, setClaimBinance] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const spinFrameRef = React.useRef<number | null>(null);
  const revealTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationRef = React.useRef(0);

  const sliceAngle = useMemo(() => wheelSliceAngle(wheelSlices.length), [wheelSlices.length]);
  const letterFontSize = useMemo(() => wheelLetterFontSize(wheelSlices.length), [wheelSlices.length]);

  const canSpin =
    !!user?.email &&
    !!status?.canSpin &&
    !spinning &&
    !wheelLoading &&
    wheelComplete &&
    wheelSlices.length > 0 &&
    wheelSlices[0]?.id !== 'placeholder' &&
    !pendingClaim;

  const spinBlockReason = useMemo(() => {
    if (!user?.email) return 'Sign in to spin.';
    if (wheelLoading) return 'Loading wheel…';
    if (wheelSlices[0]?.id === 'placeholder' || wheelSlices.length === 0) {
      return 'Wheel could not load. Try again later or contact support.';
    }
    if (!wheelComplete) {
      return wheelConfigMessage || 'Wheel is not ready yet.';
    }
    if (pendingClaim) return 'Submit your prize details below first.';
    if (status && !status.canSpin) {
      return status.spinsRemainingToday <= 0
        ? `Daily spin used (${status.spinsUsedToday}/${status.maxSpinsPerDay}).`
        : 'Cannot spin right now.';
    }
    return null;
  }, [user?.email, wheelLoading, wheelSlices, wheelComplete, wheelConfigMessage, pendingClaim, status]);

  const nextSpinText = useMemo(() => {
    if (!status?.nextSpinAt) return null;
    return new Date(status.nextSpinAt).toLocaleString();
  }, [status?.nextSpinAt]);

  const broadcastPoints = (balance: number) => {
    window.dispatchEvent(
      new CustomEvent('tconnect-points-updated', { detail: { pointsBalance: balance } })
    );
  };

  const stopWheelAnimation = () => {
    if (spinFrameRef.current !== null) {
      cancelAnimationFrame(spinFrameRef.current);
      spinFrameRef.current = null;
    }
  };

  const clearRevealTimer = () => {
    if (revealTimerRef.current !== null) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const spinProgress = (t: number): number => 1 - Math.pow(1 - t, 3);

  const animateWheelToIndex = (winningIndex: number, sliceCount: number) => {
    stopWheelAnimation();
    const desiredMod = wheelRotationDegreesForSlice(winningIndex, sliceCount);
    const start = rotationRef.current;
    const startMod = ((start % 360) + 360) % 360;
    const alignDelta = (desiredMod - startMod + 360) % 360;
    const delta = 8 * 360 + alignDelta;
    const finalRotation = start + delta;

    setIsAnimatingWheel(true);
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / SPIN_DURATION_MS);
      const next = start + delta * spinProgress(t);
      rotationRef.current = next;
      setRotation(next);
      if (t < 1) {
        spinFrameRef.current = requestAnimationFrame(tick);
      } else {
        rotationRef.current = finalRotation;
        setRotation(finalRotation);
        setIsAnimatingWheel(false);
        spinFrameRef.current = null;
      }
    };

    spinFrameRef.current = requestAnimationFrame(tick);
  };

  const resolveWinningSliceIndex = (slices: WheelSlice[], rewardId: string, slotIndex?: number): number => {
    if (
      typeof slotIndex === 'number' &&
      slotIndex >= 0 &&
      slotIndex < slices.length &&
      slices[slotIndex]?.id === rewardId
    ) {
      return slotIndex;
    }
    const byId = slices.findIndex((s) => s.id === rewardId);
    return byId >= 0 ? byId : 0;
  };

  const loadWheel = async () => {
    setWheelLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/spin/wheel`);
      const data = (await readResponseJson(res)) as {
        error?: string;
        slices?: unknown;
        complete?: boolean;
        configMessage?: string | null;
      };
      if (!res.ok) throw new Error(data?.error || 'Failed to load wheel');
      const slices = mapWheelSlicesFromApi(data.slices);
      setWheelComplete(!!data.complete);
      setWheelConfigMessage(data.configMessage || null);
      setWheelSlices(slices.length > 0 ? slices : [{ id: 'placeholder', slotIndex: 0, label: '—' }]);
    } catch {
      setWheelComplete(false);
      setWheelConfigMessage(null);
      setWheelSlices([{ id: 'placeholder', slotIndex: 0, label: '—' }]);
    } finally {
      setWheelLoading(false);
    }
  };

  const loadStatus = async () => {
    if (!user?.email) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/spin/status?email=${encodeURIComponent(user.email)}`);
      const data = (await readResponseJson(res)) as SpinStatus & { error?: string };
      if (!res.ok) throw new Error(data?.error || 'Failed to load spin status');
      setStatus(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWheel();
  }, []);

  useEffect(() => {
    loadStatus();
  }, [user?.email]);

  const applyPlayResult = (data: SpinPlaySuccess, slices: WheelSlice[]) => {
    const slice = slices.find((s) => s.id === data.rewardId);
    const desc =
      data.prizeDescription || slice?.description || describeSpinPrizeFromSlice(slice || {});
    const letter =
      data.rewardLetter ||
      (slice?.rewardType === 'no_win' ? '' : wheelSliceLetter(slice?.letter || slice?.label || ''));
    let line = letter ? `${letter} — ${desc}` : desc;
    if (data.needsClaim) {
      line = `${line}. Submit your details below.`;
    } else if (data.pointsWon > 0) {
      line = `${line} — added to your account`;
      broadcastPoints(data.pointsBalance);
    } else if (data.orderId) {
      line = `${line} — sent to admin`;
    }
    setResult(line);

    if (data.needsClaim && data.productWinId && data.detailKind) {
      setPendingClaim({
        winId: data.productWinId,
        productName: data.productName || 'Prize',
        detailKind: data.detailKind,
      });
      setClaimPaypal('');
      setClaimBinance('');
    } else {
      setPendingClaim(null);
    }

    setStatus((s) =>
      s
        ? {
            ...s,
            canSpin: data.spinsRemainingToday > 0,
            pointsBalance: data.pointsBalance,
            spinsUsedToday: data.spinsUsedToday,
            spinsRemainingToday: data.spinsRemainingToday,
            maxSpinsPerDay: data.maxSpinsPerDay,
            nextSpinAt: data.nextSpinAt,
          }
        : s
    );
  };

  const onSpin = async () => {
    if (!user?.email || spinning) return;
    setSpinning(true);
    setResult(null);
    setError(null);
    setPendingClaim(null);
    clearRevealTimer();
    try {
      const wheelRes = await fetch(`${getApiBase()}/spin/wheel`);
      const wheelData = (await readResponseJson(wheelRes)) as {
        error?: string;
        slices?: unknown;
        complete?: boolean;
        configMessage?: string | null;
      };
      if (!wheelRes.ok) throw new Error(wheelData?.error || 'Failed to load wheel');
      const freshSlices = mapWheelSlicesFromApi(wheelData.slices);
      if (freshSlices.length === 0) throw new Error('Wheel not ready');
      setWheelSlices(freshSlices);
      setWheelComplete(!!wheelData.complete);

      const res = await fetch(`${getApiBase()}/spin/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const raw = await readResponseJson<{ error?: string } & Partial<SpinPlaySuccess>>(res);
      if (!res.ok) throw new Error(raw?.error || 'Spin failed');
      const data = raw as SpinPlaySuccess;

      const winningIndex = resolveWinningSliceIndex(freshSlices, data.rewardId, data.slotIndex);
      setLastWinningIndex(winningIndex);
      window.dispatchEvent(new Event('tconnect-spin-started'));
      animateWheelToIndex(winningIndex, freshSlices.length);

      revealTimerRef.current = setTimeout(() => {
        applyPlayResult(data, freshSlices);
        setSpinning(false);
        window.dispatchEvent(new Event('tconnect-spin-finished'));
      }, SPIN_DURATION_MS);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Spin failed');
      window.dispatchEvent(new Event('tconnect-spin-finished'));
      await loadStatus();
      setSpinning(false);
    }
  };

  const submitClaim = async () => {
    if (!user?.email || !pendingClaim) return;
    setClaimSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = { email: user.email, winId: pendingClaim.winId };
      if (pendingClaim.detailKind === 'paypal_email') {
        body.paypalEmail = claimPaypal.trim();
      } else {
        body.binanceId = claimBinance.trim();
      }
      const res = await fetch(`${getApiBase()}/spin/claim-prize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readResponseJson<{ error?: string; ok?: boolean; orderId?: string }>(res);
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Could not submit prize');
      setPendingClaim(null);
      setResult(
        `Prize submitted! Order #${String(data.orderId || '').slice(0, 8)} is with admin. Check Order History.`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setClaimSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      stopWheelAnimation();
      clearRevealTimer();
    };
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">Spin To Win</h1>
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-gray-200 space-y-2">
          <p className="font-semibold text-amber-200">Points terms</p>
          <p>{TCONNECT_POINTS_TERMS.spinNote}</p>
          <p>{TCONNECT_POINTS_TERMS.minPurchase}</p>
          <p>{TCONNECT_POINTS_TERMS.minBalance}</p>
          <p className="text-xs text-gray-400">
            Only approved paid store orders count toward the ${MIN_LIFETIME_PURCHASE_USD_FOR_POINTS}+ requirement (not points-only checkouts).
          </p>
        </div>

        {!user?.email && (
          <div className="p-4 rounded-lg border border-dark-border bg-dark-surface text-gray-300 mb-6">
            Sign in to use the daily spin.
          </div>
        )}

        <div className="card-dark p-6 rounded-xl border border-dark-border">
          <div className="flex flex-col items-center">
            <div className="relative w-[340px] h-[340px] mb-6 select-none">
              <div className="absolute top-[8px] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[26px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                <div className="mx-auto mt-0.5 w-3 h-3 rounded-full bg-amber-100 border-2 border-amber-500 shadow-md" />
              </div>

              <div
                className={`w-[340px] h-[340px] rounded-full p-1 bg-gradient-to-br from-amber-400/80 via-yellow-200/40 to-amber-600/80 shadow-[0_0_32px_rgba(251,191,36,0.25)] ${
                  isAnimatingWheel ? 'will-change-transform' : ''
                }`}
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <svg
                  width={WHEEL_SIZE}
                  height={WHEEL_SIZE}
                  viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
                  className="rounded-full block mx-auto"
                  aria-hidden
                >
                  <defs>
                    <filter id="wheelTextShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.9" />
                    </filter>
                  </defs>
                  <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R} fill="#334155" />
                  <circle
                    cx={WHEEL_CX}
                    cy={WHEEL_CY}
                    r={WHEEL_R + 2}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={4}
                  />
                  {wheelSlices.map((slice, i) => {
                    const pad = 0.35;
                    const start = i * sliceAngle - 90 - pad;
                    const end = (i + 1) * sliceAngle - 90 + pad;
                    const fill = wheelSectorFill(slice, i, wheelSlices);
                    const stroke = isNoWinWheelSlice(slice) ? '#14532d' : '#0f172a';
                    return (
                      <path
                        key={`sector-${slice.id}-${i}`}
                        d={wheelSectorPath(WHEEL_CX, WHEEL_CY, WHEEL_R, start, end)}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={1}
                      />
                    );
                  })}
                  {wheelSlices.map((_, i) => {
                    const angle = i * sliceAngle - 90;
                    const { x1, y1, x2, y2 } = wheelDividerEndpoints(WHEEL_CX, WHEEL_CY, WHEEL_R, angle);
                    return (
                      <line
                        key={`div-${i}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#ffffff"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      />
                    );
                  })}
                  <circle
                    cx={WHEEL_CX}
                    cy={WHEEL_CY}
                    r={WHEEL_R}
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth={2}
                  />
                  {wheelSlices.map((slice, i) => {
                    if (!wheelSliceShowsLetter(slice)) return null;
                    const mid = i * sliceAngle + sliceAngle / 2;
                    const labelR = WHEEL_R * WHEEL_LETTER_RADIUS_RATIO;
                    const highlight = lastWinningIndex === i;
                    const fill = wheelSectorFill(slice, i, wheelSlices);
                    const letter = wheelSliceLetter(slice.letter || slice.label || '');
                    return (
                      <g
                        key={`lbl-${slice.id}-${i}`}
                        transform={`rotate(${mid - 90}, ${WHEEL_CX}, ${WHEEL_CY})`}
                      >
                        <text
                          x={WHEEL_CX}
                          y={WHEEL_CY - labelR}
                          fill={wheelSectorTextFill(fill, highlight)}
                          fontSize={letterFontSize}
                          fontWeight="800"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          filter="url(#wheelTextShadow)"
                        >
                          {letter}
                        </text>
                      </g>
                    );
                  })}
                  <circle
                    cx={WHEEL_CX}
                    cy={WHEEL_CY}
                    r={40}
                    fill="#0f172a"
                    stroke="#fbbf24"
                    strokeWidth={3}
                  />
                  <circle cx={WHEEL_CX} cy={WHEEL_CY} r={36} fill="#1e293b" stroke="#fff" strokeWidth={1} />
                  <text
                    x={WHEEL_CX}
                    y={WHEEL_CY}
                    fill="#fef3c7"
                    fontSize="12"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    letterSpacing="0.14em"
                  >
                    SPIN
                  </text>
                </svg>
              </div>
            </div>

            <button
              type="button"
              disabled={!canSpin}
              onClick={onSpin}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-violet-600 text-white font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {spinning ? 'Spinning…' : pendingClaim ? 'Submit prize details first' : 'Spin Now'}
            </button>

            {spinBlockReason && !canSpin && !spinning && (
              <p className="text-amber-300 text-sm mt-2 text-center max-w-md">{spinBlockReason}</p>
            )}

            {wheelSlices.length > 0 && wheelSlices[0]?.id !== 'placeholder' && (
              <div className="mt-6 w-full max-w-md">
                <h2 className="text-sm font-semibold text-gray-300 mb-2 text-center uppercase tracking-wide">
                  Prize key
                </h2>
                <div className="rounded-xl border border-dark-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-dark-bg text-gray-400 text-xs">
                        <th className="px-3 py-2 text-left w-16">Letter</th>
                        <th className="px-3 py-2 text-left">Prize</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border">
                      {wheelSlices.map((slice) => {
                        const isNoWin = isNoWinWheelSlice(slice);
                        return (
                          <tr
                            key={slice.id}
                            className={isNoWin ? 'bg-green-950/40' : 'bg-dark-surface/50'}
                          >
                            <td className="px-3 py-2 text-center">
                              {isNoWin ? (
                                <span className="text-green-400 text-xs">Green</span>
                              ) : (
                                <span className="font-black text-amber-300">
                                  {wheelSliceLetter(slice.letter || slice.label)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-200">
                              {describeSpinPrizeFromSlice(slice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-500 px-3 py-2 border-t border-dark-border bg-dark-bg/50">
                    Green = No win (no letter). Letters = prizes.
                  </p>
                </div>
              </div>
            )}

            {loading && <p className="text-gray-500 text-sm mt-3">Loading status…</p>}
            {spinning && (
              <p className="text-amber-200/90 text-sm mt-3 text-center animate-pulse">Wheel spinning…</p>
            )}
            {result && !spinning && (
              <p className="text-green-400 font-semibold mt-3 text-center max-w-md">{result}</p>
            )}
            {error && <p className="text-red-400 mt-3 text-center">{error}</p>}

            {pendingClaim && (
              <div className="mt-5 w-full max-w-md p-4 rounded-xl border border-amber-500/40 bg-amber-500/10">
                <h3 className="text-white font-semibold mb-2">Claim your prize: {pendingClaim.productName}</h3>
                <p className="text-gray-300 text-sm mb-3">
                  {pendingClaim.detailKind === 'binance_id'
                    ? 'Enter your Binance ID for USDT delivery.'
                    : 'Enter the PayPal email where you want to receive funds.'}
                </p>
                {pendingClaim.detailKind === 'paypal_email' ? (
                  <input
                    type="email"
                    value={claimPaypal}
                    onChange={(e) => setClaimPaypal(e.target.value)}
                    placeholder="PayPal email"
                    className="w-full px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white mb-3"
                  />
                ) : (
                  <input
                    type="text"
                    value={claimBinance}
                    onChange={(e) => setClaimBinance(e.target.value)}
                    placeholder="Binance ID"
                    className="w-full px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white mb-3"
                  />
                )}
                <button
                  type="button"
                  disabled={claimSubmitting}
                  onClick={submitClaim}
                  className="w-full py-2.5 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-50"
                >
                  {claimSubmitting ? 'Submitting…' : 'Submit to admin'}
                </button>
              </div>
            )}

            {status && (
              <div className="mt-4 text-sm text-gray-300 space-y-1 text-center">
                <p>
                  Points: <span className="text-sky-400 font-semibold">{status.pointsBalance.toLocaleString()}</span>
                </p>
                <p>
                  Spins today: {status.spinsUsedToday}/{status.maxSpinsPerDay} (remaining{' '}
                  {status.spinsRemainingToday})
                </p>
                {!status.canSpin && nextSpinText && <p>Next spin: {nextSpinText}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Spin;
