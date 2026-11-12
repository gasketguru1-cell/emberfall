# Joins rig.py's --shots stills into one contact sheet per clip, each still labelled with its frame number (60 fps).
#   python tools/blender/contact-sheet.py <shots.json> <shotdir> <outdir> [cols]
import sys, os, json
from PIL import Image, ImageDraw

shots, sdir, odir = sys.argv[1:4]; cols = int(sys.argv[4]) if len(sys.argv) > 4 else 10
spec = json.load(open(shots)); os.makedirs(odir, exist_ok=True)
for clip, times in spec['clips'].items():
    ims = [Image.open(os.path.join(sdir, '%s_%02d.png' % (clip, i))) for i in range(len(times))]
    w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
    out = Image.new('RGB', (cols * w, rows * h + 22), 'white'); d = ImageDraw.Draw(out)
    d.text((6, 5), '%s  (side view, facing right; numbers are frames at 60 fps)' % clip, fill='black')
    for i, (im, t) in enumerate(zip(ims, times)):
        x, y = (i % cols) * w, 22 + (i // cols) * h
        out.paste(im, (x, y)); d.rectangle([x, y, x + w - 1, y + h - 1], outline='#bbb')
        d.text((x + 5, y + 4), str(round(t * 60) + 1), fill='#0050c0')
    out.save(os.path.join(odir, clip + '.png')); print(clip, len(ims), 'frames')
