import { useEffect, useRef } from 'react';

/**
 * Calls `onTimeout` after `ms` milliseconds if `loading` is still true.
 * Use it to show a "Could not connect — Tap to retry" fallback.
 */
export function useLoadTimeout(loading: boolean, onTimeout: () => void, ms = 10_000) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!loading) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            return;
        }
        timeoutRef.current = setTimeout(onTimeout, ms);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [loading, onTimeout, ms]);
}
