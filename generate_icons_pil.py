from PIL import Image, ImageDraw
import math

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Scale factor
    s = size / 128
    
    # Background gradient (approximated with ellipses)
    for i in range(size):
        ratio = i / size
        r = int(0 + (0x00 - 0) * ratio + (0x66 - 0) * (1 - ratio))
        g = int(102 + (212 - 102) * abs(0.5 - ratio) * 2)
        b = 255
        draw.ellipse([i*0.3, i*0.3, size-i*0.3, size-i*0.3], fill=(r, g, b, 255))
    
    # Background rounded rect
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=int(32*s), fill=(0, 102, 255, 255))
    
    # Gradient overlay (cyan glow)
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)
    draw_overlay.ellipse([size*0.1, size*0.1, size*0.9, size*0.9], fill=(0, 212, 255, 38))
    draw_overlay.ellipse([size*0.2, size*0.2, size*0.8, size*0.8], fill=(255, 255, 255, 20))
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)
    
    # Speech bubble
    bubble_points = [
        (32*s, 48*s), (48*s, 32*s), (96*s, 32*s), (112*s, 48*s),
        (112*s, 76*s), (96*s, 92*s), (72*s, 92*s), (64*s, 108*s),
        (60*s, 92*s), (48*s, 92*s), (32*s, 76*s)
    ]
    draw.polygon(bubble_points, fill=(255, 255, 255, 242))
    
    # Wave lines (3 waves)
    wave_y = [52*s, 64*s, 76*s]
    wave_opacity = [255, 204, 153]
    wave_width = [int(6*s), int(6*s), int(5*s)]
    
    for idx, (y, opacity, width) in enumerate(zip(wave_y, wave_opacity, wave_width)):
        points = []
        for x in range(int(48*s), int(96*s), 2):
            wave_x = x
            wave_offset = math.sin((x - 48*s) / (48*s) * math.pi * 2) * 6 * s
            points.append((wave_x, y + wave_offset))
        
        if len(points) > 1:
            for i in range(len(points)-1):
                draw.line([points[i], points[i+1]], fill=(0, 212, 255, opacity), width=width)
    
    # Accent dots
    dots = [(44*s, 52*s, 3*s), (92*s, 64*s, 3*s), (48*s, 76*s, 2.5*s)]
    for x, y, r in dots:
        draw.ellipse([x-r, y-r, x+r, y+r], fill=(0, 255, 255, 179))
    
    return img

# Generate all sizes
sizes = [
    (16, 'icon16.png'),
    (32, 'icon32.png'),
    (48, 'icon48.png'),
    (128, 'icon128.png'),
    (128, 'icon.png')
]

print('Gerando icones...')
for size, filename in sizes:
    img = create_icon(size)
    img.save(filename, 'PNG')
    print(f'OK: {filename} ({size}x{size})')

print('\nConcluido! Recarregue a extensao em chrome://extensions/')
