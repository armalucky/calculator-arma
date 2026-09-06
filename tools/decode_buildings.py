"""Decode the supplied TOPO BULD v1 section without executing mod scripts."""
from pathlib import Path
import struct, json, hashlib, math

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/extracted/mod-bakhmut-city/Bakhmut City/BakhmutCity_GM.topo'

def decode(data):
    if data[:4]!=b'TOPO' or struct.unpack_from('<I',data,4)[0]!=1:
        raise ValueError('Unsupported TOPO')
    pos=20
    while data[pos:pos+4]!=b'BULD':
        end=struct.unpack_from('<I',data,pos+12)[0]
        if not pos+20<=end<len(data):raise ValueError('Invalid section boundary')
        pos=end
    version,size,end,reserved=struct.unpack_from('<4I',data,pos+4)
    if version!=1 or reserved or pos+20+size!=end or end>len(data):raise ValueError('Invalid BULD envelope')
    cursor=pos+20
    def uint():
        nonlocal cursor
        if cursor+4>end:raise ValueError('Truncated count')
        result=struct.unpack_from('<I',data,cursor)[0];cursor+=4
        return result
    groups=uint()
    if not 1<=groups<=32:raise ValueError('Invalid group count')
    polygons=[];symbols=[];summary=[]
    for group in range(groups):
        count=uint()
        if count>100000:raise ValueError('Invalid polygon count')
        for index in range(count):
            n=uint()
            if not 3<=n<=10000 or cursor+n*8>end:raise ValueError('Invalid polygon length')
            flat=struct.unpack_from('<'+str(n*2)+'f',data,cursor);cursor+=n*8
            if not all(math.isfinite(v) and abs(v)<100000 for v in flat):raise ValueError('Invalid coordinates')
            vertices=[[flat[i],10240-flat[i+1]] for i in range(0,len(flat),2)]
            polygons.append({'group':group,'vertices':vertices})
        symbol_count=uint()
        if cursor+symbol_count*20>end:raise ValueError('Invalid symbols')
        for _ in range(symbol_count):
            kind,x,y,dx,dy=struct.unpack_from('<I4f',data,cursor);cursor+=20
            if not all(math.isfinite(v) for v in (x,y,dx,dy)):raise ValueError('Invalid symbol')
            symbols.append({'group':group,'kind':kind,'x':x,'z':10240-y,'direction':[dx,dy]})
        summary.append({'group':group,'polygons':count,'symbols':symbol_count})
    if cursor!=end:raise ValueError('BULD bytes not fully consumed')
    return {'schema':1,'source':'Bakhmut City/BakhmutCity_GM.topo','sourceSha256':hashlib.sha256(data).hexdigest(),
            'coordinateSystem':'local game metres X,Z; Z = 10240 - TOPO Y',
            'groups':summary,'buildings':polygons,'symbols':symbols,
            'note':'Group and symbol semantics not assigned. Only actual polygon contours are rendered; no fabricated footprints for symbols.'}

if __name__=='__main__':
    result=decode(SOURCE.read_bytes())
    (ROOT/'data/maps/bakhmut/buildings.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'groups':result['groups'],'polygons':len(result['buildings']),'symbols':len(result['symbols'])}))
