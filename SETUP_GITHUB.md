# GitHub Repository Setup

Deze repository is klaar om naar GitHub te worden gepusht.

## Stap 1: Maak een nieuwe GitHub Repository

1. Ga naar [GitHub](https://github.com) en log in
2. Klik op **"New repository"** (of ga naar https://github.com/new)
3. Vul in:
   - **Repository name**: `manege-klantenwebapp` (of een andere naam)
   - **Description**: "Next.js klantenwebapp voor Manege Duikse Hoef"
   - **Visibility**: Private (aanbevolen) of Public
   - **DON'T** initialiseer met README, .gitignore, of license (we hebben die al)
4. Klik **"Create repository"**

## Stap 2: Push naar GitHub

Open PowerShell of Terminal in de `nieuwe app - kopie` directory en voer uit:

```bash
# Voeg remote repository toe (vervang met jouw GitHub username en repo naam)
git remote add origin https://github.com/JOUW-USERNAME/manege-klantenwebapp.git

# Check of remote is toegevoegd
git remote -v

# Push naar GitHub
git branch -M main
git push -u origin main
```

**Let op**: Vervang `JOUW-USERNAME` en `manege-klantenwebapp` met je eigen GitHub username en repository naam.

## Stap 3: Verificatie

Na het pushen:
1. Ga naar je GitHub repository pagina
2. Check of alle files zichtbaar zijn
3. Check of README.md correct wordt weergegeven

## Volgende Stappen

Na het pushen naar GitHub kun je:
1. Deployen naar Vercel (zie `DEPLOYMENT.md`)
2. Team members toevoegen aan de repository
3. CI/CD pipelines instellen

## Troubleshooting

### "remote origin already exists"
```bash
# Verwijder bestaande remote
git remote remove origin

# Voeg opnieuw toe
git remote add origin https://github.com/JOUW-USERNAME/manege-klantenwebapp.git
```

### "Authentication failed"
- Gebruik GitHub Personal Access Token in plaats van wachtwoord
- Of gebruik SSH: `git@github.com:JOUW-USERNAME/manege-klantenwebapp.git`

### "Permission denied"
- Check of je toegang hebt tot de repository
- Check of de repository naam correct is

## Environment Variables

**BELANGRIJK**: Voeg NOOIT `.env.local` toe aan Git!

Maak een `.env.local` bestand aan (lokaal) met:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Dit bestand wordt automatisch genegeerd door `.gitignore`.



