"""Render Delta's editable skin PDFs; adapt branding and slice landscape controls."""
from pathlib import Path
import subprocess, tempfile
from PIL import Image
import numpy as np
root=Path(__file__).resolve().parents[2]
source=Path(__file__).parent
out=root/'public/assets/delta'
out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
 for pdf in source.glob('*.pdf'):
  prefix=Path(tmp)/pdf.stem
  subprocess.run(['pdftocairo','-png','-transp','-singlefile','-scale-to','960',str(pdf),str(prefix)],check=True)
  im=Image.open(str(prefix)+'.png').convert('RGBA')
  if pdf.stem=='iphone_edgetoedge_portrait':
   a=np.array(im);hsv=np.array(im.convert('RGB').convert('HSV'))
   purple=(hsv[:,:,0]>165)&(hsv[:,:,0]<220)&(hsv[:,:,1]>70)
   hsv[:,:,0][purple]=180
   hsv[:,:,1][purple]=(hsv[:,:,1][purple]*.55).astype(np.uint8)
   a[:,:,:3]=np.array(Image.fromarray(hsv,'HSV').convert('RGB'))
   a[:40,:,3]=0
   for y in range(620,740):a[y,830:960]=a[y,810]
   im=Image.fromarray(a)
  if pdf.stem=='iphone_landscape':
   frames={'dpad':(15,199,161,161),'a':(577,228,75,75),'b':(502,285,75,75),'l':(15,15,100,40),'r':(552,15,100,40),'start':(344,335,73,26),'select':(251,335,73,26),'menu':(299,15,73,26)}
   for name,(x,y,w,h) in frames.items():
    crop=im.crop(tuple(round(v*im.width/667) for v in (x,y,x+w,y+h)))
    crop.save(out/f'landscape_{name}.webp',quality=95)
  else:
   if 'portrait' not in pdf.stem:im.thumbnail((384,384))
   im.save(out/f'{pdf.stem}.webp',quality=95)
# Extend both original edge colors independently, keeping the narrower panel seamless.
im=Image.open(out/'iphone_edgetoedge_portrait.webp').convert('RGBA')
pad=round(im.width*(1/.88-1)/2)
panel=Image.new('RGBA',(im.width+pad*2,im.height))
panel.paste(im,(pad,0))
panel.paste(im.crop((0,0,1,im.height)).resize((pad,im.height)),(0,0))
panel.paste(im.crop((im.width-1,0,im.width,im.height)).resize((pad,im.height)),(pad+im.width,0))
panel.save(out/'portrait-panel.webp',lossless=True)
