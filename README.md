# Manege Duikse Hoef - Klantenwebapp

Een Next.js webapp voor klanten van Manege Duikse Hoef om hun lessen, leskaarten en profiel te beheren.

## Features

- 🔐 Supabase Auth authenticatie
- 📚 Leskaarten overzicht met resterende lessen
- 📅 Lessen planning en inschrijving
- 👤 Profiel beheer
- 📱 Mobile-first design

## Installatie

```bash
# Installeer dependencies
npm install

# Kopieer environment variables
cp .env.example .env.local

# Vul .env.local in met je Supabase credentials
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in je browser.

## Environment Variables

Maak een `.env.local` bestand aan met:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Haal deze waarden uit je Supabase Dashboard > Settings > API

## Database Setup

Zorg dat je de volgende SQL scripts hebt uitgevoerd in Supabase:

1. `setup-klantapp-leskaarten-view.sql` - Maakt views en tabellen voor leskaarten
2. `setup-klantapp-rpc-functions.sql` - Maakt RPC functions voor data ophalen

Zie `TEST_KLANT_ACCOUNTS.md` voor gedetailleerde setup instructies.

## Pagina's

- `/` - Redirect naar home of login
- `/auth-login` - Supabase Auth login/signup
- `/home` - Home/Dashboard met leskaart en komende lessen
- `/lessen` - Lessen overzicht met datum selector
- `/leskaarten` - Leskaarten overzicht (nieuw)
- `/profiel` - Profiel pagina met instellingen

## Technologie

- **Next.js 14** - React framework
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Backend (Auth + Database)

## Build & Deployment

### Build voor productie

```bash
npm run build
```

### Start productie server

```bash
npm start
```

### Deploy naar Vercel

1. Push deze repository naar GitHub
2. Ga naar [Vercel Dashboard](https://vercel.com)
3. Klik "New Project"
4. Import je GitHub repository
5. Configureer:
   - **Framework Preset**: Next.js
   - **Root Directory**: `/` (laat leeg)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (standaard)
6. Voeg Environment Variables toe:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
7. Deploy!

Vercel zal automatisch deployen bij elke push naar de main branch.

## Project Structuur

```
app/
  ├── api/              # API routes
  ├── auth-login/       # Supabase Auth login
  ├── home/             # Dashboard
  ├── leskaarten/       # Leskaarten overzicht
  ├── lessen/           # Lessen planning
  └── profiel/          # Profiel pagina
components/
  └── BottomNav.tsx     # Navigatie component
lib/
  ├── supabase-client.ts # Client-side Supabase client
  ├── supabase.ts       # Server-side Supabase client
  └── api.ts            # API helpers
```

## Troubleshooting

Zie `TEST_KLANT_ACCOUNTS.md` voor troubleshooting tips en veelgestelde vragen.

## License

Private - Manege Duikse Hoef



