"""Decode this supplied map's EDDS background and tiled game terrain.

EDDS chunk layout reference: github.com/WoozyMasta/edds (MIT).
Terrain layout inferred from supplied FORM/TERR chunks; seam checks are mandatory.
"""
from pathlib import Path
import io
import json
import struct
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/extracted/mod-bakhmut-city/Bakhmut City'
OUT = ROOT / 'data/maps/bakhmut'


def decode_lz4_stream(data, expected):
    output = bytearray()
    pos = 0
    final = False
    while pos < len(data) and not final:
        if pos + 4 > len(data):
            raise ValueError('Truncated chunk header')
        size = int.from_bytes(data[pos:pos+3], 'little')
        flags = data[pos+3]
        if flags & ~128 or size <= 0:
            raise ValueError('Invalid LZ4 chunk')
        pos += 4
        end = pos + size
        if end > len(data):
            raise ValueError('Truncated chunk')
        chunk_start = len(output)
        while pos < end:
            token = data[pos]
            pos += 1
            literals = token >> 4
            if literals == 15:
                while True:
                    value = data[pos]; pos += 1; literals += value
                    if value != 255: break
            if pos + literals > end:
                raise ValueError('Literal overrun')
            output.extend(data[pos:pos+literals]); pos += literals
            if pos == end: break
            distance = int.from_bytes(data[pos:pos+2], 'little'); pos += 2
            count = (token & 15) + 4
            if token & 15 == 15:
                while True:
                    value = data[pos]; pos += 1; count += value
                    if value != 255: break
            if not 0 < distance <= min(len(output), 65535):
                raise ValueError('Invalid back-reference')
            if len(output) + count > expected:
                raise ValueError('Decoded size overrun')
            pattern = output[-distance:]
            output.extend((pattern * ((count + distance - 1) // distance))[:count])
        if len(output) - chunk_start > 65536 or len(output) > expected:
            raise ValueError('Chunk overrun')
        final = bool(flags & 128)
    if not final or pos != len(data) or len(output) != expected:
        raise ValueError('LZ4 stream size mismatch')
    return output


def decode_background():
    data = (BASE / 'zulu1.edds').read_bytes()
    if data[:4] != b'DDS ' or data[84:88] != b'DX10':
        raise ValueError('Unsupported image header')
    height, width = struct.unpack_from('<II', data, 12)
    mipmaps = struct.unpack_from('<I', data, 28)[0]
    if mipmaps != 1 or width * height > 110_000_000:
        raise ValueError('Unexpected map dimensions/mipmap count')
    magic = data[148:152]
    size = struct.unpack_from('<I', data, 152)[0]
    payload = data[156:]
    if len(payload) != size:
        raise ValueError('EDDS block size mismatch')
    if magic == b'LZ4 ':
        expected = struct.unpack_from('<I', payload)[0]
        if expected > 128 * 1024 * 1024: raise ValueError('Image payload too large')
        payload = decode_lz4_stream(payload[4:], expected)
    elif magic != b'COPY':
        raise ValueError('Unsupported EDDS compression')
    header = bytearray(data[:148])
    header[36:40] = b'\0' * 4
    Image.MAX_IMAGE_PIXELS = 110_000_000
    image = Image.open(io.BytesIO(header + payload)).convert('RGB')
    if image.size != (width, height): raise ValueError('Image dimension mismatch')
    image.save(OUT / 'background.jpg', quality=95)
    image.thumbnail((1800, 1800))
    image.save(OUT / 'background-preview.jpg', quality=92)
    return {'width': width, 'height': height, 'source': 'Bakhmut City/zulu1.edds'}


def chunks(data):
    if data[:4] != b'FORM' or data[8:12] != b'TERR':
        raise ValueError('Not TERR')
    if int.from_bytes(data[4:8], 'big') + 8 != len(data):
        raise ValueError('FORM length mismatch')
    pos = 12
    while pos < len(data):
        name = data[pos:pos+4].decode('ascii')
        size = int.from_bytes(data[pos+4:pos+8], 'big')
        pos += 8
        if pos + size > len(data): raise ValueError('Truncated TERR chunk')
        yield name, data[pos:pos+size]
        pos += size


def decode_terrain():
    info = dict(chunks((BASE / 'Bakhmut City.terr').read_bytes()))
    nx, nz, block_vertices, blocks, step, scale, offset, version = struct.unpack('<4I3fI', info['HEAD'])
    stride = (block_vertices-1) * blocks
    tx, tz = (nx-1)//stride, (nz-1)//stride
    if tx*stride+1 != nx or tz*stride+1 != nz: raise ValueError('Grid tiling mismatch')
    files = list((BASE / '.Data').glob('*.ttile'))
    if len(files) != tx*tz: raise ValueError('Missing terrain tiles')
    grid = np.zeros((nz,nx), dtype=np.uint16)
    seams, failures = 0, 0
    for index in range(tx*tz):
        tile_data = dict(chunks((BASE / '.Data' / f'Bakhmut City_{index}.ttile').read_bytes()))
        heights = np.frombuffer(tile_data['HGHT'], dtype='<u2').reshape(stride+1,stride+1)
        x, z = (index % tx)*stride, (index // tx)*stride
        if x:
            failures += int(np.count_nonzero(grid[z:z+stride+1,x] != heights[:,0]))
            seams += stride+1
        if z:
            failures += int(np.count_nonzero(grid[z,x:x+stride+1] != heights[0,:]))
            seams += stride+1
        grid[z:z+stride+1,x:x+stride+1] = heights
    if failures: raise ValueError(f'{failures}/{seams} mismatched shared-edge samples')
    heights = grid.astype(np.float32)*scale+offset
    np.save(OUT/'heightmap.npy', heights)
    preview = Image.fromarray(np.flipud(heights))
    lo, hi = float(heights.min()), float(heights.max())
    grey = ((np.flipud(heights)-lo)/(hi-lo)*255).astype(np.uint8)
    preview = Image.fromarray(grey)
    preview.thumbnail((1600,1600)); preview.save(OUT/'heightmap-preview.png')
    return {'samples': [nx,nz], 'sampleSpacingGameMetres':step,
            'extentGameMetres':[(nx-1)*step,(nz-1)*step],
            'heightScale':scale,'heightOffset':offset,'heightRange':[lo,hi],
            'tileCount':len(files),'sharedEdgeSamplesChecked':seams,'sharedEdgeMismatches':failures,
            'orientation':'array[row=z increasing, column=x increasing]; screen orientation needs visual check',
            'validation':'binary structure and tile continuity verified; absolute heights need game cross-check'}


if __name__ == '__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    terrain = decode_terrain()
    (OUT/'terrain.json').write_text(json.dumps(terrain,indent=2),encoding='utf-8')
    print(json.dumps(terrain))
    background = decode_background()
    (OUT/'background.json').write_text(json.dumps(background,indent=2),encoding='utf-8')
    print(json.dumps(background))
