import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    formatDistance,
    haversineDistance,
    type Coords,
} from '@/lib/parking/geo';

interface ParkingMapProps {
    lat: number;
    lng: number;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const carIcon = L.divIcon({
    className: 'parking-pin',
    html: '<span class="parking-pin-car">🚗</span>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

const meIcon = L.divIcon({
    className: 'parking-pin',
    html: '<span class="parking-pin-me"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

/**
 * 展開某筆記錄時才載入的地圖：同時畫出「車」與「你」，並算出兩點距離。
 * 找車時真正需要的是相對位置，只有一根 pin 幫助有限。
 */
export default function ParkingMap({ lat, lng }: ParkingMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const meMarkerRef = useRef<L.Marker | null>(null);
    const lineRef = useRef<L.Polyline | null>(null);

    const [me, setMe] = useState<Coords | null>(null);
    const [meError, setMeError] = useState(false);

    // 建立地圖與車輛標記
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const map = L.map(container, {
            center: [lat, lng],
            zoom: 17,
            scrollWheelZoom: false,
            zoomControl: true,
        });

        L.tileLayer(TILE_URL, {
            maxZoom: 20,
            attribution: TILE_ATTRIBUTION,
        }).addTo(map);

        L.marker([lat, lng], { icon: carIcon, title: '停車位置' }).addTo(map);

        // 面板剛展開時容器尺寸可能還沒定案
        requestAnimationFrame(() => map.invalidateSize());

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            meMarkerRef.current = null;
            lineRef.current = null;
        };
    }, [lat, lng]);

    // 持續追蹤自己的位置
    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setMeError(true);
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                setMeError(false);
                setMe({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            () => setMeError(true),
            { enableHighAccuracy: true, timeout: 12_000, maximumAge: 10_000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // 把「你」畫上去，並把兩個點都框進畫面
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !me) return;

        if (meMarkerRef.current) {
            meMarkerRef.current.setLatLng([me.lat, me.lng]);
        } else {
            meMarkerRef.current = L.marker([me.lat, me.lng], {
                icon: meIcon,
                title: '你在這裡',
            }).addTo(map);
        }

        const path: [number, number][] = [
            [me.lat, me.lng],
            [lat, lng],
        ];

        if (lineRef.current) {
            lineRef.current.setLatLngs(path);
        } else {
            lineRef.current = L.polyline(path, {
                color: '#268bd2',
                weight: 2,
                dashArray: '6 6',
                opacity: 0.8,
            }).addTo(map);
        }

        map.fitBounds(L.latLngBounds(path), { padding: [40, 40], maxZoom: 18 });
    }, [me, lat, lng]);

    const distance = me ? haversineDistance(me, { lat, lng }) : null;

    return (
        <div>
            <div
                ref={containerRef}
                className="h-60 sm:h-72 w-full rounded-lg overflow-hidden border border-base-600 z-0"
            />
            <p className="mt-2 text-sm text-base-400">
                {distance !== null ? (
                    <>
                        <span className="text-accent-cyan font-medium">
                            距離你約 {formatDistance(distance)}
                        </span>
                        <span className="text-base-600"> · 🚗 車　🔵 你</span>
                    </>
                ) : meError ? (
                    <span className="text-base-600">抓不到你目前的位置，地圖只顯示停車點。</span>
                ) : (
                    <span className="text-base-600">正在定位你的位置…</span>
                )}
            </p>
        </div>
    );
}
