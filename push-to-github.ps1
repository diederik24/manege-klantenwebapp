# PowerShell script om naar GitHub te pushen
# Pas de variabelen hieronder aan met jouw GitHub gegevens

$GITHUB_USERNAME = "JOUW-USERNAME"  # Vervang met jouw GitHub username
$REPO_NAME = "manege-klantenwebapp"  # Vervang met jouw repository naam

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub Push Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check of git remote al bestaat
$remoteExists = git remote get-url origin 2>$null
if ($remoteExists) {
    Write-Host "Remote 'origin' bestaat al: $remoteExists" -ForegroundColor Yellow
    $remove = Read-Host "Wil je deze verwijderen en opnieuw instellen? (j/n)"
    if ($remove -eq "j" -or $remove -eq "J") {
        git remote remove origin
        Write-Host "Remote verwijderd." -ForegroundColor Green
    } else {
        Write-Host "Gebruik bestaande remote." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Om te pushen, voer uit:" -ForegroundColor Cyan
        Write-Host "  git push -u origin main" -ForegroundColor White
        exit
    }
}

# Voeg remote toe
$repoUrl = "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
Write-Host "Remote toevoegen: $repoUrl" -ForegroundColor Cyan
git remote add origin $repoUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host "Remote toegevoegd!" -ForegroundColor Green
} else {
    Write-Host "Fout bij toevoegen remote. Check of de URL correct is." -ForegroundColor Red
    exit 1
}

# Check remote
Write-Host ""
Write-Host "Remote configuratie:" -ForegroundColor Cyan
git remote -v

# Rename branch naar main
Write-Host ""
Write-Host "Branch hernoemen naar 'main'..." -ForegroundColor Cyan
git branch -M main

# Push naar GitHub
Write-Host ""
Write-Host "Pushen naar GitHub..." -ForegroundColor Cyan
Write-Host "Je wordt mogelijk gevraagd om in te loggen." -ForegroundColor Yellow
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Repository is gepusht naar GitHub!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repository URL: https://github.com/$GITHUB_USERNAME/$REPO_NAME" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Volgende stap: Deploy naar Vercel!" -ForegroundColor Yellow
    Write-Host "Zie DEPLOYMENT.md voor instructies." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "FOUT bij pushen!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Mogelijke oorzaken:" -ForegroundColor Yellow
    Write-Host "1. Repository bestaat nog niet op GitHub - maak deze eerst aan" -ForegroundColor White
    Write-Host "2. Authenticatie probleem - gebruik Personal Access Token" -ForegroundColor White
    Write-Host "3. Verkeerde repository URL" -ForegroundColor White
    Write-Host ""
    Write-Host "Zie SETUP_GITHUB.md voor troubleshooting tips." -ForegroundColor Cyan
}



