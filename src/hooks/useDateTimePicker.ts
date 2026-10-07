



























import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import DateTimePickerAndroid from '@react-native-community/datetimepicker';




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

      
      if (Platform.OS === 'android') {
        
        
        if (androidBusyRef.current) return;
        androidBusyRef.current = true;

        
        let AndroidAPI: any = null;
        try {
          
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
          
          setTimeout(() => onResult(result), 0);
        };

        
        
        
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