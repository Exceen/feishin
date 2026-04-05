export interface PreloadProgress {
    albums: {
        failed: number;
        loaded: number;
        total: number;
    };
    artists: {
        failed: number;
        loaded: number;
        total: number;
    };
    status: 'cancelled' | 'completed' | 'error' | 'initializing' | 'loading';
}

export interface PreloadOptions {
    onProgress?: (progress: PreloadProgress) => void;
    signal?: AbortSignal;
}

export interface PreloadResult {
    albums: {
        failed: number;
        loaded: number;
        total: number;
    };
    artists: {
        failed: number;
        loaded: number;
        total: number;
    };
    cancelled: boolean;
    error?: Error;
}
