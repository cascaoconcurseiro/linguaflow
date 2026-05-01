# LinguaFlow - GitHub Setup Script
# Run this script to initialize Git and push to GitHub

Write-Host "🚀 LinguaFlow - GitHub Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Git is installed
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed!" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Git is installed" -ForegroundColor Green
Write-Host ""

# Get GitHub username
$username = Read-Host "Enter your GitHub username"
if ([string]::IsNullOrWhiteSpace($username)) {
    Write-Host "❌ Username cannot be empty!" -ForegroundColor Red
    exit 1
}

# Get repository name (default: linguaflow)
$repoName = Read-Host "Enter repository name (default: linguaflow)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "linguaflow"
}

Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "  Username: $username" -ForegroundColor White
Write-Host "  Repository: $repoName" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🔧 Initializing Git repository..." -ForegroundColor Cyan

# Initialize Git
if (Test-Path ".git") {
    Write-Host "⚠️  Git repository already exists" -ForegroundColor Yellow
} else {
    git init
    Write-Host "✅ Git initialized" -ForegroundColor Green
}

# Add all files
Write-Host ""
Write-Host "📦 Adding files..." -ForegroundColor Cyan
git add .
Write-Host "✅ Files added" -ForegroundColor Green

# Create initial commit
Write-Host ""
Write-Host "💾 Creating initial commit..." -ForegroundColor Cyan
git commit -m "feat: initial commit - LinguaFlow v1.0.1

- Complete Chrome extension for language learning
- Dual subtitles with instant translation
- Dictionary popup with native audio
- SRS flashcard system (SuperMemo-2)
- Dashboard with statistics
- Support for YouTube, Netflix, Max, Prime, Disney+
- 100% offline, 100% free, 100% private

Fixes in v1.0.1:
- Fixed dictionary audio extraction (native speakers)
- Fixed Google TTS reliability (multiple endpoints)
- Fixed IndexedDB race condition
- Fixed save button state
- Improved dashboard sync
- Better performance (3s polling)"

Write-Host "✅ Initial commit created" -ForegroundColor Green

# Create main branch
Write-Host ""
Write-Host "🌿 Creating main branch..." -ForegroundColor Cyan
git branch -M main
Write-Host "✅ Main branch created" -ForegroundColor Green

# Add remote
Write-Host ""
Write-Host "🔗 Adding remote repository..." -ForegroundColor Cyan
$remoteUrl = "https://github.com/$username/$repoName.git"
git remote add origin $remoteUrl
Write-Host "✅ Remote added: $remoteUrl" -ForegroundColor Green

# Push to GitHub
Write-Host ""
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Cyan
Write-Host "⚠️  You may need to authenticate with GitHub" -ForegroundColor Yellow
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Green
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 LinguaFlow is now on GitHub!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📍 Repository URL:" -ForegroundColor Cyan
    Write-Host "   https://github.com/$username/$repoName" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Go to GitHub and verify the repository" -ForegroundColor White
    Write-Host "   2. Add a description and topics" -ForegroundColor White
    Write-Host "   3. Enable GitHub Pages (Settings → Pages)" -ForegroundColor White
    Write-Host "   4. Add repository to Chrome Web Store" -ForegroundColor White
    Write-Host "   5. Share with the community!" -ForegroundColor White
    Write-Host ""
    Write-Host "🌟 Don't forget to star your own repo! ⭐" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  1. Repository doesn't exist on GitHub" -ForegroundColor White
    Write-Host "     → Create it first: https://github.com/new" -ForegroundColor White
    Write-Host "  2. Authentication failed" -ForegroundColor White
    Write-Host "     → Use GitHub CLI: gh auth login" -ForegroundColor White
    Write-Host "     → Or use Personal Access Token" -ForegroundColor White
    Write-Host "  3. Remote already exists" -ForegroundColor White
    Write-Host "     → Run: git remote remove origin" -ForegroundColor White
    Write-Host "     → Then run this script again" -ForegroundColor White
    Write-Host ""
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
