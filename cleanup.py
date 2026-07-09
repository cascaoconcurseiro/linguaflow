import sys
import re

with open('c:/Users/Wesley/.gemini/antigravity/scratch/linguaflow/background/service-worker.js', 'r', encoding='utf-8') as f:
    content = f.read()

def remove_gemini_blocks(text):
    # Find all occurrences of "if (config.provider === 'gemini') {"
    pattern = re.compile(r"if[ \t]*\([ \t]*config\.provider[ \t]*===[ \t]*'gemini'[ \t]*\)[ \t]*\{")
    
    while True:
        match = pattern.search(text)
        if not match:
            break
            
        start_idx = match.start()
        # Find the matching closing brace for the `if`
        brace_count = 0
        in_string = False
        string_char = ''
        if_end_idx = -1
        
        for i in range(match.end() - 1, len(text)):
            c = text[i]
            if not in_string:
                if c in ("'", '"', '`'):
                    in_string = True
                    string_char = c
                elif c == '{':
                    brace_count += 1
                elif c == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        if_end_idx = i
                        break
            else:
                if c == string_char and text[i-1] != '\\':
                    in_string = False
        
        if if_end_idx == -1:
            break
            
        # Now check if there is an `else {` right after
        else_match = re.match(r"[ \t\n]*else[ \t]*\{", text[if_end_idx + 1:])
        if else_match:
            else_start_idx = if_end_idx + 1 + else_match.end() - 1
            brace_count = 0
            else_end_idx = -1
            for i in range(else_start_idx, len(text)):
                c = text[i]
                if not in_string:
                    if c in ("'", '"', '`'):
                        in_string = True
                        string_char = c
                    elif c == '{':
                        brace_count += 1
                    elif c == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            else_end_idx = i
                            break
                else:
                    if c == string_char and text[i-1] != '\\':
                        in_string = False
            
            if else_end_idx != -1:
                # Replace from start_idx to else_end_idx with the contents of else_block
                else_block_content = text[else_start_idx + 1 : else_end_idx]
                text = text[:start_idx] + else_block_content + text[else_end_idx + 1:]
            else:
                # Malformed else block, just skip or break
                break
        else:
            # If there's no else block, just remove the if block
            text = text[:start_idx] + text[if_end_idx + 1:]
            
    return text

content = remove_gemini_blocks(content)

# Clean up other gemini specific conditions
content = re.sub(r"if \(!config\.apiKey && config\.provider !== 'gemini'\)[ \t\n]*return classifyWordStatic\(word\);", "if (!config.apiKey) return classifyWordStatic(word);", content)
content = re.sub(r"if \(!config\.apiKey && config\.provider !== 'gemini'\)[ \t\n]*return null;", "if (!config.apiKey) return null;", content)
content = re.sub(r"if \(!config\.apiKey && config\.provider !== 'gemini'\)[ \t\n]*throw new Error\('Configure sua API Key\.'\);", "if (!config.apiKey) throw new Error('Configure sua API Key.');", content)
content = re.sub(r"if \(!config\.apiKey && config\.provider !== 'gemini'\)[ \t\n]*\{[ \t\n]*throw new Error\('Configure sua API Key\.'\);[ \t\n]*\}", "if (!config.apiKey) { throw new Error('Configure sua API Key.'); }", content)
content = re.sub(r"if \(!config\.apiKey && config\.provider !== 'gemini'\)[ \t\n]*\{[ \t\n]*isBackfilling = false;[ \t\n]*return;[ \t\n]*\}", "if (!config.apiKey) { isBackfilling = false; return; }", content)


# Some ternary operators like: config.provider === 'gemini' ? ... : ...
# Replace with the false branch
content = re.sub(r"config\.provider === 'gemini'[ \t\n]*\?[ \t\n]*[^:]+:[ \t\n]*([^;]+);", r"\1;", content)

# Remove the openrouter headers
content = re.sub(r"\.\.\.\(config\.provider === 'openrouter'[^{]+{[^}]+}\s*:\s*{}\),", "", content)

with open('c:/Users/Wesley/.gemini/antigravity/scratch/linguaflow/background/service-worker.js', 'w', encoding='utf-8') as f:
    f.write(content)
