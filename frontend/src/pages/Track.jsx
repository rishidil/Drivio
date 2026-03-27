import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { MapPin, Clock, Fuel, DollarSign, Navigation, AlertTriangle } from 'lucide-react'

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function reverseGeocode(lat, lng, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(
        `https://api.openrouteservice.org/geocode/reverse?api_key=${ORS_API_KEY}&point.lon=${lng}&point.lat=${lat}&size=1&layers=address,street,neighbourhood,locality`
      )
      const data = await res.json()
      if (data.features && data.features.length > 0) {
        const props = data.features[0].properties
        // Build a clean address from components
        const parts = [
          props.housenumber && props.street ? `${props.housenumber} ${props.street}` : props.street,
          props.locality || props.neighbourhood || props.county,
          props.region_a || props.region,
        ].filter(Boolean)
        if (parts.length > 0) return parts.join(', ')
        if (props.label) return props.label
      }
    } catch (e) {
      console.warn(`Geocode attempt ${i + 1} failed:`, e)
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000))
    }
  }
  // Clean coordinate fallback
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calculateTotalDistance(points) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    )
  }
  return total
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Track({ session }) {
  const [settings, setSettings] = useState(null)
  const [tracking, setTracking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [pendingRide, setPendingRide] = useState(null)
  const [tripName, setTripName] = useState('')
  const [error, setError] = useState(null)
  const [pointsCollected, setPointsCollected] = useState(0)

  const startData = useRef(null)
  const gpsPoints = useRef([])
  const timerRef = useRef(null)
  const gpsRef = useRef(null)

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setSettings(data)
    }
    fetchSettings()
  }, [session])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearInterval(gpsRef.current)
    }
  }, [])

  const getPosition = () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000
    })
  })

  const collectGpsPoint = async () => {
    try {
      const pos = await getPosition()
      const point = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: new Date().toISOString()
      }
      gpsPoints.current.push(point)
      setPointsCollected(gpsPoints.current.length)
    } catch (e) {
      console.warn('GPS point collection failed:', e)
    }
  }

  const handleStart = async () => {
    setError(null)
    setLoading(true)
    setPendingRide(null)
    setTripName('')
    gpsPoints.current = []
    setPointsCollected(0)

    try {
      const pos = await getPosition()
      const { latitude, longitude } = pos.coords
      const address = await reverseGeocode(latitude, longitude)

      const firstPoint = { lat: latitude, lng: longitude, timestamp: new Date().toISOString() }
      gpsPoints.current.push(firstPoint)
      setPointsCollected(1)

      startData.current = {
        lat: latitude,
        lng: longitude,
        address,
        time: new Date().toISOString()
      }

      setTracking(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      gpsRef.current = setInterval(collectGpsPoint, 30000)

    } catch (e) {
      setError('Could not get your location. Please allow location access and try again.')
    }

    setLoading(false)
  }

  const handleEnd = async () => {
    setError(null)
    setLoading(true)
    clearInterval(timerRef.current)
    clearInterval(gpsRef.current)
    setTracking(false)

    try {
      await collectGpsPoint()
      const points = gpsPoints.current

      if (points.length < 2) {
        throw new Error('Not enough GPS data collected. Make sure location access is enabled.')
      }

      const lastPoint = points[points.length - 1]
      const endAddress = await reverseGeocode(lastPoint.lat, lastPoint.lng)
      const endTime = new Date().toISOString()
      const distanceMiles = calculateTotalDistance(points)

      if (distanceMiles < 0.01) {
        throw new Error('Trip distance too short to record. Did you actually drive somewhere?')
      }

      const gasUsed = distanceMiles / settings.mpg
      const gasCost = gasUsed * settings.gas_price

      // Store pending ride — wait for user to name it before saving
      setPendingRide({
        user_id: session.user.id,
        started_at: startData.current.time,
        ended_at: endTime,
        start_lat: startData.current.lat,
        start_lng: startData.current.lng,
        end_lat: lastPoint.lat,
        end_lng: lastPoint.lng,
        start_address: startData.current.address,
        end_address: endAddress,
        distance_miles: parseFloat(distanceMiles.toFixed(2)),
        gas_used: parseFloat(gasUsed.toFixed(3)),
        gas_cost: parseFloat(gasCost.toFixed(2)),
        duration_seconds: seconds
      })

      setSeconds(0)
      startData.current = null
      gpsPoints.current = []
      setPointsCollected(0)

    } catch (e) {
      setError(e.message || 'Something went wrong ending the trip.')
    }

    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const rideData = {
        ...pendingRide,
        name: tripName.trim() || null
      }

      const res = await fetch(`${API_URL}/rides/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rideData)
      })

      if (!res.ok) throw new Error('Failed to save ride')
      setPendingRide(null)
      setTripName('')
    } catch (e) {
      setError('Failed to save trip. Please try again.')
    }
    setSaving(false)
  }

  return (
    <Layout session={session}>
      <div className="max-w-xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold mb-1"
            style={{ fontFamily: 'Syne, sans-serif' }}>
            Track Trip
          </h1>
          <p className="text-zinc-400 text-sm">
            {settings
              ? `${settings.vehicle_name || 'Your vehicle'} · ${settings.mpg} MPG · $${settings.gas_price}/gal`
              : 'Loading your vehicle settings...'}
          </p>
        </div>

        {/* Background tracking warning */}
        {!tracking && !pendingRide && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300 text-xs leading-relaxed">
              Keep Drivio open while driving. To prevent your screen from locking, go to{' '}
              <span className="font-medium text-amber-200">Settings → Display & Brightness → Auto-Lock → Never</span>
              {' '}on iPhone, or{' '}
              <span className="font-medium text-amber-200">Settings → Display → Screen Timeout → Never</span>
              {' '}on Android. Remember to turn it back on after your trip.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Tracking card */}
        {tracking && (
          <div className="bg-zinc-900 border border-emerald-500/20 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-medium tracking-wide">
                  TRIP IN PROGRESS
                </span>
              </div>
              <span className="text-zinc-500 text-xs">
                {pointsCollected} GPS {pointsCollected === 1 ? 'point' : 'points'}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-4 h-4 text-zinc-500" />
              <span className="text-white text-4xl font-bold"
                style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-1px' }}>
                {formatTime(seconds)}
              </span>
            </div>

            <div className="flex items-start gap-2 mb-4">
              <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-400 text-sm">{startData.current?.address}</p>
            </div>

            <div className="pt-3 border-t border-zinc-800">
              <p className="text-zinc-600 text-xs">
                GPS recorded every 30 seconds · Keep this screen open
              </p>
            </div>
          </div>
        )}

        {/* Start / End button */}
        {!pendingRide && (
          <button
            onClick={tracking ? handleEnd : handleStart}
            disabled={loading || !settings}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2 mb-4 ${
              tracking
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white'
            }`}
          >
            <Navigation className="w-4 h-4" />
            {loading ? 'Please wait...' : tracking ? 'End Trip' : 'Start Trip'}
          </button>
        )}

        {/* Trip naming + summary — shown after ending */}
        {pendingRide && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-white text-base font-semibold mb-1"
              style={{ fontFamily: 'Syne, sans-serif' }}>
              Trip Summary
            </h2>
            <p className="text-zinc-500 text-xs mb-5">
              Name your trip before saving for easy tax reference.
            </p>

            {/* Trip name input */}
            <div className="mb-5">
              <label className="text-zinc-400 text-xs font-medium mb-1.5 block">
                Trip name (optional)
              </label>
              <input
                type="text"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
                placeholder="e.g. Client meeting downtown"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Route */}
            <div className="flex flex-col gap-1.5 mb-5 pb-5 border-b border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Start</p>
                  <p className="text-white text-sm">{pendingRide.start_address}</p>
                </div>
              </div>
              <div className="w-px h-3 bg-zinc-700 ml-1" />
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">End</p>
                  <p className="text-white text-sm">{pendingRide.end_address}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-zinc-800 rounded-xl p-3">
                <p className="text-zinc-500 text-xs mb-1">Distance</p>
                <p className="text-white text-lg font-bold"
                  style={{ fontFamily: 'Syne, sans-serif' }}>
                  {pendingRide.distance_miles}
                </p>
                <p className="text-zinc-500 text-xs">miles</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3">
                <Fuel className="w-3 h-3 text-zinc-500 mb-1" />
                <p className="text-white text-lg font-bold"
                  style={{ fontFamily: 'Syne, sans-serif' }}>
                  {pendingRide.gas_used}
                </p>
                <p className="text-zinc-500 text-xs">gallons</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3">
                <DollarSign className="w-3 h-3 text-zinc-500 mb-1" />
                <p className="text-white text-lg font-bold"
                  style={{ fontFamily: 'Syne, sans-serif' }}>
                  ${pendingRide.gas_cost}
                </p>
                <p className="text-zinc-500 text-xs">fuel cost</p>
              </div>
            </div>

            {/* Save + discard buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-medium text-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save Trip'}
              </button>
              <button
                onClick={() => { setPendingRide(null); setTripName('') }}
                className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium text-sm transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Saved confirmation */}
        {!pendingRide && !tracking && !loading && (
          <p className="text-zinc-600 text-xs text-center">
            GPS will be recorded every 30 seconds during your trip
          </p>
        )}

      </div>
    </Layout>
  )
}