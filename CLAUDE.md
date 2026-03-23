# Drivio

A SaaS app for small business owners to track vehicle mileage and fuel costs for tax purposes.

## Stack
- Frontend: React + Vite + Tailwind CSS + React Query + Supabase JS client
- Backend: Python Flask
- Database: Supabase (Postgres)
- Auth: Supabase Auth with Google OAuth
- Distance: OpenRouteService API (free tier)
- Deploy: Vercel (frontend), Render (backend)

## Project Structure
- /frontend — React + Vite app
- /backend — Flask API
- /supabase/migrations — SQL migration files

## Key business logic
- Gas used = distance_miles / mpg
- Gas cost = gas_used * gas_price_per_gallon
- MPG and gas price are set per user in user_settings table
- Distance is calculated via OpenRouteService routing API (not straight line)
- Location is captured via browser Geolocation API

## Environment variables
Frontend (.env): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ORS_API_KEY
Backend (.env): SUPABASE_URL, SUPABASE_SERVICE_KEY, FLASK_SECRET_KEY

## Database tables
- user_settings: id, mpg, gas_price, vehicle_name
- rides: id, user_id, started_at, ended_at, start/end lat/lng/address, distance_miles, gas_used, gas_cost, duration_seconds

## Commands
- Frontend dev: cd frontend && npm run dev
- Backend dev: cd backend && flask run