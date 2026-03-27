import { NavLink, useNavigate } from 'react-router-dom'
import { Car, MapPin, History, Settings, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Layout({ children, session }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/track', icon: MapPin, label: 'Track' },
    { to: '/history', icon: History, label: 'History' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex">

      {/* Sidebar */}
      <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col fixed h-full">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Car className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-lg font-bold tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}>
            Drivio
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <img
              src={session?.user?.user_metadata?.avatar_url}
              alt="avatar"
              className="w-7 h-7 rounded-full"
              onError={(e) => e.target.style.display = 'none'}
            />
            <div className="flex-1 min-w-0">
              <p className="text-zinc-300 text-xs font-medium truncate">
                {session?.user?.user_metadata?.full_name || 'User'}
              </p>
              <p className="text-zinc-500 text-xs truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 p-8">
        {children}
      </main>
    </div>
  )
}