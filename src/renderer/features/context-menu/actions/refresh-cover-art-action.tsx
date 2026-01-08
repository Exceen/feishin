import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { useCurrentServerId, useImageRes } from '/@/renderer/store';
import { useImageRefreshStore } from '/@/renderer/store/image-refresh.store';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem } from '/@/shared/types/domain-types';

interface RefreshCoverArtActionProps {
    items: Array<{ id: string; name: string }>;
    itemType: LibraryItem.ALBUM_ARTIST | LibraryItem.PLAYLIST;
}

export const RefreshCoverArtAction = ({ items, itemType }: RefreshCoverArtActionProps) => {
    const { t } = useTranslation();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const triggerRefresh = useImageRefreshStore((state) => state.triggerRefresh);
    const serverId = useCurrentServerId();
    const imageRes = useImageRes();

    const handleRefreshCoverArt = useCallback(async () => {
        if (items.length === 0 || isRefreshing) return;

        setIsRefreshing(true);

        try {
            // Get all image URLs for different resolutions
            const resolutions = Object.values(imageRes || {}).filter((size) => size > 0);

            // Fetch all images with cache: 'reload' to bypass browser cache
            const fetchPromises = items.flatMap((item) =>
                resolutions.map(async (size) => {
                    const url = getItemImageUrl({
                        id: item.id,
                        itemType,
                        serverId,
                        size,
                    });

                    if (url) {
                        try {
                            // Force fresh fetch from server, bypassing cache
                            await fetch(url, { cache: 'reload' });
                        } catch (error) {
                            console.warn(`Failed to refresh cover art for ${item.name}:`, error);
                        }
                    }
                }),
            );

            await Promise.allSettled(fetchPromises);

            // Trigger React re-render by updating refresh count
            items.forEach((item) => {
                triggerRefresh(item.id);
            });

            const message =
                items.length === 1
                    ? t('action.refreshCoverArtSuccess', {
                          defaultValue: 'Cover art refreshed',
                          postProcess: 'sentenceCase',
                      })
                    : t('action.refreshCoverArtSuccessMultiple', {
                          count: items.length,
                          defaultValue: `Cover art refreshed for ${items.length} items`,
                          postProcess: 'sentenceCase',
                      });

            toast.success({ message });
        } catch (error) {
            console.error('Failed to refresh cover art:', error);
            toast.error({
                message: t('action.refreshCoverArtError', {
                    defaultValue: 'Failed to refresh cover art',
                    postProcess: 'sentenceCase',
                }),
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [items, itemType, isRefreshing, imageRes, serverId, triggerRefresh, t]);

    if (items.length === 0) return null;

    return (
        <ContextMenu.Item
            disabled={isRefreshing}
            leftIcon="refresh"
            onSelect={handleRefreshCoverArt}
        >
            {t('action.refreshCoverArt', {
                defaultValue: 'Refresh cover art',
                postProcess: 'sentenceCase',
            })}
        </ContextMenu.Item>
    );
};
