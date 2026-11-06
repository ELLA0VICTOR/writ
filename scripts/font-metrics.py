"""Inspect Fontsource WOFF and Windows fallback TTF metrics; no extra dependencies."""
from pathlib import Path
import struct
import zlib

def table(path, wanted):
    data = Path(path).read_bytes()
    if data[:4] == b'wOFF':
        count = struct.unpack_from('>H', data, 12)[0]
        for index in range(count):
            tag, offset, compressed, original, _ = struct.unpack_from('>4sIIII', data, 44 + index * 20)
            if tag == wanted:
                value = data[offset:offset + compressed]
                return zlib.decompress(value) if compressed != original else value
    else:
        count = struct.unpack_from('>H', data, 4)[0]
        for index in range(count):
            tag, _, offset, size = struct.unpack_from('>4sIII', data, 12 + index * 16)
            if tag == wanted:
                return data[offset:offset + size]
    raise ValueError(wanted)

def metrics(path):
    head, hhea, os2 = (table(path, tag) for tag in [b'head', b'hhea', b'OS/2'])
    units = struct.unpack_from('>H', head, 18)[0]
    ascent, descent, gap = struct.unpack_from('>hhh', hhea, 4)
    if struct.unpack_from('>H', os2, 62)[0] & 128:
        ascent, descent, gap = struct.unpack_from('>hhh', os2, 68)
    x_height = struct.unpack_from('>h', os2, 86)[0]
    avg_width = struct.unpack_from('>h', os2, 2)[0]
    return [value / units for value in [ascent, -descent, gap, x_height, avg_width]]

for slug, fallback in [('public-sans', 'arial.ttf'), ('courier-prime', 'cour.ttf')]:
    target = metrics(f'node_modules/@fontsource/{slug}/files/{slug}-latin-400-normal.woff')
    base = metrics(f'C:/Windows/Fonts/{fallback}')
    adjust = target[4] / base[4] if slug == 'courier-prime' else target[3] / base[3]
    print(slug, 'size-adjust', round(adjust * 100, 3), 'ascent-override', round(target[0] / adjust * 100, 3), 'descent-override', round(target[1] / adjust * 100, 3), 'line-gap-override', round(target[2] / adjust * 100, 3))
