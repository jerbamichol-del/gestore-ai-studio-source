import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { DateRangePickerModal } from './DateRangePickerModal';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { useSwipe } from '../hooks/useSwipe';
import { useTapBridge } from '../hooks/useTapBridge';
import SmoothPullTab from './SmoothPullTab';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';

interface HistoryFilterCardProps {
  onSelectQuickFilter: (value: DateFilter) => void;
  currentQuickFilter: DateFilter;
  onCustomRangeChange: (range: { start: string | null; end: string | null }) => void;
  currentCustomRange: { start: string | null; end: string | null };
  isCustomRangeActive: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;
  isActive: boolean; // true SOLO nella pagina "Storico"
  onSelectPeriodType: (type: PeriodType) => void;
  onSetPeriodDate: (date: Date) => void;
  periodType: PeriodType;
  periodDate: Date;
  onActivatePeriodFilter: () => void;
  isPeriodFilterActive: boolean;
  onOpenStateChange: (isOpen: boolean) => void;
}

const fmtBtn = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
    .format(new Date(y, m - 1, d))
    .replace('.', '');
};

/* -------------------- QuickFilterControl -------------------- */
const QuickFilterControl: React.FC<{
  onSelect: (value: DateFilter) => void;
  currentValue: DateFilter;
  isActive: boolean;
}> = ({ onSelect, currentValue, isActive }) => {
  const filters: { value: DateFilter; label: string }[] = [
    { value: '7d', label: '7G' },
    { value: '30d', label: '30G' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1A' },
  ];

  return (
    <div
      className={
        'w-full h-10 flex border rounded-lg overflow-hidden transition-colors ' +
        (isActive ? 'border-indigo-600' : 'border-slate-400')
      }
    >
      {filters.map((f, i) => {
        const active = isActive && currentValue === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onSelect(f.value)}
            style={{ touchAction: 'none' }} // swipe pagina continua a funzionare
            className={
              'flex-1 flex items-center justify-center px-2 text-center font-semibold text-sm transition-colors duration-200 focus:outline-none ' +
              (i > 0 ? 'border-l ' : '') +
              (active
                ? 'bg-indigo-600 text-white border-indigo-600'
                : `bg-slate-100 text-slate-700 hover:bg-slate-200 ${
                    isActive ? 'border-indigo-600' : 'border-slate-400'
                  }`)
            }
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------- CustomDateRangeInputs -------------------- */
const CustomDateRangeInputs: React.FC<{
  onClick: () => void;
  range: { start: string | null; end: string | null };
  isActive: boolean;
}> = ({ onClick, range, isActive }) => {
  const has = !!(range.start && range.end);
  const txt = has ? `${fmtBtn(range.start!)} - ${fmtBtn(range.end!)}` : 'Imposta periodo';

  return (
    <div
      className={
        'border h-10 transition-colors rounded-lg ' +
        (isActive ? 'border-indigo-600' : 'border-slate-400')
      }
    >
      <button
        onClick={onClick}
        style={{ touchAction: 'none' }}
        className={
          'w-full h-full flex items-center justify-center gap-2 px-2 hover:bg-slate-200 transition-colors focus:outline-none rounded-lg ' +
          (isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700')
        }
        aria-label="Seleziona intervallo di date"
      >
        <span className="text-sm font-semibold pointer-events-none">{txt}</span>
      </button>
    </div>
  );
};

/* -------------------- PeriodNavigator -------------------- */
const PeriodNavigator: React.FC<{
  periodType: PeriodType;
  periodDate: Date;
  onTypeChange: (type: PeriodType) => void;
  onDateChange: (date: Date) => void;
  isActive: boolean;
  onActivate: () => void;
  isMenuOpen: boolean;
  onMenuToggle: (isOpen: boolean) => void;
}> = ({
  periodType,
  periodDate,
  onTypeChange,
  onDateChange,
  isActive,
  onActivate,
  isMenuOpen,
  onMenuToggle,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (ev: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        onMenuToggle(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('pointerdown', handler, { capture: true });
    }
    return () => {
      document.removeEventListener(
        'pointerdown',
        handler as any,
        { capture: true } as any,
      );
    };
  }, [isMenuOpen, onMenuToggle]);

  const step = (sign: 1 | -1) => {
    onActivate();
    const d = new Date(periodDate);
    if (periodType === 'day') d.setDate(d.getDate() + sign);
    else if (periodType === 'week') d.setDate(d.getDate() + 7 * sign);
    else if (periodType === 'month') d.setMonth(d.getMonth() + sign);
    else d.setFullYear(d.getFullYear() + sign);
    onDateChange(d);
  };

  const label = (() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const s = new Date(periodDate);
    s.setHours(0, 0, 0, 0);

    if (periodType === 'day') {
      if (+s === +t) return 'Oggi';
      const y = new Date(t);
      y.setDate(t.getDate() - 1);
      if (+s === +y) return 'Ieri';
      return periodDate
        .toLocaleDateString('it-IT', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        .replace('.', '');
    }

    if (periodType === 'month') {
      const cm = t.getMonth();
      const cy = t.getFullYear();
      if (periodDate.getMonth() === cm && periodDate.getFullYear() === cy)
        return 'Questo Mese';
      const pm = cm === 0 ? 11 : cm - 1;
      const py = cm === 0 ? cy - 1 : cy;
      if (periodDate.getMonth() === pm && periodDate.getFullYear() === py)
        return 'Mese Scorso';
      return periodDate.toLocaleDateString('it-IT', {
        month: 'long',
        year: 'numeric',
      });
    }

    if (periodType === 'year') {
      if (periodDate.getFullYear() === t.getFullYear()) return "Quest'Anno";
      if (periodDate.getFullYear() === t.getFullYear() - 1) return 'Anno Scorso';
      return String(periodDate.getFullYear());
    }

    // week
    const sow = new Date(periodDate);
    const day = sow.getDay();
    const diff = sow.getDate() - day + (day === 0 ? -6 : 1);
    sow.setDate(diff);
    sow.setHours(0, 0, 0, 0);

    const eow = new Date(sow);
    eow.setDate(sow.getDate() + 6);

    const tsow = new Date(t);
    const tday = tsow.getDay();
    const tdiff = tsow.getDate() - tday + (tday === 0 ? -6 : 1);
    tsow.setDate(tdiff);
    tsow.setHours(0, 0, 0, 0);

    if (+sow === +tsow) return 'Questa Settimana';
    const last = new Date(tsow);
    last.setDate(tsow.getDate() - 7);
    if (+sow === +last) return 'Settimana Scorsa';

    return `${sow.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
    })} - ${eow.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  })();

  return (
    <div
      ref={wrapperRef}
      className={
        'w-full h-10 flex items-center justify-between border rounded-lg bg-white ' +
        (isActive ? 'border-indigo-600' : 'border-slate-400')
      }
    >
      <button
        onClick={() => step(-1)}
        style={{ touchAction: 'none' }}
        className="h-full px-4 hover:bg-slate-100 rounded-l-lg"
        aria-label="Periodo precedente"
      >
        <ChevronLeftIcon className="w-5 h-5 text-slate-700" />
      </button>
      <button
        onClick={() => onMenuToggle(!isMenuOpen)}
        style={{ touchAction: 'none' }}
        className={
          'flex-1 h-full text-sm font-semibold ' +
          (isActive
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-slate-100 text-slate-700') +
          ' hover:bg-slate-200'
        }
      >
        {label}
      </button>
      <button
        onClick={() => step(+1)}
        style={{ touchAction: 'none' }}
        className="h-full px-4 hover:bg-slate-100 rounded-r-lg"
        aria-label="Periodo successivo"
      >
        <ChevronRightIcon className="w-5 h-5 text-slate-700" />
      </button>

      {isMenuOpen && (
        <div className="absolute bottom-full mb-2 left-0 right-0 mx-auto w-40 bg-white border border-slate-200 shadow-lg rounded-lg z-[1000] p-2 space-y-1">
          {(['day', 'week', 'month', 'year'] as PeriodType[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                onActivate();
                onTypeChange(v);
                onMenuToggle(false);
              }}
              style={{ touchAction: 'none' }}
              className={
                'w-full text-left px-4 py-2 text-sm font-semibold rounded-lg ' +
                (isActive && periodType === v
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-slate-50 text-slate-800 hover:bg-slate-200')
              }
            >
              {v === 'day'
                ? 'Giorno'
                : v === 'week'
                ? 'Settimana'
                : v === 'month'
                ? 'Mese'
                : 'Anno'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------- HistoryFilterCard (bottom sheet) -------------------- */

export const PEEK_PX = 70;

export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = (props) => {
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [activeViewIndex, setActiveViewIndex] = useState(0);

  const tapBridge = useTapBridge();

  // Altezza pannello e posizione chiusa
  const OPEN_HEIGHT_VH = 40; // pannello aperto = 40% viewport
  const [openHeight, setOpenHeight] = useState(0);
  const [closedY, setClosedY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [laidOut, setLaidOut] = useState(false);
  const [anim, setAnim] = useState(false);

  // drag stato semplificato
  const dragRef = useRef<{
    active: boolean;
    direction: 'none' | 'vertical' | 'horizontal';
    startX: number;
    startY: number;
    startTranslateY: number;
    lastY: number;
    lastT: number;
  }>({
    active: false,
    direction: 'none',
    startX: 0,
    startY: 0,
    startTranslateY: 0,
    lastY: 0,
    lastT: 0,
  });

  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const rafRemount = useRef(0);
  const remountSwipe = useCallback(() => {
    if (rafRemount.current) cancelAnimationFrame(rafRemount.current);
    setSwipeEnabled(false);
    rafRemount.current = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSwipeEnabled(true));
    });
  }, []);

  // misura e calcola posizione chiusa
  useLayoutEffect(() => {
    if (!props.isActive) {
      setLaidOut(false);
      return;
    }

    const update = () => {
      const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
      const oh = (OPEN_HEIGHT_VH / 100) * vh;
      const closed = Math.max(oh - PEEK_PX, 0);

      setOpenHeight(oh);
      setClosedY(closed);

      setTranslateY((prev) => {
        if (!laidOut || prev === 0 || prev === closedY) {
          return closed;
        }
        const wasOpen = prev < closedY / 2;
        return wasOpen ? 0 : closed;
      });

      setLaidOut(true);
    };

    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.isActive]);

  useEffect(() => {
    props.onDateModalStateChange?.(isDateModalOpen);
  }, [isDateModalOpen, props.onDateModalStateChange]);

  // tuoi valori
  const SPEED = 0.05;
  const MIN_TOGGLE_DRAG = 10; // px minimi per considerare "scatto" apri/chiudi

  const clampY = useCallback(
    (y: number) => {
      const min = 0;
      const max = closedY || 0;
      return Math.max(min, Math.min(max, y));
    },
    [closedY],
  );

  const snapTo = useCallback(
    (vy: number, overridePos?: number) => {
      if (!laidOut) return;
      const max = closedY || 0;
      const currentPos =
        typeof overridePos === 'number' ? clampY(overridePos) : clampY(translateY);
      const ratio = max > 0 ? currentPos / max : 1;

      let target: number;
      if (vy <= -SPEED) {
        // flick deciso verso l'alto -> apri
        target = 0;
      } else if (vy >= SPEED) {
        // flick deciso verso il basso -> chiudi
        target = max;
      } else {
        // niente flick: scegli in base alla posizione
        target = ratio < 0.5 ? 0 : max;
      }

      setAnim(true);
      setTranslateY(target);
    },
    [closedY, translateY, laidOut, SPEED, clampY],
  );

  const isPanelOpen = laidOut && translateY < (closedY || 0) / 2;
  
  const { onOpenStateChange } = props;
  useEffect(() => {
    onOpenStateChange(isPanelOpen);
  }, [isPanelOpen, onOpenStateChange]);


  // blocco scroll body quando il pannello è aperto
  const overlayOpen =
    props.isActive &&
    laidOut &&
    translateY < Math.max(0, (closedY || 0) - 1) &&
    !isDateModalOpen;

  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [overlayOpen]);

  /* ---- drag verticale pannello (segue il dito) ---- */

  const handlePointerDown = (e: React.PointerEvent) => {
    tapBridge.onPointerDown(e as any);
    if (!props.isActive || isDateModalOpen) return;

    dragRef.current = {
      active: true,
      direction: 'none',
      startX: e.clientX,
      startY: e.clientY,
      startTranslateY: translateY,
      lastY: e.clientY,
      lastT: performance.now(),
    };
    if (anim) setAnim(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    tapBridge.onPointerMove(e as any);
    if (!props.isActive || isDateModalOpen) return;

    const d = dragRef.current;
    if (!d.active) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.direction === 'none') {
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 16) return; // ~4px di slop
      if (Math.abs(dy) > Math.abs(dx)) {
        d.direction = 'vertical';
      } else {
        d.direction = 'horizontal';
        d.active = false; // lascia passare lo swipe orizzontale
        return;
      }
    }

    if (d.direction === 'vertical') {
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      const newY = clampY(d.startTranslateY + dy);
      setTranslateY(newY);
      d.lastY = e.clientY;
      d.lastT = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    tapBridge.onPointerUp(e as any);
    const d = dragRef.current;
    if (!d.active) {
      d.direction = 'none';
      return;
    }

    if (d.direction !== 'vertical') {
      d.active = false;
      d.direction = 'none';
      return;
    }

    d.active = false;

    const totalDy = e.clientY - d.startY;
    const startPos = d.startTranslateY;
    const max = closedY || 0;
    const endPos = clampY(startPos + totalDy);

    // 🔴 distanza minima per toggle immediato (indipendente dalla velocità)
    if (Math.abs(totalDy) >= MIN_TOGGLE_DRAG) {
      // da quasi CHIUSO verso SU -> apri
      if (totalDy < 0 && startPos >= max * 0.7) {
        d.direction = 'none';
        setAnim(true);
        setTranslateY(0);
        return;
      }
      // da quasi APERTO verso GIÙ -> chiudi
      if (totalDy > 0 && startPos <= max * 0.3) {
        d.direction = 'none';
        setAnim(true);
        setTranslateY(max);
        return;
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    const vy = (e.clientY - d.lastY) / dt;
    d.direction = 'none';
    snapTo(vy, endPos);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    tapBridge.onPointerCancel?.(e as any);
    const d = dragRef.current;
    if (!d.active) {
      d.direction = 'none';
      return;
    }
    d.active = false;
    d.direction = 'none';
    snapTo(0);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    tapBridge.onClickCapture(e as any);
  };

  /* ------------ Swipe orizzontale interno (3 viste) ------------ */

  const swipeWrapperRef = useRef<HTMLDivElement>(null);
  const changeView = useCallback((i: number) => setActiveViewIndex(i), []);
  const { progress, isSwiping } = useSwipe(
    swipeWrapperRef,
    {
      onSwipeLeft: () => changeView(Math.min(2, activeViewIndex + 1)),
      onSwipeRight: () => changeView(Math.max(0, activeViewIndex - 1)),
    },
    {
      enabled:
        swipeEnabled && props.isActive && !isPeriodMenuOpen && !isDateModalOpen,
      threshold: 28,
      slop: 8,
      disableDrag: () =>
        dragRef.current.direction === 'vertical' || dragRef.current.active,
    },
  );

  const isQuickFilterActive =
    !props.isPeriodFilterActive && !props.isCustomRangeActive;
  const tx = -activeViewIndex * (100 / 3) + progress * (100 / 3);
  const listTransform = `translateX(${tx}%)`;

  const handleQuickSelect = useCallback(
    (v: DateFilter) => {
      props.onSelectQuickFilter(v);
      remountSwipe();
    },
    [props.onSelectQuickFilter, remountSwipe],
  );

  const handlePeriodDateChange = useCallback(
    (date: Date) => {
      props.onSetPeriodDate(date);
      remountSwipe();
    },
    [props.onSetPeriodDate, remountSwipe],
  );

  const handlePeriodTypeChange = useCallback(
    (type: PeriodType) => {
      props.onSelectPeriodType(type);
      remountSwipe();
    },
    [props.onSelectPeriodType, remountSwipe],
  );

  const yForStyle = laidOut
    ? clampY(translateY)
    : openHeight ||
      (typeof window !== 'undefined'
        ? (window.innerHeight * OPEN_HEIGHT_VH) / 100
        : 0);

  const filterBarRef = useRef<HTMLDivElement>(null);

  const panel = (
    <div
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerUp}
      onPointerCancelCapture={handlePointerCancel}
      onClickCapture={handleClickCapture}
      data-no-page-swipe="true"
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)] z-[1000]"
      style={{
        height: `${OPEN_HEIGHT_VH}vh`,
        transform: `translate3d(0, ${yForStyle}px, 0)`,
        // animazione pannello 0,08s
        transition: anim
          ? 'transform 0.08s cubic-bezier(0.22, 0.61, 0.36, 1)'
          : 'none',
        touchAction: 'none',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
        opacity: laidOut && !isDateModalOpen ? 1 : 0,
        pointerEvents: laidOut && !isDateModalOpen ? 'auto' : 'none',
      }}
      onTransitionEnd={() => setAnim(false)}
    >
      {/* linguetta + chevron */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[88px] h-auto flex justify-center cursor-grab"
        style={{ transform: 'translateX(-50%) translateY(-19px)' }}
        aria-hidden="true"
      >
        <SmoothPullTab width="88" height="19" fill="white" />
        <ChevronDownIcon
          className={
            'absolute w-5 h-5 text-slate-400 transition-transform duration-300 ' +
            (isPanelOpen ? 'rotate-0' : 'rotate-180')
          }
          style={{ top: '2px' }}
        />
      </div>

      <div ref={filterBarRef} className="pt-1">
        <div
          ref={swipeWrapperRef}
          className={
            'relative ' + (isPeriodMenuOpen ? 'overflow-visible' : 'overflow-hidden')
          }
          style={{ touchAction: 'none' }}
        >
          <div
            className="w-[300%] flex"
            style={{
              transform: listTransform,
              transition: isSwiping ? 'none' : 'transform 0.08s ease-out',
            }}
          >
            {/* QUICK */}
            <div className="w-1/3 px-4 py-1">
              <QuickFilterControl
                onSelect={handleQuickSelect}
                currentValue={props.currentQuickFilter}
                isActive={isQuickFilterActive}
              />
            </div>

            {/* PERIODO */}
            <div className="w-1/3 px-4 py-1">
              <PeriodNavigator
                periodType={props.periodType}
                periodDate={props.periodDate}
                onTypeChange={handlePeriodTypeChange}
                onDateChange={handlePeriodDateChange}
                isActive={props.isPeriodFilterActive}
                onActivate={props.onActivatePeriodFilter}
                isMenuOpen={isPeriodMenuOpen}
                onMenuToggle={setIsPeriodMenuOpen}
              />
            </div>

            {/* RANGE CUSTOM */}
            <div className="w-1/3 px-4 py-1">
              <CustomDateRangeInputs
                onClick={() => setIsDateModalOpen(true)}
                range={props.currentCustomRange}
                isActive={props.isCustomRangeActive}
              />
            </div>
          </div>
        </div>

        {/* pallini di paging – vicini al bordo inferiore */}
        <div className="flex justify-center items-center pt-1 pb-2 gap-2">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => setActiveViewIndex(i)}
              style={{ touchAction: 'none' }}
              className={
                'w-2.5 h-2.5 rounded-full transition-colors ' +
                (activeViewIndex === i
                  ? 'bg-indigo-600'
                  : 'bg-slate-300 hover:bg-slate-400')
              }
              aria-label={'Vai al filtro ' + (i + 1)}
            />
          ))}
        </div>

        {/* safe area bottom */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );

  return (
    <>
      {props.isActive && createPortal(panel, document.body)}

      <DateRangePickerModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        initialRange={props.currentCustomRange}
        onApply={(range) => {
          props.onCustomRangeChange(range);
          setIsDateModalOpen(false);
        }}
      />
    </>
  );
};