"""Strict decoder for ROAD v2 in the supplied Enfusion TOPO v1 resources.

Layout inferred and checked against the supplied files. Unknown sections remain
opaque. ROAD uses six LODs of quadrilateral road strips, not editor splines.
"""
from pathlib import Path
import struct
import json
import hashlib
from collections import Counter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'data/maps/bakhmut'
SOURCE = ROOT/'data/extracted/mod-bakhmut-city/Bakhmut City/BakhmutCity_GM.topo'


def decode_roads(data, map_height=10240.0):
    if not np.isfinite(map_height) or map_height<=0: raise ValueError('Invalid map height')
    if len(data)<80 or data[:4]!=b'TOPO': raise ValueError('Missing TOPO header')
    version, size, end, zero = struct.unpack_from('<4I',data,4)
    if version!=1 or zero or end+4!=len(data) or size+24!=len(data):
        raise ValueError('Unsupported TOPO envelope')
    if data[20:24]!=b'ROAD': raise ValueError('ROAD is not the first section')
    ver, section_size, section_end, reserved = struct.unpack_from('<4I',data,24)
    if ver!=2 or reserved or section_size+40!=section_end or section_end>len(data):
        raise ValueError('Invalid ROAD envelope')
    expected_types = struct.unpack_from('<8I',data,40)
    lod_count = struct.unpack_from('<I',data,72)[0]
    if not 1<=lod_count<=16: raise ValueError('Invalid ROAD LOD count')
    cursor = 76
    summaries, all_roads = [], []
    for lod in range(lod_count):
        if cursor+4>section_end: raise ValueError('Truncated LOD count')
        count = struct.unpack_from('<I',data,cursor)[0]; cursor+=4
        if count!=sum(expected_types): raise ValueError('LOD road count mismatch')
        types = Counter()
        vertex_count = 0
        for index in range(count):
            if cursor+5>section_end: raise ValueError('Truncated road header')
            kind=data[cursor]
            n=struct.unpack_from('<I',data,cursor+1)[0];cursor+=5
            if kind>=8 or n%4 or n>1_000_000: raise ValueError('Invalid road record')
            if cursor+n*8+4>section_end: raise ValueError('Truncated road vertices')
            vertices=np.frombuffer(data,dtype='<f4',count=n*2,offset=cursor).reshape(-1,2)
            if not np.isfinite(vertices).all() or np.abs(vertices).max(initial=0)>100_000:
                raise ValueError('Invalid road coordinates')
            cursor+=n*8
            tail=struct.unpack_from('<I',data,cursor)[0];cursor+=4
            if tail: raise ValueError('Unsupported road trailing data')
            types[kind]+=1;vertex_count+=n
            if lod==0:
                # TOPO 2D Y runs downwards from the map's north edge.
                # This package's map extent is established in terrain.json.
                world=vertices.copy()
                world[:,1]=map_height-world[:,1]
                quads=world.reshape(-1,4,2)
                # Strip quad: left start, right start, right end, left end.
                centres=np.stack(((quads[:,0]+quads[:,1])/2,
                                  (quads[:,2]+quads[:,3])/2),axis=1)
                all_roads.append({'id':f'topo-road-{index:03d}','type':kind,
                    'quads':np.round(quads,4).tolist(),
                    'segments':np.round(centres,4).tolist()})
        if tuple(types[i] for i in range(8))!=expected_types:
            raise ValueError('LOD road type histogram mismatch')
        summaries.append({'lod':lod,'roads':count,'vertices':vertex_count})
    if cursor!=section_end: raise ValueError('ROAD bytes not fully consumed')
    return {'schema':1,'source':'Bakhmut City/BakhmutCity_GM.topo',
            'sourceSha256':hashlib.sha256(data).hexdigest(),
            'coordinateSystem':'Arma Reforger local game coordinates, [x,z] metres',
            'sourceTransform':{'x':'x','z':f'{map_height:g} - topo_y'},
            'status':'decoded game-map ROAD geometry; see registration.json for measured validation scope',
            'lods':summaries,'roadTypeCounts':dict(Counter(r['type'] for r in all_roads)),
            'roads':all_roads}


def main():
    terrain=json.loads((OUT/'terrain.json').read_text())
    result=decode_roads(SOURCE.read_bytes(),terrain['extentGameMetres'][1])
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'roads.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='roads'}))


if __name__=='__main__': main()
