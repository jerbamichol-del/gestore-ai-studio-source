// screens/HistoryScreen.tsx
import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { Expense, Account } from '../types';
import { getCategoryStyle } from '../utils/categoryStyles';
import { formatCurrency } from '../components/icons/formatters';
import { TrashIcon } from '../components/icons/TrashIcon';
import { HistoryFilterCard } from '../components/HistoryFilterCard';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { useTapBridge } from '../hooks/useTapBridge';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';
type ActiveFilterMode = 'quick' | 'period' | 'custom';

interface ExpenseItemProps {
  expense: Expense;
  accounts: Account[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onOpen: (id: string) => void;
}

const ACTION_WIDTH = 72;

/* ==================== ExpenseItem ==================== */
const ExpenseItem: React.FC<ExpenseItemProps> = ({
  expense,
  accounts,
  onEdit,
  onDelete,
  isOpen,
  onOpen,
}) => {
  const style = getCategoryStyle(expense.category);
  const accountName =
    accounts.find((a) => a.id === expense.accountId)?.name || 'Sconosciuto';
  const itemRef = useRef<HTMLDivElement>(null);
  const tapBridge = useTapBridge();

  const isRecurringInstance = !!expense.recurringExpenseId;
  const itemBgClass = isRecurringInstance ? 'bg-amber-50' : 'bg-white';

  const dragState = useRef({
    isDragging: false,
    isLocked: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    initialTranslateX: 0,
    pointerId: null as number | null,
    wasHorizontal: false,
  });

  const setTranslateX = useCallback((x: number, animated: boolean) => {
    if (!itemRef.current) return;
    itemRef.current.style.transition = animated
      ? 'transform 0.2s cubic-bezier(0.22,0.61,0.36,1)'
      : 'none';
    itemRef.current.style.transform = `translateX(${x}px)`;
  }, []);

  useEffect(() => {
    if (!dragState.current.isDragging) {
      setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
    }
  }, [isOpen, setTranslateX]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || !itemRef.current) return;

    itemRef.current.style.transition = 'none';
    const m = new DOMMatrixReadOnly(
      window.getComputedStyle(itemRef.current).transform,
    );
    const currentX = m.m41;

    dragState.current = {
      isDragging: false,
      isLocked: false,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      initialTranslateX: currentX,
      pointerId: e.pointerId,
      wasHorizontal: false,
    };

    try {
      itemRef.current.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Could not capture pointer: ', err);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (ds.pointerId !== e.pointerId) return;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;

    if (!ds.isDragging) {
      if (Math.hypot(dx, dy) > 8) {
        // Slop
        ds.isDragging = true;
        ds.isLocked = Math.abs(dx) > Math.abs(dy) * 2;
        if (!ds.isLocked) {
          if (ds.pointerId !== null)
            itemRef.current?.releasePointerCapture(ds.pointerId);
          ds.pointerId = null;
          ds.isDragging = false;
          return;
        } else {
          e.stopPropagation();
        }
      } else {
        return;
      }
    }

    if (ds.isDragging && ds.isLocked) {
      ds.wasHorizontal = true;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      let x = ds.initialTranslateX + dx;
      if (x > 0) x = 0;
      if (x < -ACTION_WIDTH) x = -ACTION_WIDTH;
      setTranslateX(x, false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (ds.pointerId !== e.pointerId) return;

    if (ds.pointerId !== null)
      itemRef.current?.releasePointerCapture(ds.pointerId);

    const wasDragging = ds.isDragging;
    const wasHorizontal = ds.wasHorizontal;

    // Reset state early per gestione click
    ds.isDragging = false;
    ds.pointerId = null;

    if (wasDragging && wasHorizontal) {
      const duration = performance.now() - ds.startTime;
      const dx = e.clientX - ds.startX;
      const endX = new DOMMatrixReadOnly(
        window.getComputedStyle(itemRef.current!).transform,
      ).m41;
      const velocity = dx / (duration || 1);
      const shouldOpen =
        endX < -ACTION_WIDTH / 2 || (velocity < -0.3 && dx < -20);
      onOpen(shouldOpen ? expense.id : '');
      setTranslateX(shouldOpen ? -ACTION_WIDTH : 0, true);
    }

    // Evita click subito dopo swipe
    setTimeout(() => {
      dragState.current.wasHorizontal = false;
    }, 0);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (ds.pointerId !== e.pointerId) return;

    if (ds.pointerId !== null)
      itemRef.current?.releasePointerCapture(ds.pointerId);
    ds.isDragging = false;
    ds.isLocked = false;
    ds.pointerId = null;
    ds.wasHorizontal = false;
    setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
  };

  const handleClick = () => {
    if (dragState.current.isDragging || dragState.current.wasHorizontal) return;
    if (isOpen) {
      onOpen('');
    } else {
      onEdit(expense);
    }
  };

  return (
    <div className={`relative ${itemBgClass} overflow-hidden`}>
      <div className="absolute top-0 right-0 h-full flex items-center z-0">
        <button
          onClick={() => onDelete(expense.id)}
          className="w-[72px] h-full flex flex-col items-center justify-center bg-red-600 text-white text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          aria-label="Elimina spesa"
          {...tapBridge}
        >
          <TrashIcon className="w-6 h-6" />
          <span className="text-xs mt-1">Elimina</span>
        </button>
      </div>
      <div
        ref={itemRef}
        data-expense-swipe="1"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        className={`relative flex items-center gap-4 py-3 px-4 ${itemBgClass} z-10 cursor-pointer`}
        style={{ touchAction: 'pan-y' }}
      >
        {isRecurringInstance && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-200 text-amber-800 text-xs font-bold rounded-full flex items-center justify-center border-2 border-amber-50" title="Spesa Programmata">
            P
          </span>
        )}
        <span
          className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${style.bgColor}`}
        >
          <style.Icon className={`w-6 h-6 ${style.color}`} />
        </span>
        <div className="flex-grow min-w-0">
          <p className="font-semibold text-slate-800 truncate">
            {expense.subcategory || style.label} • {accountName}
          </p>
          <p
            className="text-sm text-slate-500 truncate"
            title={expense.description}
          >
            {expense.description || 'Senza descrizione'}
          </p>
        </div>
        <p className="font-bold text-slate-900 text-lg text-right shrink-0 whitespace-nowrap min-w-[90px]">
          {formatCurrency(Number(expense.amount) || 0)}
        </p>
      </div>
    </div>
  );
};

/* ==================== HistoryScreen ==================== */
interface HistoryScreenProps {
  expenses: Expense[];
  accounts: Account[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  isEditingOrDeleting: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;
  onClose: () => void;
  onFilterPanelOpenStateChange: (isOpen: boolean) => void;
  isOverlayed: boolean;
}

interface ExpenseGroup {
  year: number;
  week: number;
  label: string;
  expenses: Expense[];
  total: number;
}

const getISOWeek = (date: Date): [number, number] => {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return [
    d.getUTCFullYear(),
    Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  ];
};

const getWeekLabel = (y: number, w: number) => {
  const now = new Date();
  const [cy, cw] = getISOWeek(now);
  if (y === cy) {
    if (w === cw) return 'Questa Settimana';
    if (w === cw - 1) return 'Settimana Scorsa';
  }
  return `Settimana ${w}, ${y}`;
};

const parseLocalYYYYMMDD = (s: string) => {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};

const HistoryScreen: React.FC<HistoryScreenProps> = ({
  expenses,
  accounts,
  onEditExpense,
  onDeleteExpense,
  isEditingOrDeleting,
  onDateModalStateChange,
  onClose,
  onFilterPanelOpenStateChange,
  isOverlayed,
}) => {
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [activeFilterMode, setActiveFilterMode] =
    useState<ActiveFilterMode>('quick');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customRange, setCustomRange] = useState<{
    start: string | null;
    end: string | null;
  }>({ start: null, end: null });

  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [periodDate, setPeriodDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [isInternalDateModalOpen, setIsInternalDateModalOpen] = useState(false);

  const autoCloseRef = useRef<number | null>(null);
  const prevOpRef = useRef(isEditingOrDeleting);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimatingIn(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setOpenItemId(null);
    setIsAnimatingIn(false);
    setTimeout(onClose, 300);
  };

  const handleDateModalStateChange = useCallback(
    (isOpen: boolean) => {
      setIsInternalDateModalOpen(isOpen);
      onDateModalStateChange(isOpen);
    },
    [onDateModalStateChange],
  );

  // Quando finisce modifica/eliminazione (OK o Annulla), resettiamo card aperta
  useEffect(() => {
    if (prevOpRef.current && !isEditingOrDeleting) {
      setOpenItemId(null);
    }
    prevOpRef.current = isEditingOrDeleting;
  }, [isEditingOrDeleting]);

  useEffect(() => {
    if (!isAnimatingIn) {
      setOpenItemId(null);
    }
  }, [isAnimatingIn]);

  useEffect(() => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    if (openItemId && !isEditingOrDeleting) {
      autoCloseRef.current = window.setTimeout(() => setOpenItemId(null), 5000);
    }
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [openItemId, isEditingOrDeleting]);

  const filteredExpenses = useMemo(() => {
    if (activeFilterMode === 'period') {
      const start = new Date(periodDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(periodDate);
      end.setHours(23, 59, 59, 999);
      switch (periodType) {
        case 'day':
          break;
        case 'week': {
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1);
          start.setDate(diff);
          end.setDate(start.getDate() + 6);
          break;
        }
        case 'month':
          start.setDate(1);
          end.setMonth(end.getMonth() + 1);
          end.setDate(0);
          break;
        case 'year':
          start.setMonth(0, 1);
          end.setFullYear(end.getFullYear() + 1);
          end.setMonth(0, 0);
          break;
      }
      const t0 = start.getTime();
      const t1 = end.getTime();
      return expenses.filter((e) => {
        const d = parseLocalYYYYMMDD(e.date);
        if (isNaN(d.getTime())) return false;
        const t = d.getTime();
        return t >= t0 && t <= t1;
      });
    }

    if (activeFilterMode === 'custom' && customRange.start && customRange.end) {
      const t0 = parseLocalYYYYMMDD(customRange.start).getTime();
      const endDay = parseLocalYYYYMMDD(customRange.end);
      endDay.setDate(endDay.getDate() + 1);
      const t1 = endDay.getTime();
      return expenses.filter((e) => {
        const d = parseLocalYYYYMMDD(e.date);
        if (isNaN(d.getTime())) return false;
        const t = d.getTime();
        return t >= t0 && t < t1;
      });
    }

    if (dateFilter === 'all') return expenses;

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    switch (dateFilter) {
      case '7d':
        startDate.setDate(startDate.getDate() - 6);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 29);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }
    const t0 = startDate.getTime();
    return expenses.filter((e) => {
      const d = parseLocalYYYYMMDD(e.date);
      return !isNaN(d.getTime()) && d.getTime() >= t0;
    });
  }, [expenses, activeFilterMode, dateFilter, customRange, periodType, periodDate]);

  const groupedExpenses = useMemo(() => {
    const sorted = [...filteredExpenses].sort((a, b) => {
      const db = parseLocalYYYYMMDD(b.date);
      const da = parseLocalYYYYMMDD(a.date);
      if (b.time) {
        const [h, m] = b.time.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) db.setHours(h, m);
      }
      if (a.time) {
        const [h, m] = a.time.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) da.setHours(h, m);
      }
      return db.getTime() - da.getTime();
    });

    return sorted.reduce<Record<string, ExpenseGroup>>((acc, e) => {
      const d = parseLocalYYYYMMDD(e.date);
      if (isNaN(d.getTime())) return acc;
      const [y, w] = getISOWeek(d);
      const key = `${y}-${w}`;
      if (!acc[key]) {
        acc[key] = {
          year: y,
          week: w,
          label: getWeekLabel(y, w),
          expenses: [],
          total: 0,
        };
      }
      acc[key].expenses.push(e);
      acc[key].total += Number(e.amount) || 0;
      return acc;
    }, {});
  }, [filteredExpenses]);

  const expenseGroups = (Object.values(groupedExpenses) as ExpenseGroup[]).sort(
    (a, b) => (a.year !== b.year ? b.year - a.year : b.week - a.week),
  );

  const handleOpenItem = (id: string) => setOpenItemId(id || null);

  return (
    <div
      className={`fixed inset-0 z-20 bg-slate-100 transform transition-transform duration-300 ease-in-out ${
        isAnimatingIn ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ touchAction: 'pan-y' }}
    >
      <header className="sticky top-0 z-20 flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm shadow-sm">
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-slate-200 transition-colors"
          aria-label="Indietro"
        >
          <ArrowLeftIcon className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold text-slate-800">Storico Spese</h1>
      </header>

      <main
        className="overflow-y-auto h-[calc(100%-68px)]"
        style={{ touchAction: 'pan-y' }}
      >
        <div
          className="flex-1 overflow-y-auto pb-36"
          style={{ touchAction: 'pan-y' }}
        >
          {expenseGroups.length > 0 ? (
            expenseGroups.map((group) => (
              <div key={group.label} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between font-bold text-slate-800 text-lg px-4 py-2 sticky top-0 bg-slate-100/80 backdrop-blur-sm z-10">
                  <h2>{group.label}</h2>
                  <p className="font-bold text-indigo-600 text-xl">
                    {formatCurrency(group.total)}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-md mx-2 overflow-hidden">
                  {group.expenses.map((expense, index) => (
                    <React.Fragment key={expense.id}>
                      {index > 0 && (
                        <hr className="border-t border-slate-200 ml-16" />
                      )}
                      <ExpenseItem
                        expense={expense}
                        accounts={accounts}
                        onEdit={onEditExpense}
                        onDelete={onDeleteExpense}
                        isOpen={openItemId === expense.id}
                        onOpen={handleOpenItem}
                      />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-500 pt-20 px-6">
              <p className="text-lg font-semibold">Nessuna spesa trovata</p>
              <p className="mt-2">
                Prova a modificare i filtri o aggiungi una nuova spesa dalla
                schermata Home.
              </p>
            </div>
          )}
        </div>
      </main>

      <HistoryFilterCard
        isActive={isAnimatingIn && !isInternalDateModalOpen && !isOverlayed}
        onSelectQuickFilter={(value) => {
          setDateFilter(value);
          setActiveFilterMode('quick');
        }}
        currentQuickFilter={dateFilter}
        onCustomRangeChange={(range) => {
          setCustomRange(range);
          setActiveFilterMode('custom');
        }}
        currentCustomRange={customRange}
        isCustomRangeActive={activeFilterMode === 'custom'}
        onDateModalStateChange={handleDateModalStateChange}
        periodType={periodType}
        periodDate={periodDate}
        onSelectPeriodType={(type) => {
          setPeriodType(type);
          setPeriodDate(() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d;
          });
          setActiveFilterMode('period');
        }}
        onSetPeriodDate={setPeriodDate}
        isPeriodFilterActive={activeFilterMode === 'period'}
        onActivatePeriodFilter={() => setActiveFilterMode('period')}
        onOpenStateChange={onFilterPanelOpenStateChange}
      />
    </div>
  );
};

export default HistoryScreen;