"""Create the separate Lucky UI shell from the preserved classic implementation."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'app/MapApp.cs').read_text(encoding='utf-8-sig')
s=s.replace('public class MainForm : Form','public partial class MainForm : Form')
s=s.replace('CalculationTabs=new TabControl{','CalculationTabs=new LuckyTabs{')
s=s.replace('new ComboBox{','new LuckyComboBox{')
s=s.replace('M777 · M107 HE · мод 2.1.5','M777 · мод 2.1.5')
s=s.replace('updatingTable=true;FillRings(-1);', 'int preferred=RingsChoice.SelectedItem==null?-1:(int)RingsChoice.SelectedItem;updatingTable=true;FillRings(preferred);')
s=s.replace('private Bitmap background,roads;','private Bitmap background;\n        private VectorRoadLayer vectorRoads;')
s=s.replace('roads=new Bitmap(Path.Combine(folder,"desktop-roads.jpg"));','vectorRoads=new VectorRoadLayer(Path.Combine(folder,"roads.json"));')
s=s.replace('Path.Combine(detailFolder,ShowRoads?"roads":"background",','Path.Combine(detailFolder,"background",')
s=s.replace('g.DrawImage(ShowRoads?roads:background,','g.DrawImage(background,')
s=s.replace('            DrawDetail(g);','            DrawDetail(g);\n            if(ShowRoads)vectorRoads.Draw(g,this);')
s=s.replace('background.Dispose();roads.Dispose();','background.Dispose();vectorRoads.Dispose();')
s=s.replace('private VectorRoadLayer vectorRoads;', 'private VectorRoadLayer vectorRoads;\n        private VectorBuildingLayer vectorBuildings;\n        public bool ShowBuildings=true;')
s=s.replace('vectorRoads=new VectorRoadLayer(Path.Combine(folder,"roads.json"));', 'vectorRoads=new VectorRoadLayer(Path.Combine(folder,"roads.json"));\n            vectorBuildings=new VectorBuildingLayer(Path.Combine(folder,"buildings.json"));')
s=s.replace('if(ShowRoads)vectorRoads.Draw(g,this);', 'if(ShowRoads)vectorRoads.Draw(g,this);\n            if(ShowBuildings)vectorBuildings.Draw(g,this);')
s=s.replace('vectorRoads.Dispose();', 'vectorRoads.Dispose();vectorBuildings.Dispose();')
s=s.replace('            GameSolution s=CurrentSolution;', '            if(t!=null&&t.shell=="M116 SMOKE")calculationNotice.Text="M116: баллистика M107 · "+propellant+" · 6400 mil\\nСрабатывание дыма, высоты, ветер и препятствия не учтены.";\n            GameSolution s=CurrentSolution;')
s=s.replace('private static Color panel=Color.FromArgb(29,38,38),text=Color.FromArgb(228,235,230),accent=Color.FromArgb(78,215,189);','private static Color panel=LuckyTheme.Panel,text=LuckyTheme.Text,accent=LuckyTheme.Gold;')
start=s.index('            rootPath=root;statePath=')
end=s.index('        private Label AddLabel',start)
s=s[:start]+'''            InitializeLucky(root);
        }
'''+s[end:]
s=s.replace('Button b=new Button{','Button b=new LuckyButton{')
s=s.replace('Height=31,FlatStyle=FlatStyle.Flat,BackColor=Color.FromArgb(43,58,56)','Height=38,FlatStyle=FlatStyle.Flat,BackColor=LuckyTheme.Field')
s=s.replace('b.Click+=(s,e)=>action();parent.Controls.Add(b);return b;','b.Click+=(s,e)=>action();parent.Controls.Add(b);return b;')
s=s.replace('Text="Бахмут · игровая карта"+(dirty?"  • не сохранено":"")+" | Arma Reforger";','Text="LuckyGames · Бахмут — Орудие "+Fleet.ActiveId+(dirty?" • не сохранено":"");\n            RefreshGunMarkers();')
s=s.replace('UpdateSolution();\n            UpdatePlanning();','UpdateSolution();\n            UpdatePlanning();\n            if(readout!=null)readout.SetSolution(CurrentSolution,WeaponChoice.SelectedIndex==1,Fleet.ActiveId);')
s=s.replace('WeaponChoice.SelectedIndexChanged+=(s,e)=>{State.WeaponId','WeaponChoice.SelectedIndexChanged+=(s,e)=>{if(switchingGun)return;State.WeaponId')
s=s.replace('private void PlanningChanged() {','private void PlanningChanged() {\n            if(switchingGun)return;')
s=s.replace('private void TableChanged() {GameTable','private void TableChanged() {if(switchingGun)return;GameTable')
s=s.replace('artillery?"Charge:":"Колец:"','artillery?"Заряд:":"Колец:"')
start=s.index('        public bool SaveState()')
end=s.index('        private void OnClosing',start)
s=s[:start]+'''        public bool SaveState() { try {SaveFleet();dirty=false;Sync();status.Text="Все орудия, точки и настройки сохранены";return true;}catch(Exception ex){MessageBox.Show(this,"Не удалось сохранить: "+ex.Message,"Ошибка сохранения");return false;} }
'''+s[end:]
s=s.replace('Сохранить позиции и названия перед закрытием?','Сохранить все орудия, позиции и названия перед закрытием?')
s=s.replace('        public CandidateMask Candidates;','        public CandidateMask Candidates;\n        public List<Site> GunMarkers=new List<Site>();\n        public string PositionCaption="A1 · Позиция";')
s=s.replace('            DrawMarker(g,Position,"A · Позиция",','            foreach(Site gun in GunMarkers)DrawMarker(g,new MapPoint(gun.x,gun.z),gun.name,Color.FromArgb(159,180,154));\n            DrawMarker(g,Position,PositionCaption,')
(root/'app-lucky/MapApp.cs').write_text(s,encoding='utf-8-sig')
