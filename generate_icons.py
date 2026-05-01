import base64
from pathlib import Path

# SVG icon definition
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0066ff"/>
      <stop offset="50%" stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="#0066ff"/>
    </linearGradient>
    <linearGradient id="wave" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#00ffff"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feFlood flood-color="#00d4ff" flood-opacity="0.6"/>
      <feComposite in2="blur" operator="in" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="128" height="128" rx="32" fill="url(#bg)"/>
  <circle cx="64" cy="64" r="50" fill="#00d4ff" opacity="0.15"/>
  <circle cx="64" cy="64" r="35" fill="#ffffff" opacity="0.08"/>
  <g filter="url(#shadow)">
    <path d="M32 48 Q32 32 48 32 L96 32 Q112 32 112 48 L112 76 Q112 92 96 92 L72 92 L64 108 L60 92 L48 92 Q32 92 32 76 Z" fill="#ffffff" opacity="0.95"/>
  </g>
  <g filter="url(#glow)">
    <path d="M48 52 Q56 46 64 52 Q72 58 80 52 Q88 46 96 52" stroke="url(#wave)" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M48 64 Q56 58 64 64 Q72 70 80 64 Q88 58 96 64" stroke="url(#wave)" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.8"/>
    <path d="M52 76 Q60 70 68 76 Q76 82 84 76" stroke="url(#wave)" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.6"/>
  </g>
  <circle cx="44" cy="52" r="3" fill="#00ffff" opacity="0.7"/>
  <circle cx="92" cy="64" r="3" fill="#00ffff" opacity="0.7"/>
  <circle cx="48" cy="76" r="2.5" fill="#ffffff" opacity="0.9"/>
</svg>'''

try:
    from cairosvg import svg2png
    
    sizes = [
        (16, 'icon16.png'),
        (32, 'icon32.png'),
        (48, 'icon48.png'),
        (128, 'icon128.png'),
        (128, 'icon.png')
    ]
    
    for size, filename in sizes:
        svg2png(bytestring=svg_content.encode('utf-8'), 
                write_to=filename, 
                output_width=size, 
                output_height=size)
        print(f'✅ {filename} criado ({size}x{size})')
    
    print('\n🎉 Todos os ícones foram gerados com sucesso!')
    print('\n📋 Próximo passo:')
    print('   Vá em chrome://extensions/ e clique em 🔄 (recarregar) na extensão LinguaFlow')
    
except ImportError:
    print('Biblioteca cairosvg nao encontrada!')
    print('Instalando cairosvg...')
    import subprocess
    subprocess.check_call(['pip', 'install', 'cairosvg'])
    print('Instalacao concluida! Execute o script novamente.')
