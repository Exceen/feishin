import { api } from '/@/renderer/api';
import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { LibraryItem } from '/@/shared/types/domain-types';

import { PreloadOptions, PreloadProgress, PreloadResult } from '../types';

const BATCH_SIZE = 500;
const CONCURRENT_IMAGES = 10;
const MAX_RETRIES = 2;
const IMAGE_SIZE = 300;
const IMAGE_TIMEOUT_MS = 20000; // 20 second timeout per image

interface ImageLoadTask {
    id: string;
    itemType: LibraryItem;
    retryCount: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const loadImage = async (url: string, retries = 0): Promise<boolean> => {
    return new Promise((resolve) => {
        const img = new Image();
        let timeoutId: NodeJS.Timeout | null = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            img.onload = null;
            img.onerror = null;
        };

        // Timeout handler
        timeoutId = setTimeout(() => {
            cleanup();
            console.warn(`[Preload] ⏱ Timeout after ${IMAGE_TIMEOUT_MS}ms: ${url}`);
            if (retries < MAX_RETRIES) {
                const backoffMs = 500 * 2 ** retries; // Reduced from 1000 to 500
                console.log(`[Preload] ⚠ Retry ${retries + 1}/${MAX_RETRIES} for: ${url}`);
                sleep(backoffMs).then(() => {
                    loadImage(url, retries + 1).then(resolve);
                });
            } else {
                console.error(`[Preload] ✗ Failed after ${MAX_RETRIES} retries: ${url}`);
                resolve(false);
            }
        }, IMAGE_TIMEOUT_MS);

        img.onload = () => {
            cleanup();
            console.log(`[Preload] ✓ Loaded: ${url}`);
            resolve(true);
        };

        img.onerror = async () => {
            cleanup();
            if (retries < MAX_RETRIES) {
                const backoffMs = 500 * 2 ** retries; // Reduced from 1000 to 500
                console.log(`[Preload] ⚠ Retry ${retries + 1}/${MAX_RETRIES} for: ${url}`);
                await sleep(backoffMs);
                const result = await loadImage(url, retries + 1);
                resolve(result);
            } else {
                console.error(`[Preload] ✗ Failed after ${MAX_RETRIES} retries: ${url}`);
                resolve(false);
            }
        };

        img.src = url;
    });
};

const loadImageBatch = async (
    tasks: ImageLoadTask[],
    serverId: string,
    progress: PreloadProgress,
    progressType: 'albums' | 'artists',
    onProgress?: (progress: PreloadProgress) => void,
    signal?: AbortSignal,
): Promise<{ failed: number; loaded: number }> => {
    let loaded = 0;
    let failed = 0;

    console.log(
        `[Preload] Loading batch of ${tasks.length} images (${tasks[0]?.itemType || 'unknown'})`,
    );

    for (let i = 0; i < tasks.length; i += CONCURRENT_IMAGES) {
        if (signal?.aborted) {
            console.log('[Preload] Aborted during image loading');
            break;
        }

        const batch = tasks.slice(i, i + CONCURRENT_IMAGES);
        console.log(
            `[Preload] Processing images ${i + 1}-${Math.min(i + CONCURRENT_IMAGES, tasks.length)} of ${tasks.length}`,
        );

        const promises = batch.map(async (task) => {
            const url = getItemImageUrl({
                id: task.id,
                itemType: task.itemType,
                serverId,
                size: IMAGE_SIZE,
            });

            if (!url) {
                console.warn(`[Preload] No URL generated for ${task.itemType} ID: ${task.id}`);
                failed++;
                progress[progressType].failed = failed;
                onProgress?.({ ...progress });
                return false;
            }

            console.log(`[Preload] Loading ${task.itemType}: ${task.id} -> ${url}`);
            const result = await loadImage(url);

            // Update progress immediately after each image loads
            if (result) {
                loaded++;
                progress[progressType].loaded = loaded;
            } else {
                failed++;
                progress[progressType].failed = failed;
            }
            onProgress?.({ ...progress });

            return result;
        });

        await Promise.allSettled(promises);
    }

    console.log(`[Preload] Batch complete: ${loaded} loaded, ${failed} failed`);
    return { failed, loaded };
};

const preloadAlbums = async (
    serverId: string,
    progress: PreloadProgress,
    onProgress?: (progress: PreloadProgress) => void,
    signal?: AbortSignal,
): Promise<void> => {
    console.log('[Preload] Starting album preload');

    const countResult = await api.controller.getAlbumListCount({
        apiClientProps: { serverId, signal },
        query: {},
    });

    const totalAlbums = countResult || 0;
    progress.albums.total = totalAlbums;
    onProgress?.(progress);

    console.log(`[Preload] Found ${totalAlbums} albums`);

    if (totalAlbums === 0 || signal?.aborted) {
        return;
    }

    const uniqueImageIds = new Set<string>();
    const batchCount = Math.ceil(totalAlbums / BATCH_SIZE);

    console.log(`[Preload] Fetching albums in ${batchCount} batches of ${BATCH_SIZE}`);

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
        if (signal?.aborted) {
            console.log('[Preload] Aborted during album fetching');
            break;
        }

        const startIndex = batchIndex * BATCH_SIZE;
        console.log(
            `[Preload] Fetching album batch ${batchIndex + 1}/${batchCount} (items ${startIndex + 1}-${Math.min(startIndex + BATCH_SIZE, totalAlbums)})`,
        );

        const albumsResult = await api.controller.getAlbumList({
            apiClientProps: { serverId, signal },
            query: {
                limit: BATCH_SIZE,
                startIndex,
            },
        });

        if (!albumsResult?.items) {
            console.warn(`[Preload] No items in batch ${batchIndex + 1}`);
            continue;
        }

        for (const album of albumsResult.items) {
            if (album.imageId) {
                uniqueImageIds.add(album.imageId);
            }
        }
    }

    if (signal?.aborted) {
        console.log('[Preload] Aborted before loading album images');
        return;
    }

    console.log(`[Preload] Deduplication: ${totalAlbums} albums -> ${uniqueImageIds.size} unique images`);

    const tasks: ImageLoadTask[] = Array.from(uniqueImageIds).map((id) => ({
        id,
        itemType: LibraryItem.ALBUM,
        retryCount: 0,
    }));

    const { failed, loaded } = await loadImageBatch(
        tasks,
        serverId,
        progress,
        'albums',
        onProgress,
        signal,
    );

    console.log(`[Preload] Album preload complete: ${loaded} loaded, ${failed} failed`);
};

const preloadArtists = async (
    serverId: string,
    progress: PreloadProgress,
    onProgress?: (progress: PreloadProgress) => void,
    signal?: AbortSignal,
): Promise<void> => {
    console.log('[Preload] Starting artist preload');

    const countResult = await api.controller.getAlbumArtistListCount({
        apiClientProps: { serverId, signal },
        query: {},
    });

    const totalArtists = countResult || 0;
    progress.artists.total = totalArtists;
    onProgress?.(progress);

    console.log(`[Preload] Found ${totalArtists} artists`);

    if (totalArtists === 0 || signal?.aborted) {
        return;
    }

    const uniqueImageIds = new Set<string>();
    const batchCount = Math.ceil(totalArtists / BATCH_SIZE);

    console.log(`[Preload] Fetching artists in ${batchCount} batches of ${BATCH_SIZE}`);

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
        if (signal?.aborted) {
            console.log('[Preload] Aborted during artist fetching');
            break;
        }

        const startIndex = batchIndex * BATCH_SIZE;
        console.log(
            `[Preload] Fetching artist batch ${batchIndex + 1}/${batchCount} (items ${startIndex + 1}-${Math.min(startIndex + BATCH_SIZE, totalArtists)})`,
        );

        const artistsResult = await api.controller.getAlbumArtistList({
            apiClientProps: { serverId, signal },
            query: {
                limit: BATCH_SIZE,
                startIndex,
            },
        });

        if (!artistsResult?.items) {
            console.warn(`[Preload] No items in batch ${batchIndex + 1}`);
            continue;
        }

        for (const artist of artistsResult.items) {
            if (artist.imageId) {
                uniqueImageIds.add(artist.imageId);
            }
        }
    }

    if (signal?.aborted) {
        console.log('[Preload] Aborted before loading artist images');
        return;
    }

    console.log(`[Preload] Deduplication: ${totalArtists} artists -> ${uniqueImageIds.size} unique images`);

    const tasks: ImageLoadTask[] = Array.from(uniqueImageIds).map((id) => ({
        id,
        itemType: LibraryItem.ALBUM_ARTIST,
        retryCount: 0,
    }));

    const { failed, loaded } = await loadImageBatch(
        tasks,
        serverId,
        progress,
        'artists',
        onProgress,
        signal,
    );

    console.log(`[Preload] Artist preload complete: ${loaded} loaded, ${failed} failed`);
};

export const preloadCoverArt = async (
    serverId: string,
    options?: PreloadOptions,
): Promise<PreloadResult> => {
    const { onProgress, signal } = options || {};

    console.log(`[Preload] Starting cover art preload for server: ${serverId}`);

    const progress: PreloadProgress = {
        albums: { failed: 0, loaded: 0, total: 0 },
        artists: { failed: 0, loaded: 0, total: 0 },
        status: 'initializing',
    };

    onProgress?.(progress);

    try {
        progress.status = 'loading';
        onProgress?.(progress);

        const startTime = Date.now();

        await Promise.all([
            preloadAlbums(serverId, progress, onProgress, signal),
            preloadArtists(serverId, progress, onProgress, signal),
        ]);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (signal?.aborted) {
            console.log(`[Preload] Cancelled after ${duration}s`);
            progress.status = 'cancelled';
            onProgress?.(progress);

            return {
                albums: progress.albums,
                artists: progress.artists,
                cancelled: true,
            };
        }

        progress.status = 'completed';
        onProgress?.(progress);

        const totalLoaded = progress.albums.loaded + progress.artists.loaded;
        const totalFailed = progress.albums.failed + progress.artists.failed;
        console.log(
            `[Preload] Completed in ${duration}s: ${totalLoaded} loaded, ${totalFailed} failed`,
        );

        return {
            albums: progress.albums,
            artists: progress.artists,
            cancelled: false,
        };
    } catch (error) {
        console.error('[Preload] Error during preload:', error);
        progress.status = 'error';
        onProgress?.(progress);

        return {
            albums: progress.albums,
            artists: progress.artists,
            cancelled: false,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
};
