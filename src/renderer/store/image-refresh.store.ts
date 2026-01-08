import { create } from 'zustand';

interface ImageRefreshStore {
    getRefreshKey: (id: string) => number;
    refreshCount: Record<string, number>;
    triggerRefresh: (id: string) => void;
}

/**
 * Tracks refresh count for item images to force React re-renders
 * after fetching fresh images from the server
 */
export const useImageRefreshStore = create<ImageRefreshStore>((set, get) => ({
    refreshCount: {},

    triggerRefresh: (id: string) => {
        set((state) => ({
            refreshCount: {
                ...state.refreshCount,
                [id]: (state.refreshCount[id] || 0) + 1,
            },
        }));
    },

    getRefreshKey: (id: string) => {
        return get().refreshCount[id] || 0;
    },
}));
