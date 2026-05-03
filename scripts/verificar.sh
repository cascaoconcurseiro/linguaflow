#!/bin/bash

# Script de Verificação - LinguaFlow
# Verifica se todos os arquivos estão corretos

echo "🔍 VERIFICAÇÃO DO LINGUAFLOW"
echo "=============================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
PASS=0
FAIL=0

# Função de teste
test_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 existe"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $1 NÃO EXISTE"
        ((FAIL++))
    fi
}

test_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $1 contém '$2'"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $1 NÃO contém '$2'"
        ((FAIL++))
    fi
}

echo "1. Verificando arquivos principais..."
test_file "manifest.json"
test_file "icon.png"
test_file "content/boot.js"
test_file "content/index.js"
test_file "content/subtitle-engine.js"
test_file "content/word-popup.js"
test_file "content/settings-panel.js"
test_file "utils/db.js"
test_file "utils/translator.js"
test_file "dashboard/dashboard.html"
test_file "popup/popup.html"
test_file "background/service-worker.js"

echo ""
echo "2. Verificando manifest.json..."
test_content "manifest.json" "content/boot.js"
test_content "manifest.json" "manifest_version.*3"

echo ""
echo "3. Verificando DB version..."
test_content "utils/db.js" "DB_VERSION = 10"

echo ""
echo "4. Verificando logs de debug..."
test_content "content/word-popup.js" "\[WordPopup\]"
test_content "utils/db.js" "\[LinguaFlow DB\]"

echo ""
echo "5. Verificando controle de posição..."
test_content "content/settings-panel.js" "subtitleBottom"
test_content "content/settings-panel.js" "rng-position"

echo ""
echo "=============================="
echo "RESULTADO:"
echo -e "${GREEN}✓ Passou: $PASS${NC}"
echo -e "${RED}✗ Falhou: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 TUDO CERTO! Extensão pronta para testar.${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. Ir para chrome://extensions/"
    echo "2. Clicar em RECARREGAR na extensão LinguaFlow"
    echo "3. Abrir YouTube e testar"
    exit 0
else
    echo -e "${RED}⚠️  PROBLEMAS ENCONTRADOS!${NC}"
    echo ""
    echo "Verifique os arquivos marcados com ✗"
    echo "Consulte COMO_FAZER_FUNCIONAR.md para mais detalhes"
    exit 1
fi
