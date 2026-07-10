<#
  Reproduz as migrations em uma pilha Supabase LOCAL e descartável.

  Segurança: não usa `--linked`, project ref, URL remota ou segredo de produção.
  O comando só executa com -Execute e cria uma pasta isolada em $env:TEMP.
  Uma falha é resultado útil: significa que a sequência no Git ainda não é
  reproduzível a partir de um banco vazio.

  Pré-requisitos: Docker em execução e Supabase CLI instalado.
  Uso: powershell -ExecutionPolicy Bypass -File scripts/replay-migrations-local.ps1 -Execute
#>
[CmdletBinding()]
param(
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'

if (-not $Execute) {
  Write-Host 'Dry run: nenhuma migration será executada.' -ForegroundColor Yellow
  Write-Host 'Para validar em um Supabase local isolado, execute novamente com -Execute.'
  exit 0
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw 'Supabase CLI não encontrado. Instale-o e execute novamente; nenhum banco foi alterado.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationsSource = Join-Path $repoRoot 'supabase\migrations'
if (-not (Test-Path $migrationsSource)) {
  throw "Diretório de migrations ausente: $migrationsSource"
}

# O replay usa uma cópia sem .git nem link de projeto, impedindo comandos remotos por engano.
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$sandboxRoot = Join-Path $env:TEMP "linguaflow-migration-replay-$runId"
New-Item -ItemType Directory -Path $sandboxRoot | Out-Null

try {
  Push-Location $sandboxRoot
  & supabase init | Out-Host
  Copy-Item -Path $migrationsSource -Destination (Join-Path $sandboxRoot 'supabase\migrations') -Recurse -Force

  Write-Host "Iniciando stack local isolada em $sandboxRoot" -ForegroundColor Cyan
  & supabase start | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar a stack Supabase local.' }

  Write-Host 'Reaplicando todas as migrations somente no banco local...' -ForegroundColor Cyan
  & supabase db reset --local | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw 'REPLAY FALHOU: a sequência de migrations no Git não é reproduzível. Corrija a migration faltante/ordem antes de qualquer deploy.'
  }

  Write-Host 'REPLAY APROVADO: migrations aplicadas em banco local descartável.' -ForegroundColor Green
}
finally {
  Pop-Location -ErrorAction SilentlyContinue
  Write-Host "Artefatos locais preservados para inspeção: $sandboxRoot" -ForegroundColor DarkGray
  Write-Host 'Para encerrar a stack criada, execute dentro dessa pasta: supabase stop' -ForegroundColor DarkGray
}
