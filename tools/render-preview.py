"""Draw original card artwork. Requires Pillow; gameplay does not."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parent.parent
image = Image.new('RGB', (600, 600), '#17151f')
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((145, 65, 455, 535), radius=32, fill='#8571db')
draw.rounded_rectangle((169, 93, 431, 311), radius=14, fill='#292735')
draw.rectangle((189, 113, 411, 291), fill='#101512')
draw.text((300, 188), 'Tweetboy', anchor='mm', fill='white', font_size=28)
draw.text((300, 220), 'Insert your cartridge', anchor='mm', fill='#a9a5b4', font_size=16)
draw.polygon([(198,366),(226,366),(226,338),(254,338),(254,366),(282,366),(282,394),(254,394),(254,422),(226,422),(226,394),(198,394)], fill='#e2dfeb')
for x,y in [(364,399),(409,355)]:
    draw.ellipse((x-20,y-20,x+20,y+20), fill='#e2dfeb')
for x in [264,319]:
    draw.rounded_rectangle((x,462,x+29,472), radius=5, fill='#e2dfeb')
image.save(root / 'public/preview.png')
