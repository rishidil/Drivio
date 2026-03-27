import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { Car, Fuel, DollarSign, Save } from 'lucide-react'

export default function Settings({ session }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    vehicle_name: '',
    mpg: '',
    gas_price: ''
  })

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setForm({
          vehicle_name: data.vehicle_name || '',
          mpg: data.mpg || '',
          gas_price: data.gas_price || ''
        })
      }
      setLoading(false)
    }

    fetchSettings()
  }, [session])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('user_settings')
      .update({
        vehicle_name: form.vehicle_name,
        mpg: parseFloat(form.mpg),
        gas_price: parseFloat(form.gas_price)
      })
      .eq('id', session.user.id)

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  if (loading) return (
    <Layout session={session}>
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500 text-sm">Loading settings...</p>
      </div>
    </Layout>
  )

  return (
    <Layout session={session}>
      <div className="max-w-xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-white text-2xl font-bold mb-1"
            style={{ fontFamily: 'Syne, sans-serif' }}>
            Settings
          </h1>
          <p className="text-zinc-400 text-sm">
            Configure your vehicle details for accurate tracking.
          </p>
        </div>

        {/* Vehicle Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Car className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white text-sm font-semibold">Vehicle</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-zinc-400 text-xs font-medium mb-1.5 block">
                Vehicle name
              </label>
              <input
                type="text"
                name="vehicle_name"
                value={form.vehicle_name}
                onChange={handleChange}
                placeholder="e.g. 2021 Toyota RAV4"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-xs font-medium mb-1.5 block">
                Miles per gallon (MPG)
              </label>
              <input
                type="number"
                name="mpg"
                value={form.mpg}
                onChange={handleChange}
                placeholder="e.g. 28"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Fuel Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <Fuel className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white text-sm font-semibold">Fuel</h2>
          </div>

          <div>
            <label className="text-zinc-400 text-xs font-medium mb-1.5 block">
              Gas price per gallon (USD)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="number"
                name="gas_price"
                value={form.gas_price}
                onChange={handleChange}
                placeholder="e.g. 3.59"
                step="0.01"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium text-sm px-6 py-3 rounded-xl transition-colors duration-150"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save settings'}
        </button>

      </div>
    </Layout>
  )
}