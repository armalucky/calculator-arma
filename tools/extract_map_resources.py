"""Extract selected local game-map resources; originals are only read."""
from pathlib import Path, PurePosixPath
import sys
import json
import hashlib
from dataclasses import asdict

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/vendor/reforger-pak-extract'))
from pak_extractor import PakArchive


def extract(package, include):
    source = ROOT / 'references' / package
    archive = PakArchive.open(str(source / 'data.pak'))
    (source / 'archive-index.json').write_text(
        json.dumps([asdict(e) for e in archive.entries], indent=2), encoding='utf-8')
    destination = (ROOT / 'data/extracted' / package).resolve()
    results = []
    for entry in archive.entries:
        if not include(entry.path):
            continue
        relative = PurePosixPath(entry.path.replace('\\', '/'))
        if relative.is_absolute() or '..' in relative.parts or ':' in entry.path:
            raise ValueError(f'Unsafe archive path: {entry.path}')
        target = destination.joinpath(*relative.parts).resolve()
        if not target.is_relative_to(destination):
            raise ValueError(f'Path escapes output root: {entry.path}')
        if entry.body_offset < 0 or entry.stored_size < 0 or entry.plain_size < 0:
            raise ValueError(f'Negative entry bounds: {entry.path}')
        if entry.body_offset + entry.stored_size > (source / 'data.pak').stat().st_size:
            raise ValueError(f'Entry exceeds archive: {entry.path}')
        body = archive.read_body(entry)
        if len(body) != entry.plain_size:
            raise ValueError(f'Unexpected decoded size: {entry.path}')
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and target.read_bytes() != body:
            raise ValueError(f'Refusing to overwrite changed output: {target}')
        if not target.exists():
            target.write_bytes(body)
        results.append({'path': entry.path, 'bytes': len(body),
                        'sha256': hashlib.sha256(body).hexdigest()})
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'extraction-manifest.json').write_text(
        json.dumps(results, indent=2), encoding='utf-8')
    print(f'{package}: {len(archive.entries)} indexed, {len(results)} extracted, '
          f'{sum(r["bytes"] for r in results):,} decoded bytes; all lengths verified')


if __name__ == '__main__':
    extract('mod-bakhmut-city', lambda p: (
        p.endswith(('.terr', '.topo', '.ent', '.layer', '.ttile'))
        or p.startswith('Images/') or (p.startswith('Bakhmut City/') and '/.Data/' not in p)))
    extract('mod-luckygames', lambda p: p.startswith(('worlds/', 'missions/')))
