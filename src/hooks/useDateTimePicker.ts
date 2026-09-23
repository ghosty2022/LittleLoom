// src/hooks/useDateTimePicker.ts
// ─────────────────────────────────────────────────────────────────────
// Cross-platform date/time picker that NEVER renders the declarative
// <DateTimePicker> component on Android — only uses the imperative
// DateTimePickerAndroid.open() API. This eliminates the
// "Cannot read property 'dismiss' of undefined" crash entirely.
//
// iOS     → returns state so the caller renders <DateTimePicker>
//           inside a modal.
// Android → opens the native picker imperatively, one call at a time.
//
// Usage:
//   const picker = useDateTimePicker();
//   picker.open({ value: date, mode: 'datetime' }, (next) => {
//     if (next) setDate(next);
//   });
//   ...
//   {/* iOS only — render the picker inside a modal */}
//   {Platform.OS === 'ios' && picker.iosPicker.visible && (
//     <DateTimePicker
//       value={picker.iosPicker.value}
//       mode={picker.iosPicker.mode === 'datetime' ? 'date' : picker.iosPicker.mode}
//       display="spinner"
//       onValueChange={picker.handleIosChange}
//     />
//   )}
// ─────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import DateTimePickerAndroid from '@react-native-community/datetimepicker';

// The package exports both named exports AND a default. We only need
// the imperative API on Android and the pure state on iOS, so we
// lazy-require to avoid pulling the native module in on wrong platform.
type Mode = 'date' | 'time' | 'datetime';

interface OpenOptions {
  value: Date;
  mode: Mode;
  minimumDate?: Date;
  maximumDate?: Date;
  is24Hour?: boolean;
}

interface IosPickerState {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  is24Hour?: boolean;
}

export interface DateTimePickerHook {
  /** Open the picker. Callback receives the chosen Date, or null if cancelled. */
  open: (opts: OpenOptions, onResult: (date: Date | null) => void) => void;

  /** iOS-only: current picker state. Render <DateTimePicker> when visible. */
  iosPicker: IosPickerState;

  /** iOS-only: called by the <DateTimePicker> onValueChange handler. */
  handleIosChange: (event: any, selected?: Date) => void;

  /** iOS-only: dismiss the picker programmatically. */
  dismissIos: () => void;
}

const isSafeDate = (d: unknown): d is Date =>
  d instanceof Date && !isNaN(d.getTime());

export function useDateTimePicker(): DateTimePickerHook {
  const [iosPicker, setIosPicker] = useState<IosPickerState>({
    visible: false,
    mode: 'date',
    value: new Date(),
  });

  const iosCallbackRef = useRef<((date: Date | null) => void) | null>(null);
  const androidBusyRef = useRef(false);

  const open = useCallback(
    (opts: OpenOptions, onResult: (date: Date | null) => void) => {
      const safeValue = isSafeDate(opts.value) ? opts.value : new Date();

      // ─── ANDROID: imperative API only ──────────────────────────
      if (Platform.OS === 'android') {
        // Guard against rapid double-taps that would try to open two
        // native pickers at once.
        if (androidBusyRef.current) return;
        androidBusyRef.current = true;

        // Lazy require so we never pull the imperative API on iOS.
        let AndroidAPI: any = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          AndroidAPI = require('@react-native-community/datetimepicker')
            .DateTimePickerAndroid;
        } catch {
          AndroidAPI = null;
        }

        if (!AndroidAPI || typeof AndroidAPI.open !== 'function') {
          androidBusyRef.current = false;
          onResult(null);
          return;
        }

        const finish = (result: Date | null) => {
          androidBusyRef.current = false;
          // Defer callback to avoid calling setState during a native event.
          setTimeout(() => onResult(result), 0);
        };

        // For 'datetime', the native Android module does NOT support
        // a combined picker. Chain date → time in two sequential calls
        // using the SDK-native sequencing, NOT nested promises.
        if (opts.mode === 'datetime') {
          try {
            AndroidAPI.open({
              value: safeValue,
              mode: 'date',
              minimumDate: opts.minimumDate,
              maximumDate: opts.maximumDate,
              onChange: (dateEvent: any, dateSelected?: Date) => {
                if (dateEvent?.type !== 'set' || !isSafeDate(dateSelected)) {
                  finish(null);
                  return;
                }
                const withDate = new Date(safeValue);
                withDate.setFullYear(dateSelected.getFullYear());
                withDate.setMonth(dateSelected.getMonth());
                withDate.setDate(dateSelected.getDate());

                // Chain into time picker — but from a fresh tick so
                // the native module fully dismisses the date picker
                // before we open the time picker.
                setTimeout(() => {
                  try {
                    AndroidAPI.open({
                      value: withDate,
                      mode: 'time',
                      is24Hour: opts.is24Hour ?? false,
                      onChange: (timeEvent: any, timeSelected?: Date) => {
                        if (
                          timeEvent?.type !== 'set' ||
                          !isSafeDate(timeSelected)
                        ) {
                          finish(null);
                          return;
                        }
                        const final = new Date(withDate);
                        final.setHours(timeSelected.getHours());
                        final.setMinutes(timeSelected.getMinutes());
                        final.setSeconds(0, 0);
                        finish(final);
                      },
                    });
                  } catch {
                    finish(withDate);
                  }
                }, 250);
              },
            });
          } catch {
            finish(null);
          }
          return;
        }

        // Single-mode (date OR time)
        try {
          AndroidAPI.open({
            value: safeValue,
            mode: opts.mode,
            minimumDate: opts.minimumDate,
            maximumDate: opts.maximumDate,
            is24Hour: opts.is24Hour ?? false,
            onChange: (event: any, selected?: Date) => {
              if (event?.type !== 'set' || !isSafeDate(selected)) {
                finish(null);
                return;
              }
              const merged = new Date(safeValue);
              if (opts.mode === 'date') {
                merged.setFullYear(
                  selected.getFullYear(),
                  selected.getMonth(),
                  selected.getDate()
                );
              } else {
                merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
              }
              finish(merged);
            },
          });
        } catch {
          finish(null);
        }
        return;
      }

      // ─── iOS: pure state, caller renders <DateTimePicker> ──────
      iosCallbackRef.current = onResult;
      setIosPicker({
        visible: true,
        mode: opts.mode === 'datetime' ? 'date' : opts.mode,
        value: safeValue,
        minimumDate: opts.minimumDate,
        maximumDate: opts.maximumDate,
        is24Hour: opts.is24Hour,
      });
    },
    []
  );

  const handleIosChange = useCallback((event: any, selected?: Date) => {
    if (event?.type === 'dismissed') {
      setIosPicker((prev) => ({ ...prev, visible: false }));
      iosCallbackRef.current?.(null);
      iosCallbackRef.current = null;
      return;
    }
    if (isSafeDate(selected)) {
      setIosPicker((prev) => ({ ...prev, value: selected }));
    }
  }, []);

  const dismissIos = useCallback(() => {
    setIosPicker((prev) => {
      if (prev.visible) {
        iosCallbackRef.current?.(prev.value);
        iosCallbackRef.current = null;
      }
      return { ...prev, visible: false };
    });
  }, []);

  return {
    open,
    iosPicker,
    handleIosChange,
    dismissIos,
  };
}

export default useDateTimePicker;