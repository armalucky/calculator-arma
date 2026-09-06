"""Read line-oriented Enfusion layer blocks as data, without executing scripts."""
from pathlib import Path
import json
import re
import math
from dataclasses import dataclass, field

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/maps/bakhmut'


@dataclass
class Node:
    header: str
    lines: list[str] = field(default_factory=list)
    children: list = field(default_factory=list)


def parse(path):
    root = Node('root')
    stack = [root]
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        # Braces inside quoted GUIDs and text do not delimit blocks.
        outside = re.sub(r'"(?:\\.|[^"\\])*"', '""', line)
        if outside.endswith('{'):
            child = Node(line[:-1].strip())
            stack[-1].children.append(child); stack.append(child)
        elif outside == '}':
            if len(stack) == 1: raise ValueError(f'Unbalanced closing brace: {path}')
            stack.pop()
        else:
            stack[-1].lines.append(line)
    if len(stack) != 1: raise ValueError(f'Unbalanced layer: {path}')
    return root


def vector(node, key, default=None):
    for line in node.lines:
        if line.startswith(key+' '):
            return [float(n) for n in line[len(key)+1:].split()]
    return default


def walk(node):
    yield node
    for child in node.children: yield from walk(child)


def main():
    roads = []
    base = ROOT / 'data/extracted/mod-bakhmut-city/Bakhmut City_Layers'
    for layer in ['Roads.layer','OuterCityRoads.layer']:
        tree = parse(base/layer)
        for node in walk(tree):
            points = next((n for n in node.children if n.header == 'Points'), None)
            if points is None: continue
            if not any('RoadGeneratorEntity' in n.header for n in walk(node)): continue
            origin = vector(node, 'coords', [0,0,0])
            angles = vector(node, 'angles', [0,0,0])
            if angles[0] or angles[2]: raise ValueError('Tilted road spline requires transform support')
            yaw = math.radians(angles[1])
            coords = [vector(n,'Position') for n in points.children]
            if any(p is None for p in coords): raise ValueError('Missing shape point')
            if len(coords)<2: continue
            roads.append({'source':layer,'points':[[round(origin[0]+math.cos(yaw)*p[0]+math.sin(yaw)*p[2],3),round(origin[2]-math.sin(yaw)*p[0]+math.cos(yaw)*p[2],3)] for p in coords]})
    points = []
    lg = ROOT/'data/extracted/mod-luckygames/worlds/LG_Bakhmut_conflict_Layers'
    for path in sorted(lg.glob('*.layer')):
        tree = parse(path)
        for group in tree.children:
            if 'MilitaryBase' not in group.header: continue
            for node in group.children:
                coords = vector(node,'coords')
                if coords is None: continue
                lines = [line for n in walk(node) for line in n.lines]
                names = [re.match(r'm_sBaseName "(.*)"$',line) for line in lines]
                name = next((m[1] for m in names if m), node.header)
                display_name = name
                if path.stem == 'B_MB' and node.header == 'ConflictMilitaryBase':
                    display_name = 'Main base — South'
                elif path.stem == 'B_MB' and node.header == 'ConflictMilitaryBase2':
                    display_name = 'Main base — North'
                points.append({'id':path.stem+':'+node.header,'name':display_name,'sourceName':name,
                               'x':coords[0],'z':coords[2],'source':path.name})
    (OUT/'editor-road-splines.json').write_text(json.dumps({'status':'diagnostic editor control-point polylines; use roads.json for game-map geometry',
        'roads':roads},indent=2),encoding='utf-8')
    (OUT/'points.json').write_text(json.dumps(points,indent=2,ensure_ascii=False),encoding='utf-8')
    print(f'{len(roads)} road polylines; {len(points)} server points')
    for p in points: print(p['name'], round(p['x']), round(p['z']))


if __name__ == '__main__': main()
