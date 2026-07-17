import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);

      if (!item) {
        return initialValue;
      }

      return JSON.parse(item) as T;
    } catch {
      return initialValue;
    }
  });

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      setStoredValue((previousValue) => {
        const nextValue =
          typeof value === "function"
            ? (value as (previousValue: T) => T)(previousValue)
            : value;

        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // Ignore localStorage write errors.
        }

        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
