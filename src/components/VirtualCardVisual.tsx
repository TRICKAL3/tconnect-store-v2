import React, { useState } from 'react';
import { Copy, Eye, EyeOff, RotateCcw, Wifi } from 'lucide-react';
import { virtualCardStatusClass, virtualCardStatusLabel } from '../lib/virtualCardStatus';
import type { CardDetails } from './MyCardsSection';

type Props = {
  label: string;
  cardLast4: string | null;
  status: string;
  holderName?: string;
  imageUrl?: string | null;
  cardDetails?: CardDetails | null;
  className?: string;
  interactive?: boolean;
};

function formatCardNumber(raw: string | null | undefined, last4: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length >= 13) {
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }
  const l4 = last4?.replace(/\D/g, '').slice(-4) || '••••';
  return `•••• •••• •••• ${l4}`;
}

function copyText(text: string, label: string, e?: React.MouseEvent) {
  e?.stopPropagation();
  navigator.clipboard.writeText(text).then(() => {
    alert(`${label} copied`);
  });
}

const CardShell: React.FC<{
  imageUrl?: string | null;
  children: React.ReactNode;
  dark?: boolean;
}> = ({ imageUrl, children, dark }) => (
  <>
    {imageUrl ? (
      <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
    ) : null}
    <div
      className={`absolute inset-0 ${
        dark
          ? 'bg-gradient-to-br from-[#0a0f1a] via-[#111827] to-[#1e1b4b]'
          : 'bg-gradient-to-br from-[#0c1222] via-[#152a4a] to-[#2d1b69]'
      }`}
    />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,_rgba(56,189,248,0.22),_transparent_50%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,_rgba(139,92,246,0.18),_transparent_45%)]" />
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
    <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cyan-400/8 blur-3xl pointer-events-none" />
    <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
    {children}
  </>
);

const VirtualCardVisual: React.FC<Props> = ({
  label,
  cardLast4,
  status,
  holderName = 'CARDHOLDER',
  imageUrl,
  cardDetails,
  className = '',
  interactive = true,
}) => {
  const [flipped, setFlipped] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = Boolean(cardDetails);
  const detailsVisible = showDetails && hasDetails;
  const canFlip = interactive && detailsVisible;

  const maskedNumber = `•••• •••• •••• ${cardLast4?.replace(/\D/g, '').slice(-4) || '••••'}`;
  const displayNumber = detailsVisible
    ? formatCardNumber(cardDetails?.cardNumber, cardLast4)
    : maskedNumber;
  const expiry = detailsVisible ? cardDetails?.expireDate || '—' : '••/••';
  const cvv = detailsVisible ? cardDetails?.cvv || '—' : '•••';
  const shortLabel = label.length > 32 ? `${label.slice(0, 30)}…` : label;

  const toggleFlip = () => {
    if (canFlip) setFlipped((v) => !v);
  };

  const toggleDetails = () => {
    setShowDetails((v) => {
      if (v) setFlipped(false);
      return !v;
    });
  };

  return (
    <div className={`w-full max-w-[360px] ${className}`}>
      <div
        className={`card-flip-scene aspect-[1.586/1] w-full ${canFlip ? 'cursor-pointer' : ''}`}
        onClick={toggleFlip}
        onKeyDown={(e) => {
          if (canFlip && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleFlip();
          }
        }}
        role={canFlip ? 'button' : undefined}
        tabIndex={canFlip ? 0 : undefined}
        aria-label={canFlip ? (flipped ? 'Show card front' : 'Show card back for CVV') : undefined}
      >
        <div className={`card-flip-inner w-full h-full ${flipped ? 'is-flipped' : ''}`}>
          {/* Front */}
          <div className="card-flip-face shadow-2xl shadow-cyan-500/10 border border-white/12">
            <CardShell imageUrl={imageUrl}>
              <div className="relative h-full flex flex-col justify-between p-5 sm:p-6 text-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-['Orbitron'] text-[11px] sm:text-xs font-bold tracking-[0.28em] text-white leading-tight">
                      TCONNECT
                    </p>
                    <p className="font-['Orbitron'] text-[9px] sm:text-[10px] font-semibold tracking-[0.42em] text-cyan-300/90 -mt-0.5">
                      CARDS
                    </p>
                    <p className="text-[10px] text-white/45 mt-1.5 truncate max-w-[190px]">{shortLabel}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Wifi className="w-5 h-5 text-white/40 rotate-90" />
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${virtualCardStatusClass(status)}`}
                    >
                      {virtualCardStatusLabel(status)}
                    </span>
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1.5">Card number</p>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-mono text-[10px] sm:text-[11px] md:text-xs tracking-[0.06em] sm:tracking-[0.1em] text-white/95 whitespace-nowrap min-w-0 flex-1 leading-none">
                      {displayNumber}
                    </p>
                    {detailsVisible && cardDetails?.cardNumber && (
                      <button
                        type="button"
                        onClick={(e) => copyText(cardDetails.cardNumber.replace(/\s/g, ''), 'Card number', e)}
                        className="shrink-0 p-1 rounded-md border border-white/10 text-white/50 hover:text-cyan-300 hover:border-cyan-400/30 transition-colors"
                        aria-label="Copy card number"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-0.5">Cardholder</p>
                    <p className="text-sm font-medium truncate uppercase tracking-wide">{holderName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-0.5">Valid thru</p>
                    <p className="font-mono text-sm tracking-wider">{expiry}</p>
                  </div>
                </div>
              </div>
            </CardShell>
          </div>

          {/* Back */}
          <div className="card-flip-face card-flip-back shadow-2xl shadow-violet-500/10 border border-white/12">
            <CardShell imageUrl={imageUrl} dark>
              <div className="relative h-full flex flex-col text-white">
                <div className="h-[22%] bg-gradient-to-r from-[#1a1a1a] via-[#0d0d0d] to-[#1a1a1a] border-b border-black/50" />
                <div className="flex-1 flex flex-col justify-between p-5 sm:p-6">
                  <div className="mt-2">
                    <div className="h-9 rounded-md bg-white/90 flex items-center px-3">
                      <div className="h-px flex-1 bg-gray-300/80" />
                    </div>
                    <p className="text-[8px] text-white/35 mt-1.5 uppercase tracking-wider">
                      Authorized signature
                    </p>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-['Orbitron'] text-[9px] tracking-[0.3em] text-white/50">TCONNECT CARDS</p>
                      <p className="text-[9px] text-white/30 mt-1">Prepaid · Not reloadable</p>
                    </div>
                    <div className="rounded-lg bg-white/95 px-4 py-2.5 text-right min-w-[88px]">
                      <p className="text-[8px] uppercase tracking-wider text-gray-500 font-semibold">CVV</p>
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        <p className="font-mono text-lg font-bold text-gray-900 tracking-widest">{cvv}</p>
                        {detailsVisible && cardDetails?.cvv && (
                          <button
                            type="button"
                            onClick={(e) => copyText(cardDetails.cvv, 'CVV', e)}
                            className="p-1 rounded text-gray-500 hover:text-gray-800"
                            aria-label="Copy CVV"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardShell>
          </div>
        </div>
      </div>

      {hasDetails ? (
        <button
          type="button"
          onClick={toggleDetails}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neon-blue/30 bg-neon-blue/10 text-neon-blue text-xs font-semibold hover:bg-neon-blue/20 transition-colors"
        >
          {showDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showDetails ? 'Hide card details' : 'Show card details'}
        </button>
      ) : (
        <p className="mt-3 text-center text-[11px] text-gray-500">
          Card credentials appear here once your card is activated.
        </p>
      )}

      {canFlip && (
        <button
          type="button"
          onClick={toggleFlip}
          className="mt-2 w-full flex items-center justify-center gap-2 text-[11px] text-gray-500 hover:text-cyan-400 transition-colors"
        >
          <RotateCcw className={`w-3.5 h-3.5 transition-transform ${flipped ? 'rotate-180' : ''}`} />
          {flipped ? 'Tap to show front' : 'Tap card to view CVV on back'}
        </button>
      )}
    </div>
  );
};

export default VirtualCardVisual;
