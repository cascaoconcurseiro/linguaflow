with open('dashboard/word-detail.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove as linhas 108-110 (fragmentos soltos, índice 0-based: 107-109)
# Linha 108 (idx 107): "}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');"
# Linha 109 (idx 108): "    return text.replace(re, '<strong>$1</strong>');"
# Linha 110 (idx 109): "}"

print(f'Total linhas: {len(lines)}')
print('Linhas a remover:')
for i in [107, 108, 109]:
    print(f'  {i+1}: {repr(lines[i].rstrip())}')

# Remove as linhas problemáticas
new_lines = lines[:107] + lines[110:]

print(f'Linhas após remoção: {len(new_lines)}')

with open('dashboard/word-detail.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('✅ Salvo')
