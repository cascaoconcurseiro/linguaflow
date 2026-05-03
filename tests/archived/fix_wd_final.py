with open('dashboard/word-detail.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove linhas problemáticas (108-115 aproximadamente que são fragmentos)
# Encontra o padrão do fragmento solto
clean_lines = []
skip_until_close = False
i = 0
while i < len(lines):
    line = lines[i]
    # Detecta o fragmento solto (linha com apenas parte de regex)
    if "})|[" in line and "highlightWord" not in line and "function" not in line:
        # Pula até encontrar o fechamento da função duplicada
        print(f'Removendo linha {i+1}: {repr(line.rstrip())}')
        # Pula linhas até encontrar o próximo '}'
        while i < len(lines) and lines[i].strip() != '}':
            print(f'  Pulando linha {i+1}: {repr(lines[i].rstrip())}')
            i += 1
        if i < len(lines):
            print(f'  Pulando fechamento linha {i+1}: {repr(lines[i].rstrip())}')
            i += 1  # pula o }
        continue
    clean_lines.append(line)
    i += 1

with open('dashboard/word-detail.js', 'w', encoding='utf-8') as f:
    f.writelines(clean_lines)

print(f'\nLinhas originais: {len(lines)}, Linhas limpas: {len(clean_lines)}')
print('✅ Salvo')
