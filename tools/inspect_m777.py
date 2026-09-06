"""Inventory supplied M777 game configuration without executing mod scripts."""
import hashlib
import json
import re
from pathlib import Path
from extract_map_layers import parse, walk

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/extracted/mod-m777'
MANUAL = BASE / 'Prefabs/Items/Equipment/BallisticTable/BallisticTable_US_Artillery.et'


def main():
    pages = []
    for node in walk(parse(MANUAL)):
        if not node.header.startswith('SCR_VisualisedBallisticConfig '):
            continue
        fields = {}
        for line in node.lines:
            match = re.fullmatch(r'(m_\w+)\s+(.+)', line)
            if match:
                key, value = match.groups()
                fields[key] = value.strip('"')
        pages.append(fields)
    assert pages and all(p['m_sUnitType'] == 'MILS_NATO' for p in pages)
    result = dict(modId='686AC479236F235D', version='2.1.5', title='M777 Howitzer Artillery',
                  source=str(MANUAL.relative_to(ROOT)).replace('\\', '/'),
                  sourceSha256=hashlib.sha256(MANUAL.read_bytes()).hexdigest(),
                  status='page definitions only; generated range/elevation/time rows still required',
                  unitsPerCircle=6400, pages=pages)
    output = ROOT / 'data/m777-page-catalog.json'
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'{len(pages)} page definitions saved')
    for p in pages:
        print(p['m_sDisplayedText'], p.get('m_iMinRange'), p.get('m_iMaxRange'))


if __name__ == '__main__':
    main()
