import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface GpsMapVehicle {
  gps_id: string
  plate: string
  lat: number | null
  lng: number | null
  speed: number
  fuel_pct: number
  driver_name?: string | null
  driver_license?: string | null
  address?: string | null
  vehicle_type?: string | null
  capacity?: string | null
  km_today?: number | null
  km_total?: number
  time_update?: string | null
  is_stop?: boolean
  is_overspeed?: boolean
  status: 'moving' | 'stopped' | 'overspeed'
  // Extended fields (BM raw)
  vin?: string | null
  voltage?: number | null
  has_gps?: boolean | null
  has_gsm?: boolean | null
  key_on?: boolean | null
  door_open?: boolean | null
  ac_on?: boolean | null
  stop_time?: string | null
  begin_stop?: string | null
  stop_counter?: number | null
  driving_time?: number | null
  day_driving_time?: number | null
  over_4h_count?: number | null
  over_10h_count?: number | null
  overspeed_count?: number | null
  trong_tai?: number | null
}

interface Props {
  vehicles: GpsMapVehicle[]
  /** When set, map flies to that vehicle's marker. */
  focusedGpsId?: string | null
  /** Increment to force re-focus even if focusedGpsId is unchanged. */
  focusTick?: number
  onMarkerClick?: (gpsId: string) => void
  height?: number | string
}

type Tone = 'running' | 'stopped' | 'offline' | 'alert'

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009]

const TILE_LAYERS = {
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    subdomains: '',
    maxZoom: 19,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    maxZoom: 19,
  },
}

function statusToTone(v: GpsMapVehicle): Tone {
  if (!v.time_update) return 'offline'
  if (v.is_overspeed) return 'alert'
  if (v.status === 'moving') return 'running'
  if (v.status === 'overspeed') return 'alert'
  return 'stopped'
}

function colorForTone(tone: Tone) {
  switch (tone) {
    case 'running':
      return { base: '#52c41a', body: '#52c41a', dark: '#389e0d', glow: 'rgba(82,196,26,0.45)', text: '#fff' }
    case 'stopped':
      return { base: '#1677ff', body: '#1677ff', dark: '#0958d9', glow: 'rgba(22,119,255,0.35)', text: '#fff' }
    case 'offline':
      return { base: '#bfbfbf', body: '#bfbfbf', dark: '#8c8c8c', glow: 'rgba(140,140,140,0.25)', text: '#1f2937' }
    case 'alert':
      return { base: '#ff4d4f', body: '#ff4d4f', dark: '#cf1322', glow: 'rgba(255,77,79,0.55)', text: '#fff' }
  }
}

function toneLabel(tone: Tone): string {
  switch (tone) {
    case 'running': return 'Đang chạy'
    case 'stopped': return 'Đang đỗ'
    case 'offline': return 'Mất tín hiệu'
    case 'alert': return 'Vượt tốc'
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildDivIcon(v: GpsMapVehicle): L.DivIcon {
  const tone = statusToTone(v)
  const c = colorForTone(tone)
  const isPulsing = tone === 'running' || tone === 'alert'

  // Top-down sedan car: rounded body, headlights, front+rear windshields with stripe pattern,
  // visible side mirrors, 4 wheels peeking out, tail lights.
  const carSvg = `
    <svg viewBox="0 0 36 64" width="36" height="64" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="18" cy="61" rx="14" ry="2.2" fill="rgba(0,0,0,0.18)"/>
      <!-- wheels -->
      <rect x="2"    y="14" width="2.6" height="7" rx="1" fill="#1a1a1a"/>
      <rect x="31.4" y="14" width="2.6" height="7" rx="1" fill="#1a1a1a"/>
      <rect x="2"    y="40" width="2.6" height="7" rx="1" fill="#1a1a1a"/>
      <rect x="31.4" y="40" width="2.6" height="7" rx="1" fill="#1a1a1a"/>
      <!-- side mirrors -->
      <rect x="0.5"  y="19" width="3" height="2.6" rx="1" fill="${c.dark}"/>
      <rect x="32.5" y="19" width="3" height="2.6" rx="1" fill="${c.dark}"/>
      <!-- body -->
      <rect x="4" y="3" width="28" height="56" rx="10" fill="${c.body}" stroke="${c.dark}" stroke-width="0.6"/>
      <!-- headlights -->
      <ellipse cx="9.5"  cy="6.2" rx="2.4" ry="1.3" fill="#fff8d6" opacity="0.95"/>
      <ellipse cx="26.5" cy="6.2" rx="2.4" ry="1.3" fill="#fff8d6" opacity="0.95"/>
      <!-- front windshield (trapezoid, glass color) -->
      <path d="M 7 11 L 29 11 L 27 22 L 9 22 Z" fill="#cfeefb" opacity="0.95"/>
      <g stroke="#ffffff" stroke-width="1" opacity="0.55" fill="none" stroke-linecap="round">
        <line x1="11" y1="11" x2="7"  y2="22"/>
        <line x1="17" y1="11" x2="13" y2="22"/>
        <line x1="23" y1="11" x2="19" y2="22"/>
        <line x1="29" y1="11" x2="25" y2="22"/>
      </g>
      <!-- center roof accent -->
      <rect x="9" y="26" width="18" height="12" rx="2.5" fill="${c.dark}" opacity="0.15"/>
      <!-- rear windshield -->
      <path d="M 9 42 L 27 42 L 29 53 L 7 53 Z" fill="#cfeefb" opacity="0.95"/>
      <g stroke="#ffffff" stroke-width="1" opacity="0.55" fill="none" stroke-linecap="round">
        <line x1="13" y1="42" x2="9"  y2="53"/>
        <line x1="19" y1="42" x2="15" y2="53"/>
        <line x1="25" y1="42" x2="21" y2="53"/>
      </g>
      <!-- tail lights -->
      <ellipse cx="9.5"  cy="56.5" rx="2.2" ry="1" fill="#ff4d4f" opacity="0.8"/>
      <ellipse cx="26.5" cy="56.5" rx="2.2" ry="1" fill="#ff4d4f" opacity="0.8"/>
    </svg>
  `

  const pulse = isPulsing ? `<div class="erp-fleet-marker-pulse" style="--pulse-color:${c.glow}"></div>` : ''
  const safeLabel = escapeHtml(v.plate)

  const html = `
    <div class="erp-fleet-marker-wrap">
      ${pulse}
      <div class="erp-fleet-marker-vehicle">${carSvg}</div>
      <div class="erp-fleet-marker-plate" style="background:${c.base};color:${c.text};border-color:${c.dark};">${safeLabel}</div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'erp-fleet-marker',
    iconSize: [80, 90],
    iconAnchor: [40, 60],
    popupAnchor: [0, -56],
  })
}

function formatHM(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '00 giờ 00 phút'
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return `${String(h).padStart(2, '0')} giờ ${String(m).padStart(2, '0')} phút`
}

function row(label: string, value: string | null | undefined, valueClass = ''): string {
  if (value == null || value === '') return ''
  return `<div class="erp-bm-row"><span class="erp-bm-lbl">${label}:</span><span class="erp-bm-val ${valueClass}">${value}</span></div>`
}

function boolDot(b: boolean | null | undefined, onText: string, offText: string): string {
  if (b == null) return '—'
  const cls = b ? 'erp-bm-good' : 'erp-bm-muted'
  return `<span class="${cls}">${b ? onText : offText}</span>`
}

function signalLabel(b: boolean | null | undefined): string {
  if (b == null) return '—'
  return b ? '<span class="erp-bm-good">Tốt</span>' : '<span class="erp-bm-bad">Mất</span>'
}

function buildPopupHtml(v: GpsMapVehicle): string {
  const tone = statusToTone(v)
  const c = colorForTone(tone)

  // ─── Cột trái: Hardware + Vehicle ───
  const leftCol: string[] = []
  leftCol.push(row('Biển số', `<strong style="font-family: ui-monospace, monospace; color:${c.dark}">${escapeHtml(v.plate)}</strong>`))
  leftCol.push(row('VIN', escapeHtml(v.vin)))
  leftCol.push(row('GPS', signalLabel(v.has_gps)))
  leftCol.push(row('Điện áp', v.voltage != null ? `<span class="erp-bm-num ${v.voltage < 11.5 ? 'erp-bm-bad' : v.voltage < 12 ? 'erp-bm-warn' : 'erp-bm-good'}">${v.voltage.toFixed(1)} V</span>` : null))
  leftCol.push(row('Loại xe', escapeHtml(v.vehicle_type)))
  leftCol.push(row('Km cuốc', v.km_today != null && v.km_today > 0 ? `<span class="erp-bm-num">${v.km_today.toFixed(1)} km</span>` : null))
  leftCol.push(row('Máy', boolDot(v.key_on, 'Bật', 'Tắt')))
  leftCol.push(row('Điều hòa', boolDot(v.ac_on, 'Bật', 'Tắt')))
  leftCol.push(row('SL dừng đỗ', v.stop_counter != null ? `<span class="erp-bm-num">${v.stop_counter}</span>` : null))
  leftCol.push(row('SL quá tốc độ', v.overspeed_count != null ? `<span class="erp-bm-num ${v.overspeed_count > 0 ? 'erp-bm-bad' : ''}">${v.overspeed_count}</span>` : null))
  leftCol.push(row('Quá tg trong ngày', v.over_4h_count != null ? `<span class="erp-bm-num ${v.over_4h_count > 0 ? 'erp-bm-warn' : ''}">${v.over_4h_count}</span>` : null))

  // ─── Cột phải ───
  const rightCol: string[] = []
  rightCol.push(row('Sở XD', 'TP Hồ Chí Minh'))
  rightCol.push(row('GSM', signalLabel(v.has_gsm)))
  rightCol.push(row('Trọng tải', v.trong_tai != null ? `<span class="erp-bm-num">${v.trong_tai} tấn</span>` : escapeHtml(v.capacity)))
  rightCol.push(row('Km tổng', v.km_total != null ? `<span class="erp-bm-num">${Number(v.km_total).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km</span>` : null))
  rightCol.push(row('Mức NL', v.fuel_pct != null ? `<span class="erp-bm-num">${v.fuel_pct.toFixed(0)} L</span>` : null))
  rightCol.push(row('Cửa xe', boolDot(v.door_open, 'Mở', 'Đóng')))
  rightCol.push(row('Tốc độ', `<span class="erp-bm-num ${v.is_overspeed ? 'erp-bm-bad' : ''}">${(v.speed ?? 0).toFixed(0)} km/h${v.is_overspeed ? ' ⚠' : ''}</span>`))
  rightCol.push(row('Quá tg liên tục', v.over_10h_count != null ? `<span class="erp-bm-num ${v.over_10h_count > 0 ? 'erp-bm-bad' : ''}">${v.over_10h_count}</span>` : null))

  // ─── Driver section ───
  const driverRows: string[] = []
  driverRows.push(row('Tên lái xe', escapeHtml(v.driver_name) || '<span class="erp-bm-muted">Chưa đăng nhập</span>'))
  driverRows.push(row('GPLX', escapeHtml(v.driver_license)))
  driverRows.push(row('TGLX liên tục', `<span class="erp-bm-num ${(v.over_10h_count ?? 0) > 0 ? 'erp-bm-bad' : (v.over_4h_count ?? 0) > 0 ? 'erp-bm-warn' : ''}">${formatHM(v.driving_time)}</span>`))
  driverRows.push(row('TG lái xe trong ngày', `<span class="erp-bm-num">${formatHM(v.day_driving_time)}</span>`))
  if (v.begin_stop) driverRows.push(row('Thời điểm xe dừng', escapeHtml(v.begin_stop)))
  if (v.stop_time && v.stop_time !== '00:00:00') driverRows.push(row('Thời gian xe dừng', escapeHtml(v.stop_time)))
  driverRows.push(row('Cập nhật', escapeHtml(v.time_update)))

  return `
    <div class="erp-bm-popup">
      <div class="erp-bm-header">
        <div class="erp-bm-title">Thông tin xe</div>
        <div class="erp-bm-status-pill" style="background:${c.glow};color:${c.dark}">
          <span class="erp-bm-dot" style="background:${c.base}"></span>${toneLabel(tone)}
        </div>
      </div>
      <div class="erp-bm-grid">
        <div class="erp-bm-col">${leftCol.filter(Boolean).join('')}</div>
        <div class="erp-bm-col">${rightCol.filter(Boolean).join('')}</div>
      </div>
      <div class="erp-bm-sub-title">Thông tin lái xe</div>
      <div class="erp-bm-driver">${driverRows.filter(Boolean).join('')}</div>
      ${v.address ? `<div class="erp-bm-area"><strong>Khu vực:</strong> ${escapeHtml(v.address)}</div>` : ''}
    </div>
  `
}

export default function GpsLiveMap({ vehicles, focusedGpsId, focusTick = 0, onMarkerClick, height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markerRefs = useRef<Map<string, L.Marker>>(new Map())
  const hasFittedRef = useRef(false)
  const clickHandlerRef = useRef<((id: string) => void) | undefined>(onMarkerClick)
  clickHandlerRef.current = onMarkerClick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    })

    const voyagerLayer = L.tileLayer(TILE_LAYERS.voyager.url, {
      attribution: TILE_LAYERS.voyager.attribution,
      subdomains: TILE_LAYERS.voyager.subdomains,
      maxZoom: TILE_LAYERS.voyager.maxZoom,
    }).addTo(map)
    const osmLayer = L.tileLayer(TILE_LAYERS.osm.url, {
      attribution: TILE_LAYERS.osm.attribution,
      subdomains: TILE_LAYERS.osm.subdomains,
      maxZoom: TILE_LAYERS.osm.maxZoom,
    })
    const satelliteLayer = L.tileLayer(TILE_LAYERS.satellite.url, {
      attribution: TILE_LAYERS.satellite.attribution,
      maxZoom: TILE_LAYERS.satellite.maxZoom,
    })
    L.control
      .layers(
        { 'Bản đồ': voyagerLayer, 'OSM': osmLayer, 'Vệ tinh': satelliteLayer },
        undefined,
        { position: 'topright', collapsed: true },
      )
      .addTo(map)

    L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map)

    const group = L.layerGroup().addTo(map)
    mapRef.current = map
    layerRef.current = group

    const t = setTimeout(() => map.invalidateSize(), 100)
    return () => {
      clearTimeout(t)
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  const validVehicles = useMemo(
    () =>
      vehicles.filter(
        (v) =>
          typeof v.lat === 'number' &&
          typeof v.lng === 'number' &&
          !Number.isNaN(v.lat) &&
          !Number.isNaN(v.lng) &&
          (v.lat !== 0 || v.lng !== 0),
      ),
    [vehicles],
  )

  // Diff-based marker update: reuse existing L.Marker instances instead of
  // clearLayers() + rebuild. Keeps map viewport intact and open popups open
  // across auto-refreshes.
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return

    const newIds = new Set(validVehicles.map(v => v.gps_id))

    // 1) Remove markers no longer in the set
    for (const [id, marker] of markerRefs.current.entries()) {
      if (!newIds.has(id)) {
        marker.remove()
        markerRefs.current.delete(id)
      }
    }

    // 2) Add new markers or update existing ones in place
    for (const v of validVehicles) {
      const existing = markerRefs.current.get(v.gps_id)
      if (existing) {
        existing.setLatLng([v.lat as number, v.lng as number])
        existing.setIcon(buildDivIcon(v))
        existing.setPopupContent(buildPopupHtml(v))
      } else {
        const marker = L.marker([v.lat as number, v.lng as number], {
          icon: buildDivIcon(v),
          riseOnHover: true,
        }).addTo(layerRef.current)
        marker.bindPopup(buildPopupHtml(v), {
          className: 'erp-fleet-popup-wrap',
          closeButton: true,
          offset: [0, -4],
          maxWidth: 380,
          minWidth: 240,
        })
        marker.on('click', () => clickHandlerRef.current?.(v.gps_id))
        markerRefs.current.set(v.gps_id, marker)
      }
    }

    // 3) Fit bounds ONLY on first load — never on auto-refresh.
    //    User can pan/zoom freely without being snapped back.
    if (!hasFittedRef.current && validVehicles.length > 0) {
      if (validVehicles.length === 1) {
        mapRef.current.setView([validVehicles[0].lat as number, validVehicles[0].lng as number], 14)
      } else {
        const bounds = L.latLngBounds(
          validVehicles.map(v => [v.lat as number, v.lng as number]),
        )
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
      }
      hasFittedRef.current = true
    }
  }, [validVehicles])

  // Fly to focused marker — only on explicit user action (click row / marker).
  // Does NOT re-fire on auto-refresh (validVehicles intentionally excluded).
  useEffect(() => {
    if (!focusedGpsId || !mapRef.current) return
    const marker = markerRefs.current.get(focusedGpsId)
    if (!marker) return
    mapRef.current.flyTo(marker.getLatLng(), 16, { duration: 0.8 })
    marker.openPopup()
  }, [focusedGpsId, focusTick])

  return (
    <>
      <div
        ref={containerRef}
        style={{
          height,
          width: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #f0f0f0',
        }}
      />
      <style>{`
        .erp-fleet-marker { background: transparent !important; border: none !important; }
        .erp-fleet-marker-wrap {
          position: relative; width: 80px; height: 90px;
          display: flex; flex-direction: column; align-items: center;
        }
        .erp-fleet-marker-vehicle {
          position: relative; width: 36px; height: 64px;
          filter: drop-shadow(0 3px 4px rgba(0,0,0,0.32));
        }
        .erp-fleet-marker-vehicle svg { display: block; width: 100%; height: 100%; }
        .erp-fleet-marker-plate {
          margin-top: 3px; padding: 1px 6px;
          font-size: 10.5px; font-weight: 700;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.3px;
          border: 1px solid; border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          white-space: nowrap; line-height: 1.3;
          text-align: center; position: relative;
        }
        .erp-fleet-marker-plate::before {
          content: ""; position: absolute; top: -4px; left: 50%;
          transform: translateX(-50%);
          width: 0; height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 4px solid currentColor;
          opacity: 0.6;
        }
        .erp-fleet-marker-pulse {
          position: absolute; width: 40px; height: 40px;
          border-radius: 50%;
          background: var(--pulse-color, rgba(16,185,129,0.4));
          animation: erp-fleet-pulse 1.8s ease-out infinite;
          pointer-events: none;
          top: 12px; left: 50%;
          transform: translate(-50%, 0);
          z-index: -1;
        }
        @keyframes erp-fleet-pulse {
          0% { transform: translate(-50%, 0) scale(0.6); opacity: 0.9; }
          100% { transform: translate(-50%, 0) scale(2.4); opacity: 0; }
        }
        .erp-fleet-popup-wrap .leaflet-popup-content-wrapper {
          background: #fff; border-radius: 10px;
          box-shadow: 0 12px 32px -12px rgba(0,0,0,0.35), 0 4px 8px -4px rgba(0,0,0,0.12);
          padding: 0;
        }
        .erp-fleet-popup-wrap .leaflet-popup-content { margin: 0; font-size: 12.5px; line-height: 1.55; min-width: 240px; }
        .erp-fleet-popup { padding: 12px 14px; }
        .erp-fleet-popup-header {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
          padding-bottom: 10px; margin-bottom: 8px;
          border-bottom: 1px solid #f0f0f0;
        }
        .erp-fleet-popup-plate {
          display: inline-block; padding: 2px 8px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-weight: 700; font-size: 13px;
          border-radius: 5px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .erp-fleet-popup-status {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 8px; border-radius: 999px;
          font-size: 11px; font-weight: 600; white-space: nowrap;
        }
        .erp-fleet-popup-dot { width: 6px; height: 6px; border-radius: 50%; }
        .erp-fleet-popup-grid {
          display: grid; grid-template-columns: auto 1fr;
          gap: 4px 10px; font-size: 12px; margin: 4px 0 8px;
        }
        .erp-fleet-popup-grid dt { color: #8c8c8c; font-weight: 500; white-space: nowrap; }
        .erp-fleet-popup-grid dd { color: #262626; font-weight: 500; text-align: right; word-break: break-word; margin: 0; }
        .erp-fleet-popup-grid dd.erp-fleet-num {
          font-variant-numeric: tabular-nums;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11.5px;
        }
        .erp-fleet-popup-grid dd.erp-fleet-bad { color: #cf1322; }
        .erp-fleet-popup-grid dd.erp-fleet-warn { color: #d46b08; }
        .erp-fleet-popup-grid dd.erp-fleet-good { color: #389e0d; }
        .erp-fleet-popup-address {
          margin-top: 8px; padding-top: 8px;
          border-top: 1px solid #f0f0f0;
          color: #8c8c8c; font-size: 11.5px; line-height: 1.5;
        }
        .erp-fleet-popup-address strong { color: #262626; font-weight: 600; }
        .erp-fleet-fuel-bar { display: inline-flex; align-items: center; gap: 6px; width: 100%; justify-content: flex-end; }
        .erp-fleet-fuel-bar-track { flex: 1; max-width: 70px; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
        .erp-fleet-fuel-bar-fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #10b981); transition: width 0.4s ease; }

        /* ─── BM-style popup ─── */
        .erp-fleet-popup-wrap .leaflet-popup-content { min-width: 380px !important; }
        .erp-bm-popup { padding: 10px 12px; font-size: 12px; line-height: 1.45; }
        .erp-bm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 6px; margin-bottom: 8px;
          border-bottom: 2px solid #e8f0fe;
        }
        .erp-bm-title { font-weight: 700; font-size: 13px; color: #1677ff; }
        .erp-bm-status-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 2px 8px; border-radius: 999px;
          font-size: 11px; font-weight: 600;
        }
        .erp-bm-dot { width: 6px; height: 6px; border-radius: 50%; }
        .erp-bm-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px;
        }
        .erp-bm-col { display: flex; flex-direction: column; gap: 3px; }
        .erp-bm-row {
          display: flex; justify-content: space-between; gap: 8px;
          padding: 2px 0;
          border-bottom: 1px dashed #f0f0f0;
        }
        .erp-bm-lbl { color: #595959; flex-shrink: 0; }
        .erp-bm-val { color: #262626; font-weight: 500; text-align: right; word-break: break-word; }
        .erp-bm-num { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .erp-bm-good { color: #389e0d; font-weight: 600; }
        .erp-bm-warn { color: #d46b08; font-weight: 600; }
        .erp-bm-bad { color: #cf1322; font-weight: 600; }
        .erp-bm-muted { color: #bfbfbf; font-style: italic; }
        .erp-bm-sub-title {
          margin-top: 8px; padding-top: 6px;
          font-weight: 700; font-size: 12.5px; color: #1677ff;
          border-top: 2px solid #e8f0fe;
        }
        .erp-bm-driver { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; }
        .erp-bm-area {
          margin-top: 8px; padding-top: 6px;
          border-top: 1px solid #f0f0f0;
          font-size: 11.5px; color: #595959;
        }
        .erp-bm-area strong { color: #262626; font-weight: 600; }
      `}</style>
    </>
  )
}
