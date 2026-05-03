# Script de Verificacao - LinguaFlow (PowerShell)
# Verifica se todos os arquivos estao corretos

Write-Host "VERIFICACAO DO LINGUAFLOW" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

$PASS = 0
$FAIL = 0

function Test-FileExists {
    param($Path)
    if (Test-Path $Path) {
        Write-Host "[OK] $Path existe" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "[ERRO] $Path NAO EXISTE" -ForegroundColor Red
        $script:FAIL++
    }
}

function Test-Content {
    param($Path, $Pattern)
    if (Test-Path $Path) {
        $content = Get-Content $Path -Raw
        if ($content -match $Pattern) {
            Write-Host "[OK] $Path contem '$Pattern'" -ForegroundColor Green
            $script:PASS++
        } else {
            Write-Host "[ERRO] $Path NAO contem '$Pattern'" -ForegroundColor Red
            $script:FAIL++
        }
    } else {
        Write-Host "[ERRO] $Path nao existe para verificar conteudo" -ForegroundColor Red
        $script:FAIL++
    }
}

Write-Host "1. Verificando arquivos principais..." -ForegroundColor Yellow
Test-FileExists "manifest.json"
Test-FileExists "icon.png"
Test-FileExists "content/boot.js"
Test-FileExists "content/index.js"
Test-FileExists "content/subtitle-engine.js"
Test-FileExists "content/word-popup.js"
Test-FileExists "content/settings-panel.js"
Test-FileExists "utils/db.js"
Test-FileExists "utils/translator.js"
Test-FileExists "dashboard/dashboard.html"
Test-FileExists "popup/popup.html"
Test-FileExists "background/service-worker.js"

Write-Host ""
Write-Host "2. Verificando manifest.json..." -ForegroundColor Yellow
Test-Content "manifest.json" "content/boot.js"
Test-Content "manifest.json" "manifest_version.*3"

Write-Host ""
Write-Host "3. Verificando DB version..." -ForegroundColor Yellow
Test-Content "utils/db.js" "DB_VERSION = 10"

Write-Host ""
Write-Host "4. Verificando logs de debug..." -ForegroundColor Yellow
Test-Content "content/word-popup.js" "\[WordPopup\]"
Test-Content "utils/db.js" "\[LinguaFlow DB\]"

Write-Host ""
Write-Host "5. Verificando controle de posicao..." -ForegroundColor Yellow
Test-Content "content/settings-panel.js" "subtitleBottom"
Test-Content "content/settings-panel.js" "rng-position"

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "RESULTADO:" -ForegroundColor Cyan
Write-Host "[OK] Passou: $PASS" -ForegroundColor Green
Write-Host "[ERRO] Falhou: $FAIL" -ForegroundColor Red
Write-Host ""

if ($FAIL -eq 0) {
    Write-Host "TUDO CERTO! Extensao pronta para testar." -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor Yellow
    Write-Host "1. Ir para chrome://extensions/"
    Write-Host "2. Clicar em RECARREGAR na extensao LinguaFlow"
    Write-Host "3. Abrir YouTube e testar"
    exit 0
} else {
    Write-Host "PROBLEMAS ENCONTRADOS!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifique os arquivos marcados com ✗" -ForegroundColor Yellow
    Write-Host "Consulte COMO_FAZER_FUNCIONAR.md para mais detalhes"
    exit 1
}
