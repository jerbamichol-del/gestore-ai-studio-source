// hooks/useTapBridge.ts
import React, { useRef, useCallback } from 'react';

type Options = {
  slopPx?: number; // quanto puoi muoverti (in px) e restare un tap
  tapMs?: number;  // durata massima del tap
};

/**
 * TapBridge: gestisce i TAP (tocchi singoli)
 * - Evita il "primo tap a vuoto"
 * - Sopprime il doppio click nativo
 * - NON interferisce con gli swipe (non usa i movimenti per bloccare gesti)
 */
export function useTapBridge(opts: Options = {}) {
  const SLOP = opts.slopPx ?? 10;
  const TAP_MS = opts.tapMs ?? 350;

  const stateRef = useRef({
    id: null as number | null,
    t0: 0,
    x0: 0,
    y0: 0,
    target: null as EventTarget | null,
    suppressNextClick: false,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const state = stateRef.current;

    if (state.id !== null && e.pointerId !== state.id) return;

    state.id = e.pointerId;
    state.t0 = performance.now();
    state.x0 = e.clientX;
    state.y0 = e.clientY;
    state.target = e.target;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const state = stateRef.current;
    if (state.id !== e.pointerId) return;
    // NON facciamo nulla qui: gli swipe restano liberi
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = stateRef.current;
      if (state.id !== e.pointerId) return;

      const dt = performance.now() - state.t0;
      const dx = Math.abs(e.clientX - state.x0);
      const dy = Math.abs(e.clientY - state.y0);
      const target = state.target as HTMLElement | null;

      state.id = null;

      const isTap = dt < TAP_MS && dx <= SLOP && dy <= SLOP;

      if (isTap && target && !target.closest?.('[data-no-synthetic-click]')) {
        e.stopPropagation();
        state.suppressNextClick = true;

        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target as any).isContentEditable
        ) {
          if (document.activeElement !== target) {
            target.focus();
          }
        }

        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        target.dispatchEvent(clickEvent);
      } else {
        state.suppressNextClick = false;
      }

      state.target = null;
    },
    [SLOP, TAP_MS],
  );

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    const state = stateRef.current;
    if (state.id === e.pointerId) {
      state.id = null;
      state.target = null;
      state.suppressNextClick = false;
    }
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    const state = stateRef.current;

    if (e.isTrusted && state.suppressNextClick) {
      e.preventDefault();
      e.stopPropagation();
      state.suppressNextClick = false;
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
  };
}
