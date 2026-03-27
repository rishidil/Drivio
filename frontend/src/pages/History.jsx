import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { MapPin, Fuel, DollarSign, Clock, TrendingUp } from 'lucide-react'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export default function History({ session }) {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRides = async () => {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('user_id', session.user.id)
        .order('started_at', { ascending: false })
      setRides(data || [])
      setLoading(false)
    }
    fetchRides()
  }, [session])

  const totalMiles = rides.reduce((sum, r) => sum + (r.distance_miles || 0), 0)
  const totalCost = rides.reduce((sum, r) => sum + (r.gas_cost || 0), 0)
  const totalGas = rides.reduce((sum, r) => sum + (r.gas_used || 0), 0)

  return (
    <Layout session={session}>
      <div className="max-w-xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold mb-1"
            style={{ fontFamily: 'Syne, sans-serif' }}>
            History
          </h1>
          <p className="text-zinc-400 text-sm">
            All your business trips in one place.
          </p>
        </div>

        {/* Summary cards */}
        {rides.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <p className="text-zinc-500 text-xs">Total miles</p>
              </div>
              <p className="text-white text-lg font-bold"
                style={{ fontFamily: 'Syne, sans-serif' }}>
                {totalMiles.toFixed(1)}
              </p>
              <p className="text-zinc-500 text-xs">miles</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Fuel className="w-3 h-3 text-emerald-400" />
                <p className="text-zinc-500 text-xs">Gas used</p>
              </div>
              <p className="text-white text-lg font-bold"
                style={{ fontFamily: 'Syne, sans-serif' }}>
                {totalGas.toFixed(2)}
              </p>
              <p className="text-zinc-500 text-xs">gallons</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <p className="text-zinc-500 text-xs">Total cost</p>
              </div>
              <p className="text-white text-lg font-bold"
                style={{ fontFamily: 'Syne, sans-serif' }}>
                ${totalCost.toFixed(2)}
              </p>
              <p className="text-zinc-500 text-xs">fuel</p>
            </div>
          </div>
        )}

        {/* Rides list */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-zinc-500 text-sm">Loading trips...</p>
          </div>
        ) : rides.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <MapPin className="w-8 h-8 text-zinc-700 mb-3" />
            <p className="text-zinc-400 text-sm font-medium">No trips yet</p>
            <p className="text-zinc-600 text-xs mt-1">Start your first trip to see it here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rides.map((ride) => (
              <div key={ride.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">

                {/* Date and distance badge */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-zinc-500 text-xs">
                    {formatDate(ride.started_at)}
                  </p>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                    {ride.distance_miles} mi
                  </span>
                </div>

                {/* Route */}
                <div className="flex flex-col gap-1.5 mb-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                    <p className="text-white text-sm leading-tight">{ride.start_address}</p>
                  </div>
                  <div className="w-px h-3 bg-zinc-700 ml-1" />
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                    <p className="text-white text-sm leading-tight">{ride.end_address}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <Fuel className="w-3 h-3 text-zinc-500" />
                    <span className="text-zinc-400 text-xs">{ride.gas_used} gal</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-zinc-500" />
                    <span className="text-zinc-400 text-xs">${ride.gas_cost}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span className="text-zinc-400 text-xs">{formatDuration(ride.duration_seconds)}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}