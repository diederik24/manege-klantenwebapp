# Setup: Direct Database Connectie

De API route haalt nu direct data uit de Supabase database in plaats van via de externe API.

## Stap 1: Installeer Dependencies

```bash
cd "nieuwe app - kopie"
npm install
```

Dit installeert `@supabase/supabase-js` die nodig is voor de database connectie.

## Stap 2: Maak .env.local bestand

Maak een `.env.local` bestand in de root van de `nieuwe app - kopie` directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://jouw-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Belangrijk:**
- Gebruik dezelfde Supabase credentials als in het hoofdproject
- `SUPABASE_SERVICE_ROLE_KEY` is nodig om RLS (Row Level Security) te bypassen
- Deze key vind je in Supabase Dashboard → Settings → API → service_role key

## Stap 3: Test de API

Start de development server:

```bash
npm run dev
```

Test de API route:

```bash
curl -H "X-API-Key: mk_l93k9_0Zc0kU3U0gv42NRYOxGZigLTuE9hCCDtwezDg" \
  http://localhost:3000/api/get-customer-data
```

Je zou nu JSON moeten krijgen met de klantdata direct uit de database!

## Wat is er veranderd:

1. ✅ `lib/supabase.ts` - Supabase client voor server-side operations
2. ✅ `app/api/get-customer-data/route.ts` - Haalt nu direct uit database
3. ✅ `package.json` - @supabase/supabase-js dependency toegevoegd

## Voordelen:

- ✅ Geen externe API calls meer nodig
- ✅ Sneller (direct database connectie)
- ✅ Betrouwbaarder (geen dependency op externe API)
- ✅ Werkt lokaal zonder internet verbinding naar externe API

## Troubleshooting:

**Error: "Missing Supabase environment variables"**
- Controleer of `.env.local` bestaat en de juiste variabelen bevat
- Herstart de development server na het aanmaken/wijzigen van `.env.local`

**Error: "Invalid or expired API key"**
- Controleer of de API key correct is
- Controleer of de API key actief is in de database

**Error: "Customer not found"**
- Controleer of de API key gekoppeld is aan een klant in de `api_keys` tabel

