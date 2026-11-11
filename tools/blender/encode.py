# Turns a folder of numbered JPEG frames into an H.264 MP4 using Blender's own video encoder.
#   blender -b --factory-startup --python tools/blender/encode.py -- --frames <dir> --out <file.mp4> --fps 30
import bpy, sys, os
args = sys.argv[sys.argv.index('--') + 1:]
opt = {args[i].lstrip('-'): args[i + 1] for i in range(0, len(args), 2)}
files = sorted(f for f in os.listdir(opt['frames']) if f.lower().endswith('.jpg'))
if not files: raise SystemExit('encode: no frames in ' + opt['frames'])
fps = int(opt.get('fps', 30))
scene = bpy.context.scene
ed = scene.sequence_editor_create()
coll = ed.strips if hasattr(ed, 'strips') else ed.sequences
strip = coll.new_image(name='clip', filepath=os.path.join(opt['frames'], files[0]), channel=1, frame_start=1)
for f in files[1:]: strip.elements.append(f)
print('encode: %d elements, duration %d' % (len(strip.elements), strip.frame_final_duration))
from bpy_extras.image_utils import load_image
img = load_image(os.path.join(opt['frames'], files[0]))
scene.render.resolution_x, scene.render.resolution_y = img.size[0], img.size[1]
scene.render.resolution_percentage = 100
scene.render.fps = fps; scene.render.fps_base = 1
scene.frame_start = 1; scene.frame_end = len(files)
ims = scene.render.image_settings
if hasattr(ims, 'media_type'): ims.media_type = 'VIDEO'
ims.file_format = 'FFMPEG'
ff = scene.render.ffmpeg
ff.format = 'MPEG4'; ff.codec = 'H264'
try: ff.constant_rate_factor = 'HIGH'
except Exception: pass
ff.audio_codec = 'NONE'
scene.render.filepath = opt['out']
scene.render.use_file_extension = False
bpy.ops.render.render(animation=True)
print('encode: wrote %s, %d frames at %d fps' % (opt['out'], len(files), fps))
