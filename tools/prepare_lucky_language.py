"""Generate localized build sources; classic files remain untouched."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ru=json.loads((root/'tools/language-strings.json').read_text(encoding='utf-8'))
en=json.loads((root/'tools/english-strings.json').read_text(encoding='utf-8'))
assert len(ru)==len(en),(len(ru),len(en))
translations=dict(zip(ru,en))
translations.update({
 'Оконный режим · F11 / Esc':'Windowed mode · F11 / Esc',
 'На весь экран · F11':'Fullscreen · F11',
 'Не удалось сохранить режим окна: ':'Could not save window mode: ',
 'О-832ДУ · осколочный':'O-832DU · HE',
 'Д-832ДУ · дымовой':'D-832DU · smoke',
 'С-832С · осветительный':'S-832S · illumination',
 'Язык':'Language',
 'Не удалось сохранить язык: ':'Could not save language: ',
 'Некорректный список орудий.':'Invalid gun list.',
 'Сохранение слишком большое.':'Save is too large.',
 'Пустое сохранение.':'Empty save.'
 ,'Слишком много данных для сохранения.':'Too much data to save.'
})
out=root/'app-lucky/generated';out.mkdir(exist_ok=True)
# Skip comments while rewriting string literals, preserving escaped characters.
token=re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:[^"\\]|\\.)*"')
for name in ['app-lucky/MapApp.cs','app-lucky/LuckyUI.cs','app-lucky/Fleet.cs','app/GameTables.cs','app/PositionPlanner.cs']:
 s=(root/name).read_text(encoding='utf-8-sig')
 def replace(m):
  value=m.group()
  if not value.startswith('"') or not re.search('[А-Яа-яЁё]',value):return value
  decoded=json.loads(value)
  if decoded not in translations:raise ValueError('Missing translation: '+repr(decoded))
  return 'LuckyLanguage.T('+value+')'
 s=token.sub(replace,s)
 (out/Path(name).name).write_text(s,encoding='utf-8-sig')
entries=',\n'.join('{'+json.dumps(k,ensure_ascii=False)+','+json.dumps(v,ensure_ascii=False)+'}' for k,v in translations.items())
(out/'LanguageData.cs').write_text('using System.Collections.Generic; namespace BakhmutMap { public static partial class LuckyLanguage { private static readonly Dictionary<string,string> Words=new Dictionary<string,string>{'+entries+'}; }}',encoding='utf-8-sig')
print('Localized build sources generated')
