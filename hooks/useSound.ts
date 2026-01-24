import { useEffect, useRef, useState, useCallback } from 'react';

interface UseSoundOptions {
    autoUnlock?: boolean;
}

export function useSound(soundUrl: string = '/notification.mp3', options: UseSoundOptions = {}) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);

    useEffect(() => {
        // Create audio element
        const audio = new Audio(soundUrl);
        audio.preload = 'auto';

        audio.addEventListener('canplaythrough', () => {
            setIsReady(true);
        });

        audioRef.current = audio;

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, [soundUrl]);

    // Unlock audio on first user interaction (required by browsers)
    useEffect(() => {
        if (!options.autoUnlock || isUnlocked) return;

        const unlock = () => {
            if (audioRef.current && !isUnlocked) {
                audioRef.current.play().then(() => {
                    audioRef.current!.pause();
                    audioRef.current!.currentTime = 0;
                    setIsUnlocked(true);
                }).catch(() => {
                    // Audio play blocked, will try again on next interaction
                });
            }
        };

        // Listen for any user interaction
        const events = ['click', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, unlock, { once: true });
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, unlock);
            });
        };
    }, [options.autoUnlock, isUnlocked]);

    const play = useCallback(() => {
        if (audioRef.current && isReady) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((error) => {
                console.warn('Audio play failed:', error);
            });
        }
    }, [isReady]);

    return { play, isReady, isUnlocked };
}
