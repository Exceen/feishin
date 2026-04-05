import { create } from 'zustand';

import { PreloadProgress } from '../types';
import { preloadCoverArt } from '../utils/preload-cover-art';

interface PreloadStore {
    abortController: AbortController | null;
    cancel: () => void;
    error: Error | null;
    isLoading: boolean;
    progress: PreloadProgress;
    start: (serverId: string) => Promise<void>;
}

export const usePreloadStore = create<PreloadStore>((set, get) => ({
    abortController: null,
    error: null,
    isLoading: false,
    progress: {
        albums: { failed: 0, loaded: 0, total: 0 },
        artists: { failed: 0, loaded: 0, total: 0 },
        status: 'initializing',
    },

    start: async (serverId: string) => {
        const abortController = new AbortController();

        set({
            abortController,
            error: null,
            isLoading: true,
            progress: {
                albums: { failed: 0, loaded: 0, total: 0 },
                artists: { failed: 0, loaded: 0, total: 0 },
                status: 'initializing',
            },
        });

        const result = await preloadCoverArt(serverId, {
            onProgress: (newProgress) => {
                set({ progress: newProgress });
            },
            signal: abortController.signal,
        });

        set({
            abortController: null,
            error: result.error || null,
            isLoading: false,
        });
    },

    cancel: () => {
        const { abortController } = get();
        if (abortController) {
            abortController.abort();
            set({ abortController: null, isLoading: false });
        }
    },
}));
