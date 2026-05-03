with open('dashboard/word-detail.js', 'r', encoding='utf-8') as f:
    content = f.read()

# A linha problemática tem: /[.*+?^${}()|[\]\]/g
# Deve ser:                  /[.*+?^${}()|[\]\\]/g
# Em Python, o arquivo tem: /[.*+?^${}()|[\]\]/g  (falta um backslash)

# Encontra e substitui a função highlightWord inteira
import re

# Substitui a função completa por uma versão correta
old_fn = '''function highlightWord(text, word) {
    if (!text || !word) return text || '';
    try {
        const escaped = word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const re = new RegExp('(' + escaped + ')', 'gi');
        return text.replace(re, '<strong>$1</strong>');
    } catch {
        return text;
    }
}'''

# Verifica o que tem
idx = content.find('function highlightWord')
block = content[idx:idx+250]
print('Bloco atual:')
print(repr(block))
print()

# Substitui usando bytes para evitar problemas de escape
# O regex correto em JS é: /[.*+?^${}()|[\]\\]/g
# Em Python string: '/[.*+?^${}()|[\\]\\\\]/g'
correct_regex = "/[.*+?^${}()|[\\]\\\\]/g"
print(f'Regex correto: {correct_regex}')

# Encontra o padrão problemático
bad_patterns = [
    "/[.*+?^${}()|[\\]\\]/g",  # falta um backslash
    "/[.*+?^${}()|[\\]\\\\]/g",  # correto
]

for p in bad_patterns:
    if p in content:
        print(f'Encontrou: {repr(p)}')

# Substitui diretamente
content = content.replace(
    "/[.*+?^${}()|[\\]\\]/g, '\\$&'",
    "/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'"
)

with open('dashboard/word-detail.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Salvo')
