# Quick Start - Push naar GitHub

## Stap 1: Maak GitHub Repository aan

1. Ga naar https://github.com/new
2. Repository name: `manege-klantenwebapp` (of kies je eigen naam)
3. Description: "Next.js klantenwebapp voor Manege Duikse Hoef"
4. Kies **Private** (aanbevolen)
5. **DON'T** vink aan: "Add a README file", "Add .gitignore", of "Choose a license"
6. Klik **"Create repository"**

## Stap 2: Push naar GitHub

### Optie A: Gebruik het PowerShell script (Windows)

1. Open PowerShell in de `nieuwe app - kopie` directory
2. Open `push-to-github.ps1` in een editor
3. Pas aan:
   ```powershell
   $GITHUB_USERNAME = "jouw-github-username"
   $REPO_NAME = "manege-klantenwebapp"
   ```
4. Voer uit:
   ```powershell
   .\push-to-github.ps1
   ```

### Optie B: Handmatig (alle platforms)

```bash
# Vervang JOUW-USERNAME en manege-klantenwebapp met jouw gegevens
git remote add origin https://github.com/JOUW-USERNAME/manege-klantenwebapp.git
git branch -M main
git push -u origin main
```

## Stap 3: Deploy naar Vercel

1. Ga naar https://vercel.com
2. Klik **"Add New Project"**
3. Import je GitHub repository
4. Configureer:
   - Framework: Next.js (auto-detect)
   - Root Directory: `/` (laat leeg)
5. **Environment Variables toevoegen:**
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://cdoadjyktlrgungskhvn.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkb2FkanlrdGxyZ3VuZ3NraHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTY3ODksImV4cCI6MjA4MTI3Mjc4OX0.YdYs_tc-v0wZC0hpyzAlRbjF88v5CVVXBvn3_hZ_gVc`
6. Klik **"Deploy"**

## Troubleshooting

### "Repository not found"
- Check of je de repository naam correct hebt gespeld
- Check of de repository bestaat op GitHub
- Check of je toegang hebt tot de repository

### "Authentication failed"
- Gebruik GitHub Personal Access Token in plaats van wachtwoord
- Of gebruik SSH: `git@github.com:USERNAME/REPO.git`

### "Permission denied"
- Check of je de juiste GitHub username gebruikt
- Check of je toegang hebt tot de repository

## Hulp nodig?

Zie `SETUP_GITHUB.md` voor uitgebreide instructies.
Zie `DEPLOYMENT.md` voor Vercel deployment details.






