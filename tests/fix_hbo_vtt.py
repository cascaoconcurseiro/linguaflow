import re
content = open('content/subtitle-engine.js', encoding='utf-8').read()
si = content.find('    // \u2500\u2500 Auto-descoberta de legendas para Max/HBO')
ei_marker = "        console.log('[LinguaFlow] Max/HBO: auto-descoberta ativada');
    }
}"
ei = content.find(ei_marker, si) + len(ei_marker)
print('si=' + str(si) + ' ei=' + str(ei))
