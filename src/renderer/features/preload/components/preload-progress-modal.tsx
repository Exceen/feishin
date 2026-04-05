import { Button, Group, Progress, Stack, Text } from '@mantine/core';
import { closeAllModals } from '@mantine/modals';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePreloadStore } from '../stores/preload-store';

const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const PreloadProgressModal = () => {
    const { t } = useTranslation();
    const { cancel, error, isLoading, progress } = usePreloadStore();
    const [startTime] = useState<number>(Date.now());
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    useEffect(() => {
        if (!isLoading && progress.status !== 'initializing') {
            return undefined;
        }

        const interval = setInterval(() => {
            setElapsedTime(Date.now() - startTime);
        }, 1000);

        return () => clearInterval(interval);
    }, [isLoading, progress.status, startTime]);

    const totalItems = progress.albums.total + progress.artists.total;
    const loadedItems = progress.albums.loaded + progress.artists.loaded;
    const failedItems = progress.albums.failed + progress.artists.failed;
    const overallPercentage = totalItems > 0 ? (loadedItems / totalItems) * 100 : 0;
    const albumsPercentage =
        progress.albums.total > 0 ? (progress.albums.loaded / progress.albums.total) * 100 : 0;
    const artistsPercentage =
        progress.artists.total > 0 ? (progress.artists.loaded / progress.artists.total) * 100 : 0;

    const getStatusText = () => {
        switch (progress.status) {
            case 'cancelled':
                return t('preload.coverArt.status.cancelled', {
                    defaultValue: 'Cancelled',
                    postProcess: 'sentenceCase',
                });
            case 'completed':
                return t('preload.coverArt.status.completed', {
                    defaultValue: 'Completed',
                    postProcess: 'sentenceCase',
                });
            case 'error':
                return t('preload.coverArt.status.error', {
                    defaultValue: 'Error occurred',
                    postProcess: 'sentenceCase',
                });
            case 'initializing':
                return t('preload.coverArt.status.initializing', {
                    defaultValue: 'Initializing...',
                    postProcess: 'sentenceCase',
                });
            case 'loading':
                return t('preload.coverArt.status.loading', {
                    defaultValue: 'Loading...',
                    postProcess: 'sentenceCase',
                });
            default:
                return '';
        }
    };

    const handleCancel = () => {
        cancel();
    };

    const handleClose = () => {
        closeAllModals();
    };

    const handleMinimize = () => {
        closeAllModals();
    };

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <Text fw={500}>{getStatusText()}</Text>
                <Text c="dimmed" size="sm">
                    {t('preload.coverArt.elapsed', { defaultValue: 'Elapsed' })}:{' '}
                    {formatElapsedTime(elapsedTime)}
                </Text>
            </Group>

            <Stack gap="xs">
                <Group justify="space-between">
                    <Text size="sm">
                        {t('preload.coverArt.albums', { defaultValue: 'Albums' })}:{' '}
                        {progress.albums.loaded.toLocaleString()} /{' '}
                        {progress.albums.total.toLocaleString()}
                    </Text>
                    <Text c="dimmed" size="sm">
                        {albumsPercentage.toFixed(1)}%
                    </Text>
                </Group>
                <Progress color="blue" size="lg" value={albumsPercentage} />
                {progress.albums.failed > 0 && (
                    <Text c="red" size="xs">
                        {t('preload.coverArt.failed', { defaultValue: 'Failed' })}:{' '}
                        {progress.albums.failed.toLocaleString()}
                    </Text>
                )}
            </Stack>

            <Stack gap="xs">
                <Group justify="space-between">
                    <Text size="sm">
                        {t('preload.coverArt.artists', { defaultValue: 'Artists' })}:{' '}
                        {progress.artists.loaded.toLocaleString()} /{' '}
                        {progress.artists.total.toLocaleString()}
                    </Text>
                    <Text c="dimmed" size="sm">
                        {artistsPercentage.toFixed(1)}%
                    </Text>
                </Group>
                <Progress color="green" size="lg" value={artistsPercentage} />
                {progress.artists.failed > 0 && (
                    <Text c="red" size="xs">
                        {t('preload.coverArt.failed', { defaultValue: 'Failed' })}:{' '}
                        {progress.artists.failed.toLocaleString()}
                    </Text>
                )}
            </Stack>

            <Stack gap="xs">
                <Group justify="space-between">
                    <Text fw={500} size="sm">
                        {t('preload.coverArt.overall', { defaultValue: 'Overall' })}:{' '}
                        {loadedItems.toLocaleString()} / {totalItems.toLocaleString()}
                    </Text>
                    <Text c="dimmed" fw={500} size="sm">
                        {overallPercentage.toFixed(1)}%
                    </Text>
                </Group>
                <Progress
                    color={progress.status === 'completed' ? 'teal' : 'blue'}
                    size="xl"
                    value={overallPercentage}
                />
                {failedItems > 0 && (
                    <Text c="red" size="sm">
                        {t('preload.coverArt.failed', { defaultValue: 'Failed' })}:{' '}
                        {failedItems.toLocaleString()}
                    </Text>
                )}
            </Stack>

            {error && (
                <Text c="red" size="sm">
                    {error.message}
                </Text>
            )}

            <Group justify="space-between" mt="md">
                <Button onClick={handleMinimize} variant="subtle">
                    {t('common.minimize', {
                        defaultValue: 'Minimize',
                        postProcess: 'sentenceCase',
                    })}
                </Button>
                <Group>
                    {isLoading && (
                        <Button color="red" onClick={handleCancel}>
                            {t('preload.coverArt.cancelButton', {
                                defaultValue: 'Cancel',
                                postProcess: 'sentenceCase',
                            })}
                        </Button>
                    )}
                    {!isLoading && (
                        <Button onClick={handleClose}>
                            {t('preload.coverArt.closeButton', {
                                defaultValue: 'Close',
                                postProcess: 'sentenceCase',
                            })}
                        </Button>
                    )}
                </Group>
            </Group>
        </Stack>
    );
};
