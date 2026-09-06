"""Transcription of user-supplied Arma Reforger screenshots, not real-world tables.

Only horizontal distance, game elevation and game flight time are transcribed.
Missing pages and wind/height corrections are deliberately not inferred.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Rows: distance in game metres, elevation in game 6000-circle units, seconds.
SOURCES = [
    ('he4', 'О-832ДУ · осколочный', 4, '2.jpg', 400, 100,
     '1419/33.0 1398/32.9 1377/32.9 1355/32.8 1333/32.6 1311/32.5 1288/32.3 1265/32.1 1240/31.9 1216/31.7 1189/31.4 1162/31.1 1134/30.8 1103/30.4 1071/29.9 1036/29.4 996/28.8 952/28.0 899/27.0 825/25.5'),
    ('he3', 'О-832ДУ · осколочный', 3, '3.jpg', 300, 100,
     '1423/29.0 1397/28.9 1370/28.8 1343/28.7 1316/28.6 1287/28.4 1257/28.2 1227/27.9 1194/27.6 1160/27.3 1125/26.9 1085/26.4 1042/25.9 993/25.2 935/24.3 855/22.9'),
    ('he2', 'О-832ДУ · осколочный', 2, '4.jpg', 200, 100,
     '1432/24.8 1397/24.8 1362/24.7 1326/24.5 1288/24.3 1249/24.1 1208/23.8 1163/23.4 1115/22.9 1062/22.4 999/21.6 917/20.5 765/18.1'),
    ('he1', 'О-832ДУ · осколочный', 1, '5.jpg', 100, 100,
     '1446/19.5 1392/19.4 1336/19.2 1276/19.0 1213/18.7 1142/18.2 1060/17.5 955/16.5'),
    ('he0', 'О-832ДУ · осколочный', 0, '6.jpg', 50, 50,
     '1456/15.0 1411/15.0 1365/14.9 1319/14.8 1269/14.6 1218/14.4 1160/14.1 1097/13.7 1025/13.3 927/12.5'),
    ('smoke3', 'Д-832ДУ · дымовой', 3, '7.jpg', 400, 100,
     '1387/27.4 1358/27.3 1328/27.1 1297/27.0 1265/26.8 1231/26.5 1196/26.2 1160/25.9 1120/25.5 1077/25.0 1028/24.4 971/23.6 899/22.5 761/20.0'),
    ('smoke2', 'Д-832ДУ · дымовой', 2, '8.jpg', 300, 100,
     '1388/23.5 1349/23.4 1309/23.2 1267/23.0 1223/22.7 1176/22.4 1124/21.9 1066/21.3 996/20.5 906/19.3'),
    ('smoke1', 'Д-832ДУ · дымовой', 1, '9.jpg', 200, 100,
     '1381/18.5 1319/18.3 1253/18.0 1180/17.6 1098/17.0 995/16.1 816/14.1'),
    ('smoke0', 'Д-832ДУ · дымовой', 0, '10.jpg', 50, 50,
     '1450/14.1 1399/14.1 1347/13.9 1293/13.8 1236/13.6 1173/13.3 1104/12.9 1022/12.4 904/11.5'),
    ('illum4', 'С-832С · осветительный', 4, '11.jpg', 400, 100,
     '1411/35.4 1388/35.4 1365/35.2 1341/35.1 1317/35.0 1292/34.8 1266/34.6 1239/34.3 1211/34.0 1182/33.7 1152/33.4 1120/33.0 1086/32.5 1050/32.0 1011/31.3 968/30.6 920/29.7 864/28.6 793/27.1'),
    ('illum3', 'С-832С · осветительный', 3, '12.jpg', 300, 100,
     '1411/29.1 1380/29.0 1348/28.8 1316/28.7 1282/28.5 1247/28.2 1210/27.9 1171/27.5 1129/27.1 1084/26.6 1034/26.0 976/25.1 907/24.1 813/22.5'),
]


def main():
    tables = []
    for key, shell, rings, source, start, step, text in SOURCES:
        rows = []
        for i, pair in enumerate(text.split()):
            elevation, seconds = pair.split('/')
            rows.append(dict(distance=start+i*step, elevation=int(elevation), seconds=float(seconds)))
        assert (ROOT / 'references/screenshots' / source).is_file()
        tables.append(dict(id=key, shell=shell, rings=rings,
                           source='references/screenshots/'+source, rows=rows))
    output = ROOT / 'data/game-tables.json'
    output.write_text(json.dumps(tables, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'{len(tables)} game tables, {sum(len(t["rows"]) for t in tables)} rows -> {output}')


if __name__ == '__main__':
    main()
