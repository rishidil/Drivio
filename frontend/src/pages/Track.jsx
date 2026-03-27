import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { MapPin, Clock, Fuel, DollarSign, Navigation } from 'lucide-react'

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://api.openrouteservice.org/geocode/reverse?api_key=${ORS_API_KEY}&point.lon=${lng}&point.lat=${lat}&size=1`
    )
    const data = await res.json()
    if (data.features && data.features.length > 0) {
      return data.features[0].properties.label
    }
  } catch (e) {
    console.error('Geocode error:', e)
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8 // Earth radius in miles
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
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
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
  const [seconds, setSeconds] = useState(0)
  const [summary, setSummary] = useState(null)
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
    setSummary(null)
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

      // Timer - every second
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)

      // GPS collection - every 30 seconds
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
      // Collect final GPS point
      await collectGpsPoint()

      const points = gpsPoints.current
      if (points.length < 2) {
        throw new Error('Not enough GPS data collected. Make sure location access is enabled.')
      }

      const lastPoint = points[points.length - 1]
      const endAddress = await reverseGeocode(lastPoint.lat, lastPoint.lng)
      const endTime = new Date().toISOString()

      // Calculate total distance from all GPS points
      const distanceMiles = calculateTotalDistance(points)

      if (distanceMiles < 0.01) {
        throw new Error('Trip distance too short to record. Did you actually drive somewhere?')
      }

      const gasUsed = distanceMiles / settings.mpg
      const gasCost = gasUsed * settings.gas_price

      const rideData = {
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
      }

      const res = await fetch(`${API_URL}/rides/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rideData)
      })

      if (!res.ok) throw new Error('Failed to save ride')

      setSummary({ ...rideData, end_address: endAddress })
      setSeconds(0)
      startData.current = null
      gpsPoints.current = []
      setPointsCollected(0)

    } catch (e) {
      setError(e.message || 'Something went wrong ending the trip.')
    }

    setLoading(false)
  }

  return (
    <Layout session={session}>
      <div className="max-w-xl">

        {/* Header */}
        <div className="mb-8">
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

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Tracking card */}
        {tracking && (
          <div className="bg-zinc-900 border border-emerald-500/20 rounded-2xl p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-medium tracking-wide">
                  TRIP IN PROGRESS
                </span>
              </div>
              <span className="text-zinc-500 text-xs">
                {pointsCollected} GPS {pointsCollected === 1 ? 'point' : 'points'} collected
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-4 h-4 text-zinc-500" />
              <span className="text-white text-4xl font-bold"
                style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-1px' }}>
                {formatTime(seconds)}
              </span>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-400 text-sm">{startData.current?.address}</p>
            </div>

            {/* GPS trail indicator */}
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-zinc-600 text-xs">
                GPS recorded every 30 seconds · All points used to calculate total distance
              </p>
            </div>
          </div>
        )}

        {/* Start / End button */}
        {!summary && (
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

        {/* Idle hint */}
        {!tracking && !summary && (
          <p className="text-zinc-600 text-xs text-center">
            GPS will be recorded every 30 seconds during your trip
          </p>
        )}

        {/* Ride Summary */}
        {summary && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-white text-base font-semibold mb-5"
              style={{ fontFamily: 'Syne, sans-serif' }}>
              Trip Summary
            </h2>

            {/* Route */}
            <div className="flex flex-col gap-2 mb-5 pb-5 border-b border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Start</p>
                  <p className="text-white text-sm">{summary.start_address}</p>
                </div>
              </div>
              <div className="w-px h-4 bg-zinc-700 ml-1" />
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">End</p>
                  <p className="text-white text-sm">{summary.end_address}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-zinc-800 rounded-xl p-3">
                <p className="text-zinc-500 text-xs mb-1">Distance</p>
                <p className="text-white text-lg font-bold"
                  style={{ fontFamily: 'Syne, sans-serif' }}>
                  {summary.distance_miles}
                </p>
                <p className="text-zinc-500 text-xs">miles</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3">
                <Fuel className="w-3 h-3 text-zinc-500 mb-1" />
                <p className="text-white text-lg font-bold"
                  style={{ fontFamily: 'Syne, sans-serif' }}>
                  {summary.gas_used}
                </p>
                <p className="text-zinc-500 text-xs">gallons</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3">
                <DollarSign className="w-3 h-3 text-zinc-500 mb-1" />
                <p className="text-white text-lg font-bold"
                  style={{ fontFamily: 'Syne, sans-serif' }}>
                  ${summary.gas_cost}
                </p>
                <p className="text-zinc-500 text-xs">fuel cost</p>
              </div>
            </div>

            <button
              onClick={() => setSummary(null)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm transition-colors"
            >
              Start New Trip
            </button>
          </div>
        )}

      </div>
    </Layout>
  )
}