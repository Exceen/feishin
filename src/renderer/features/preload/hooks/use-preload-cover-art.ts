import { useCallback, useEffect, useRef, useState } from 'react';

import { useCurrentServerId } from '/@/renderer/store';

import { PreloadProgress } from '../types';
import { preloadCoverArt } from '../utils/preload-cover-art';

export const usePreloadCoverArt = (autoStart = false) => {
    const serverId = useCurrentServerId();
    const [progress, setProgress] = useState<PreloadProgress>({
        albums: { failed: 0, loaded: 0, total: 0 },
        artists: { failed: 0, loaded: 0, total: 0 },
        status: 'initializing',
    });
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const start = useCallback(async () => {
        if (!serverId) {
            setError(new Error('No server selected'));
            return;
        }

        abortControllerRef.current = new AbortController();
        setIsLoading(true);
        setError(null);

        const result = await preloadCoverArt(serverId, {
            onProgress: (newProgress) => {
                setProgress({ ...newProgress });
            },
            signal: abortControllerRef.current.signal,
        });

        setIsLoading(false);

        if (result.error) {
            setError(result.error);
        }
    }, [serverId]);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    useEffect(() => {
        if (autoStart && serverId) {
            start();
        }

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [autoStart, serverId, start]);

    return {
        cancel,
        error,
        isLoading,
        progress,
        start,
    };
};
