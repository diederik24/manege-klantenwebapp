# Deployment Guide - Manege Klantenwebapp

Deze guide helpt je bij het deployen van de Next.js klantenwebapp naar Vercel.

## Vereisten

- GitHub account
- Vercel account (gratis)
- Supabase project met database setup

## Stap 1: Push naar GitHub

```bash
# Navigeer naar de app directory
cd "nieuwe app - kopie"

# Initialiseer git (als nog niet gedaan)
git init

# Voeg alle files toe
git add .

# Maak eerste commit
git commit -m "Initial commit: Manege Klantenwebapp"

# Maak een nieuwe repository op GitHub en voeg remote toe
git remote add origin https://github.com/jouw-username/manege-klantenwebapp.git

# Push naar GitHub
git branch -M main
git push -u origin main
```

## Stap 2: Database Setup

Zorg dat je de volgende SQL scripts hebt uitgevoerd in Supabase SQL Editor:

1. **setup-klantapp-leskaarten-view.sql**
   - Maakt schema `klantappversie1`
   - Maakt views en tabellen voor leskaarten
   - Setup RLS policies

2. **setup-klantapp-rpc-functions.sql**
   - Maakt RPC functions voor data ophalen
   - Zorgt dat views toegankelijk zijn via Supabase client

## Stap 3: Vercel Deployment

### Optie A: Via Vercel Dashboard (Aanbevolen)

1. Ga naar [vercel.com](https://vercel.com) en log in
2. Klik op **"Add New Project"**
3. Selecteer je GitHub repository
4. Configureer het project:
   - **Framework Preset**: Next.js (automatisch gedetecteerd)
   - **Root Directory**: `/` (laat leeg)
   - **Build Command**: `npm run build` (standaard)
   - **Output Directory**: `.next` (standaard)
   - **Install Command**: `npm install` (standaard)

5. **Environment Variables** toevoegen:
   - Klik op "Environment Variables"
   - Voeg toe:
     ```
     NEXT_PUBLIC_SUPABASE_URL = je-supabase-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY = je-supabase-anon-key
     ```
   - Selecteer alle environments (Production, Preview, Development)

6. Klik **"Deploy"**

### Optie B: Via Vercel CLI

```bash
# Installeer Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd "nieuwe app - kopie"
vercel

# Volg de prompts
# - Link to existing project? N (nieuw project)
# - Project name: manege-klantenwebapp
# - Directory: ./
# - Override settings? N

# Voeg environment variables toe
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy naar productie
vercel --prod
```

## Stap 4: Verificatie

Na deployment:

1. Open de Vercel deployment URL
2. Test de login functionaliteit
3. Check of leskaarten worden getoond
4. Test alle pagina's

## Stap 5: Custom Domain (Optioneel)

1. Ga naar Project Settings > Domains
2. Voeg je custom domain toe (bijv. `klanten.manege-duikse-hoef.nl`)
3. Volg de DNS instructies
4. Wacht op SSL certificaat (automatisch)

## Continuous Deployment

Vercel deployt automatisch bij:
- Push naar `main` branch → Production deployment
- Push naar andere branches → Preview deployment
- Pull Requests → Preview deployment

## Environment Variables

Zorg dat deze altijd zijn ingesteld in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` - Je Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Je Supabase anon/public key

**Let op**: Gebruik NOOIT de service role key in client-side code!

## Monitoring

- **Vercel Dashboard**: Bekijk deployments, logs, en analytics
- **Supabase Dashboard**: Monitor database queries en auth usage
- **Error Tracking**: Overweeg Sentry of Vercel Analytics

## Troubleshooting

### Build faalt
- Check build logs in Vercel dashboard
- Test lokaal: `npm run build`
- Check environment variables

### App werkt niet na deployment
- Check environment variables
- Check Supabase RLS policies
- Check browser console voor errors

### Leskaarten worden niet getoond
- Check of account is gekoppeld: `SELECT * FROM klantappversie1.customer_accounts`
- Check of RPC functions bestaan
- Check Supabase logs

## Rollback

Als er een probleem is:

1. Ga naar Vercel Dashboard > Deployments
2. Vind de laatste werkende deployment
3. Klik op "..." > "Promote to Production"

## Support

Voor vragen of problemen, check:
- `TEST_KLANT_ACCOUNTS.md` - Setup en troubleshooting
- `README.md` - Algemene informatie
- Vercel Documentation
- Supabase Documentation

