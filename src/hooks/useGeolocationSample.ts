import { useCallback, useEffect, useRef, useState } from 'react';
import { GOOD_ACCURACY_M, SAMPLE_DURATION_MS, type Coords } from '@/lib/parking/geo';

export interface SampledPosition extends Coords {
    accuracy: number;
}

type SampleStatus = 'idle' | 'locating';

/** GPS 冷開機拿第一筆座標可能要十幾秒，給它一點時間再放棄 */
const PER_FIX_TIMEOUT_MS = 25_000;

/** 遲遲拿不到新座標時，可以接受多舊的快取座標 */
const CACHED_FIX_MAX_AGE_MS = 30_000;

const errorMessage = (error: GeolocationPositionError): string => {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return '定位權限被拒絕。請到瀏覽器的網站權限設定允許定位後再試一次。';
        case error.POSITION_UNAVAILABLE:
            return '目前抓不到定位訊號，走到空曠一點的地方再試試（地下室常常收不到）。';
        case error.TIMEOUT:
            return '定位逾時了，請再按一次試試。';
        default:
            return '定位失敗，請再試一次。';
    }
};

/**
 * 按一次按鈕就抓一次定位。
 *
 * 單次 getCurrentPosition 常常回傳快取的粗略座標（誤差幾百公尺都有），
 * 所以這裡改用 watchPosition 連續取樣數秒、留下精度最好的那一筆，
 * 精度夠好就提早結束，不讓使用者乾等。
 *
 * 取樣時間是「最少等這麼久」而不是「最多等這麼久」：GPS 冷開機拿到第一筆
 * 座標本來就可能要十幾秒，時間到卻還沒收到任何座標時要繼續等，
 * 不能直接判定失敗。
 */
export function useGeolocationSample() {
    const [status, setStatus] = useState<SampleStatus>('idle');
    const [bestAccuracy, setBestAccuracy] = useState<number | null>(null);
    const [isSlow, setIsSlow] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const watchIdRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const windowElapsedRef = useRef(false);
    const bestRef = useRef<SampledPosition | null>(null);
    const onDoneRef = useRef<((position: SampledPosition) => void) | null>(null);

    const teardown = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // 元件被卸載時別讓 watch 繼續跑
    useEffect(() => teardown, [teardown]);

    const finish = useCallback(() => {
        const best = bestRef.current;
        if (!best) return;

        teardown();
        setStatus('idle');
        setIsSlow(false);
        bestRef.current = null;

        onDoneRef.current?.(best);
        onDoneRef.current = null;
    }, [teardown]);

    const fail = useCallback(
        (message: string) => {
            teardown();
            setStatus('idle');
            setIsSlow(false);
            bestRef.current = null;
            onDoneRef.current = null;
            setError(message);
        },
        [teardown]
    );

    const start = useCallback(
        (onDone: (position: SampledPosition) => void) => {
            if (typeof navigator === 'undefined' || !navigator.geolocation) {
                setError('這個瀏覽器不支援定位功能。');
                return;
            }

            teardown();
            setError(null);
            setBestAccuracy(null);
            setIsSlow(false);
            windowElapsedRef.current = false;
            bestRef.current = null;
            onDoneRef.current = onDone;
            setStatus('locating');

            const handlePosition = (position: GeolocationPosition) => {
                const { latitude, longitude, accuracy } = position.coords;
                const current = bestRef.current;

                if (!current || accuracy < current.accuracy) {
                    bestRef.current = { lat: latitude, lng: longitude, accuracy };
                    setBestAccuracy(accuracy);
                }

                // 精度夠好就別讓人乾等；取樣時間到了才收到第一筆也直接收工
                const best = bestRef.current;
                if (best && (best.accuracy <= GOOD_ACCURACY_M || windowElapsedRef.current)) {
                    finish();
                }
            };

            watchIdRef.current = navigator.geolocation.watchPosition(
                handlePosition,
                (positionError) => {
                    // 已經拿到堪用的座標時，後續的錯誤（例如逾時）就當作結束訊號
                    if (bestRef.current) {
                        finish();
                        return;
                    }
                    fail(errorMessage(positionError));
                },
                {
                    enableHighAccuracy: true,
                    timeout: PER_FIX_TIMEOUT_MS,
                    maximumAge: 0,
                }
            );

            timerRef.current = setTimeout(() => {
                windowElapsedRef.current = true;
                if (bestRef.current) {
                    finish();
                } else {
                    // 還沒收到任何座標：繼續等 watchPosition，同時退一步接受
                    // 半分鐘內的快取座標——你才剛停好車，那個點就是這裡。
                    setIsSlow(true);
                    navigator.geolocation.getCurrentPosition(
                        handlePosition,
                        () => { /* 交給 watchPosition 的錯誤處理，這裡不用重複報錯 */ },
                        {
                            enableHighAccuracy: true,
                            timeout: PER_FIX_TIMEOUT_MS,
                            maximumAge: CACHED_FIX_MAX_AGE_MS,
                        }
                    );
                }
            }, SAMPLE_DURATION_MS);
        },
        [fail, finish, teardown]
    );

    const dismissError = useCallback(() => setError(null), []);

    return { status, bestAccuracy, isSlow, error, start, dismissError };
}
