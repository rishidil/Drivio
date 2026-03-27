import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Track from './pages/Track'
import History from './pages/History'
import Settings from './pages/Settings'

const queryClient = new QueryClient()

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-zinc-950">
      <p className="text-zinc-400 text-sm">Loading...</p>
    </div>
  )

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/track" />} />
          <Route path="/track" element={session ? <Track session={session} /> : <Navigate to="/login" />} />
          <Route path="/history" element={session ? <History session={session} /> : <Navigate to="/login" />} />
          <Route path="/settings" element={session ? <Settings session={session} /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to={session ? "/track" : "/login"} />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App