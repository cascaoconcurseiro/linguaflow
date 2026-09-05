# Verificação local oficial do LinguaFlow para Windows.
$ErrorActionPreference = 'Stop'

Write-Host 'VERIFICAÇÃO DO LINGUAFLOW' -ForegroundColor Cyan

$requiredFiles = @(
    'manifest.json',
    'icon16.png',
    'icon48.png',
    'icon128.png',
    'background/service-worker.js',
    'content/boot.js',
    'content/subtitle-engine.js',
    'content/word-popup.js',
    'dashboard/dashboard.html',
    'utils/db.js',
    'vercel.json'
)

$missing = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missing.Count -gt 0) {
    throw "Arquivos obrigatórios ausentes: $($missing -join ', ')"
}

$manifest = Get-Content -LiteralPath 'manifest.json' -Raw | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) {
    throw 'manifest.json precisa usar Manifest V3.'
}
if (-not $manifest.background.service_worker) {
    throw 'manifest.json não declara o service worker da extensão.'
}

Write-Host "Manifest V3 e arquivos obrigatórios verificados (versão $($manifest.version))." -ForegroundColor Green
Write-Host 'Executando o gate completo de release...' -ForegroundColor Yellow

npm run test:release
if ($LASTEXITCODE -ne 0) {
    throw "Gate de release falhou com código $LASTEXITCODE."
}

Write-Host 'Verificação concluída: repositório pronto para release.' -ForegroundColor Green
