using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace BakhmutMap {
    public class MapPoint {
        public double X { get; set; }
        public double Z { get; set; }
        public MapPoint() { }
        public MapPoint(double x, double z) { X=x; Z=z; }
    }
    public class Site {
        public string id { get; set; }
        public string name { get; set; }
        public double x { get; set; }
        public double z { get; set; }
        public string source { get; set; }
        public override string ToString() { return name+"  ·  "+Coordinates.Grid(new MapPoint(x,z)); }
    }
    public class Session {
        public int Version { get; set; }
        public MapPoint Position { get; set; }
        public MapPoint Target { get; set; }
        public Dictionary<string,string> Names { get; set; }
        public List<Site> Bookmarks { get; set; }
        public string TableId { get; set; }
        public string WeaponId { get; set; }
        public string M777TableId {get;set;}
        public int NamingVersion { get; set; }
        public PlanningOptions Planning { get; set; }
        public Session() { Version=1; Names=new Dictionary<string,string>(); Bookmarks=new List<Site>();Planning=new PlanningOptions(); }
    }
    public static class Coordinates {
        public const double Extent=10240;
        public static bool Valid(MapPoint p) { return p!=null && !Double.IsNaN(p.X) && !Double.IsNaN(p.Z) && p.X>=0 && p.Z>=0 && p.X<=Extent && p.Z<=Extent; }
        public static string Grid(MapPoint p) { return ((int)Math.Floor(p.X/100)).ToString("000")+" "+((int)Math.Floor(p.Z/100)).ToString("000"); }
        public static double Distance(MapPoint a,MapPoint b) { return Math.Sqrt(Math.Pow(a.X-b.X,2)+Math.Pow(a.Z-b.Z,2)); }
        public static MapPoint Parse(string text,bool grid) {
            string[] values=text.Trim().Split(new char[]{' ',';','\t'},StringSplitOptions.RemoveEmptyEntries);
            if(values.Length!=2) throw new FormatException("Введите две координаты через пробел.");
            double x,z;
            if(!Double.TryParse(values[0].Replace(',','.'),NumberStyles.Float,CultureInfo.InvariantCulture,out x) || !Double.TryParse(values[1].Replace(',','.'),NumberStyles.Float,CultureInfo.InvariantCulture,out z)) throw new FormatException("Координаты должны быть числами.");
            if(grid) {
                if(x!=Math.Floor(x)||z!=Math.Floor(z)||x<0||z<0||x>102||z>102) throw new FormatException("Номер клетки — целое число от 000 до 102.");
                // Final cells are clipped by the 10240 m terrain edge.
                x=(x*100+Math.Min((x+1)*100,Extent))/2;
                z=(z*100+Math.Min((z+1)*100,Extent))/2;
            }
            MapPoint result=new MapPoint(x,z);
            if(!Valid(result)) throw new FormatException("Точка должна быть в пределах карты: 0–10240 м.");
            return result;
        }
        public static void Validate(Session s) {
            if(s==null||s.Version!=1||s.Names==null||s.Bookmarks==null) throw new FormatException("Неизвестный формат сохранения.");
            if(!PlanningOptions.Valid(s.Planning))throw new FormatException("Некорректные параметры подбора позиции.");
            if((s.Position!=null&&!Valid(s.Position))||(s.Target!=null&&!Valid(s.Target))) throw new FormatException("Некорректные координаты в сохранении.");
            if(s.Bookmarks.Count>1000 || s.Bookmarks.Any(b=>b==null||String.IsNullOrEmpty(b.id)||String.IsNullOrWhiteSpace(b.name)||!Valid(new MapPoint(b.x,b.z)))) throw new FormatException("Некорректные сохранённые точки.");
        }
    }
    public static class Storage {
        public static Session Load(string path) {
            if(new FileInfo(path).Length>2000000) throw new FormatException("Файл сохранения слишком большой.");
            Session s=new JavaScriptSerializer().Deserialize<Session>(File.ReadAllText(path)); Coordinates.Validate(s); return s;
        }
        public static void Save(string path,Session s) {
            Coordinates.Validate(s);
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            string temp=path+".tmp";
            File.WriteAllText(temp,new JavaScriptSerializer().Serialize(s),System.Text.Encoding.UTF8);
            if(File.Exists(path)) File.Replace(temp,path,path+".bak"); else File.Move(temp,path);
        }
    }
    public class MapCanvas : Control {
        private Bitmap background;
        private VectorRoadLayer vectorRoads;
        private VectorBuildingLayer vectorBuildings;
        public bool ShowBuildings=true;
        private readonly string detailFolder;
        private readonly Dictionary<string,Bitmap> detailCache=new Dictionary<string,Bitmap>();
        private readonly LinkedList<string> detailOrder=new LinkedList<string>();
        public CandidateMask Candidates;
        public List<Site> GunMarkers=new List<Site>();
        public string PositionCaption="A1 · Позиция";
        public List<Site> Sites=new List<Site>();
        public MapPoint Position,Target;
        public bool ShowRoads=true,ShowGrid=true,ShowNames=true;
        public string Mode="move";
        public double PixelsPerMetre=0.08,CenterX=5120,CenterZ=5120;
        public Action<MapPoint> PointPicked;
        public Action<MapPoint> Hover;
        private bool dragging;
        private Point dragStart;
        private double startX,startZ;
        public MapCanvas(string folder) {
            SetStyle(ControlStyles.AllPaintingInWmPaint|ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw|ControlStyles.Selectable,true);
            TabStop=true; BackColor=Color.FromArgb(21,27,27);
            background=new Bitmap(Path.Combine(folder,"desktop-background.jpg"));
            vectorRoads=new VectorRoadLayer(Path.Combine(folder,"roads.json"));
            vectorBuildings=new VectorBuildingLayer(Path.Combine(folder,"buildings.json"));
            detailFolder=Path.Combine(folder,"detail");
            AccessibleName="Игровая карта Бахмута";
        }
        public PointF Screen(MapPoint p) { return new PointF((float)(Width/2.0+(p.X-CenterX)*PixelsPerMetre),(float)(Height/2.0-(p.Z-CenterZ)*PixelsPerMetre)); }
        public MapPoint World(PointF p) { return new MapPoint(CenterX+(p.X-Width/2.0)/PixelsPerMetre,CenterZ-(p.Y-Height/2.0)/PixelsPerMetre); }
        public void Fit() { PixelsPerMetre=Math.Max(.02,Math.Min(Width,Height)/Coordinates.Extent*.94); CenterX=CenterZ=5120; Invalidate(); }
        public void Zoom(double multiplier,PointF anchor) {
            MapPoint before=World(anchor); PixelsPerMetre=Math.Max(.025,Math.Min(5,PixelsPerMetre*multiplier));
            MapPoint after=World(anchor);CenterX+=before.X-after.X;CenterZ+=before.Z-after.Z;ClampCenter();Invalidate();
        }
        public void FocusPoint(MapPoint p) { CenterX=p.X;CenterZ=p.Z;PixelsPerMetre=Math.Max(.6,PixelsPerMetre);Invalidate(); }
        public void FramePair() {
            if(Position==null&&Target==null) { Fit();return; }
            if(Position==null||Target==null) { FocusPoint(Position??Target);return; }
            CenterX=(Position.X+Target.X)/2;CenterZ=(Position.Z+Target.Z)/2;
            PixelsPerMetre=Math.Min((Width-100)/Math.Max(300,Math.Abs(Position.X-Target.X)),(Height-100)/Math.Max(300,Math.Abs(Position.Z-Target.Z)));
            PixelsPerMetre=Math.Max(.025,Math.Min(3,PixelsPerMetre));Invalidate();
        }
        private void ClampCenter() { CenterX=Math.Max(-1024,Math.Min(11264,CenterX));CenterZ=Math.Max(-1024,Math.Min(11264,CenterZ)); }
        protected override void OnMouseDown(MouseEventArgs e) {
            base.OnMouseDown(e);Focus();
            if(e.Button==MouseButtons.Right||e.Button==MouseButtons.Middle||(e.Button==MouseButtons.Left&&Mode=="move")) {
                dragging=true;Capture=true;dragStart=e.Location;startX=CenterX;startZ=CenterZ;Cursor=Cursors.SizeAll;
            } else if(e.Button==MouseButtons.Left) { MapPoint p=World(e.Location);if(Coordinates.Valid(p)&&PointPicked!=null)PointPicked(p); }
        }
        protected override void OnMouseMove(MouseEventArgs e) {
            base.OnMouseMove(e);
            if(dragging) { CenterX=startX-(e.X-dragStart.X)/PixelsPerMetre;CenterZ=startZ+(e.Y-dragStart.Y)/PixelsPerMetre;ClampCenter();Invalidate(); }
            if(Hover!=null)Hover(World(e.Location));
        }
        protected override void OnMouseUp(MouseEventArgs e) { base.OnMouseUp(e);dragging=false;Capture=false;Cursor=Mode=="move"?Cursors.Hand:Cursors.Cross; }
        protected override void OnMouseWheel(MouseEventArgs e) { base.OnMouseWheel(e);Zoom(e.Delta>0?1.3:1/1.3,e.Location); }
        protected override bool IsInputKey(Keys keyData) { if(new[]{Keys.Left,Keys.Right,Keys.Up,Keys.Down}.Contains(keyData))return true;return base.IsInputKey(keyData); }
        protected override void OnKeyDown(KeyEventArgs e) {
            base.OnKeyDown(e);double step=80/PixelsPerMetre;
            if(e.KeyCode==Keys.Left)CenterX-=step;if(e.KeyCode==Keys.Right)CenterX+=step;
            if(e.KeyCode==Keys.Up)CenterZ+=step;if(e.KeyCode==Keys.Down)CenterZ-=step;
            if(e.KeyCode==Keys.Home)Fit();ClampCenter();Invalidate();
        }
        private void TextAt(Graphics g,string text,float x,float y,Color colour) {
            using(Brush shadow=new SolidBrush(Color.FromArgb(210,17,24,24)))using(Brush ink=new SolidBrush(colour)) {
                SizeF size=g.MeasureString(text,Font);g.FillRectangle(shadow,x-2,y-1,size.Width+4,size.Height+2);g.DrawString(text,Font,ink,x,y);
            }
        }
        private Bitmap DetailTile(int x,int y) {
            string path=Path.Combine(detailFolder,"background",x+"_"+y+".png");
            Bitmap tile;
            if(detailCache.TryGetValue(path,out tile)) {detailOrder.Remove(path);detailOrder.AddLast(path);return tile;}
            if(!File.Exists(path))return null; // Keep the overview for older/incomplete data packs.
            tile=new Bitmap(path);
            if(tile.Width!=1026||tile.Height!=1026) {tile.Dispose();return null;}
            while(detailCache.Count>=24) {string oldest=detailOrder.First.Value;detailCache[oldest].Dispose();detailCache.Remove(oldest);detailOrder.RemoveFirst();}
            detailCache.Add(path,tile);detailOrder.AddLast(path);return tile;
        }
        private void DrawDetail(Graphics g) {
            if(PixelsPerMetre<.5)return;
            MapPoint a=World(new PointF(0,0)),b=World(new PointF(Width,Height));
            int left=Math.Max(0,(int)Math.Floor(a.X/1024)),right=Math.Min(9,(int)Math.Floor(b.X/1024));
            int top=Math.Max(0,(int)Math.Floor((Coordinates.Extent-a.Z)/1024)),bottom=Math.Min(9,(int)Math.Floor((Coordinates.Extent-b.Z)/1024));
            GraphicsState state=g.Save();
            try {
                g.PixelOffsetMode=PixelOffsetMode.Half;
                for(int y=top;y<=bottom;y++)for(int x=left;x<=right;x++) {
                    Bitmap tile=DetailTile(x,y);if(tile==null)continue;
                    PointF nw=Screen(new MapPoint(x*1024,Coordinates.Extent-y*1024));
                    PointF se=Screen(new MapPoint((x+1)*1024,Coordinates.Extent-(y+1)*1024));
                    g.DrawImage(tile,new RectangleF(nw.X,nw.Y,se.X-nw.X,se.Y-nw.Y),new RectangleF(1,1,1024,1024),GraphicsUnit.Pixel);
                }
            } finally {g.Restore(state);}
        }
        protected override void OnPaint(PaintEventArgs e) {
            base.OnPaint(e);Graphics g=e.Graphics;g.InterpolationMode=InterpolationMode.Bilinear;
            PointF nw=Screen(new MapPoint(0,Coordinates.Extent));float size=(float)(Coordinates.Extent*PixelsPerMetre);
            g.DrawImage(background,new RectangleF(nw.X,nw.Y,size,size));
            DrawDetail(g);
            if(ShowRoads)vectorRoads.Draw(g,this);
            if(ShowBuildings)vectorBuildings.Draw(g,this);
            if(Candidates!=null) {g.InterpolationMode=InterpolationMode.NearestNeighbor;g.PixelOffsetMode=PixelOffsetMode.Half;g.DrawImage(Candidates.Image,new RectangleF(nw.X,nw.Y,size,size));g.PixelOffsetMode=PixelOffsetMode.Default;g.InterpolationMode=InterpolationMode.Bilinear;}
            if(ShowGrid) {
                int cell=PixelsPerMetre>=.65?100:PixelsPerMetre>=.2?500:1000;
                MapPoint topLeft=World(new PointF(0,0)),bottomRight=World(new PointF(Width,Height));
                using(Pen pen=new Pen(Color.FromArgb(90,215,219,193))) {
                    for(int x=Math.Max(0,(int)Math.Ceiling(topLeft.X/cell)*cell);x<=Math.Min(10240,bottomRight.X);x+=cell) {
                        float sx=Screen(new MapPoint(x,0)).X;g.DrawLine(pen,sx,Math.Max(0,nw.Y),sx,Math.Min(Height,nw.Y+size));TextAt(g,(x/100).ToString("000"),sx+3,5,Color.Gainsboro);
                    }
                    for(int z=Math.Max(0,(int)Math.Ceiling(bottomRight.Z/cell)*cell);z<=Math.Min(10240,topLeft.Z);z+=cell) {
                        float sy=Screen(new MapPoint(0,z)).Y;g.DrawLine(pen,Math.Max(0,nw.X),sy,Math.Min(Width,nw.X+size),sy);TextAt(g,(z/100).ToString("000"),5,sy+3,Color.Gainsboro);
                    }
                }
            }
            g.SmoothingMode=SmoothingMode.AntiAlias;
            if(ShowNames) foreach(Site site in Sites) {
                PointF p=Screen(new MapPoint(site.x,site.z));if(p.X<-100||p.Y<-30||p.X>Width||p.Y>Height)continue;
                g.FillEllipse(Brushes.Coral,p.X-3,p.Y-3,6,6);TextAt(g,site.name,p.X+7,p.Y-8,Color.WhiteSmoke);
            }
            if(Position!=null&&Target!=null)using(Pen pen=new Pen(Color.FromArgb(220,220,243,240),2)) { pen.DashStyle=DashStyle.Dash;g.DrawLine(pen,Screen(Position),Screen(Target)); }
            foreach(Site gun in GunMarkers)DrawMarker(g,new MapPoint(gun.x,gun.z),gun.name,Color.FromArgb(159,180,154));
            DrawMarker(g,Position,PositionCaption,Color.FromArgb(77,221,198));DrawMarker(g,Target,"B · Цель",Color.FromArgb(255,163,112));
            int metres=PixelsPerMetre>.7?100:PixelsPerMetre>.2?500:1000;float length=(float)(metres*PixelsPerMetre);
            using(Pen p=new Pen(Color.WhiteSmoke,3))g.DrawLine(p,22,Height-25,22+length,Height-25);
            TextAt(g,metres+" м",22,Height-48,Color.WhiteSmoke);
            TextAt(g,"Север ↑",Width-80,Height-32,Color.WhiteSmoke);
        }
        private void DrawMarker(Graphics g,MapPoint point,string label,Color colour) {
            if(point==null)return;PointF p=Screen(point);
            using(Brush b=new SolidBrush(colour))using(Pen pen=new Pen(Color.White,2)) { g.FillEllipse(b,p.X-7,p.Y-7,14,14);g.DrawEllipse(pen,p.X-7,p.Y-7,14,14); }
            string caption=label+"  "+Coordinates.Grid(point);
            float labelWidth=g.MeasureString(caption,Font).Width;
            float labelX=p.X+12;if(labelX+labelWidth>Width-5)labelX=p.X-labelWidth-12;
            TextAt(g,caption,labelX,p.Y-11,colour);
        }
        protected override void Dispose(bool disposing) { if(disposing) {background.Dispose();vectorRoads.Dispose();vectorBuildings.Dispose();foreach(Bitmap tile in detailCache.Values)tile.Dispose();detailCache.Clear();detailOrder.Clear();if(Candidates!=null)Candidates.Dispose();}base.Dispose(disposing); }
    }
    public partial class MainForm : Form {
        public MapCanvas Map;
        public Session State=new Session();
        public TextBox PositionInput,TargetInput;
        public ComboBox PositionFormat,TargetFormat;
        public ComboBox ShellChoice,RingsChoice;
        public ComboBox WeaponChoice;
        public ComboBox TrajectoryChoice;
        private Label chargeLabel;
        private Label calculationNotice;
        public Label SolutionText;
        public GameSolution CurrentSolution;
        private Label tableSource;
        private List<GameTable> gameTables;
        private bool updatingTable;
        public TabControl CalculationTabs;
        public CheckBox ShowCandidates;
        public NumericUpDown ReserveInput,RoadOffsetInput,SiteOffsetInput;
        public Label PlanningText;
        public PositionAssessment Assessment;
        private Label planningSummary;
        private RoadIndex roadIndex;
        private string maskKey;
        private Label result,status,notice;
        private ListBox sites;
        private TextBox siteName;
        private string rootPath,statePath;
        private List<Site> originals;
        private bool dirty;
        private static Color panel=LuckyTheme.Panel,text=LuckyTheme.Text,accent=LuckyTheme.Gold;
        public MainForm(string root) {
            InitializeLucky(root);
        }
        private Label AddLabel(Control parent,string caption,float size,int height,Color colour) { Label l=new Label{Text=caption,Width=276,Height=height,Font=new Font("Segoe UI",size),ForeColor=colour,Margin=new Padding(0,0,0,4)};parent.Controls.Add(l);return l; }
        private Button AddButton(Control parent,string caption,int width,Action action) { Button b=new LuckyButton{Text=caption,Width=width,Height=38,FlatStyle=FlatStyle.Flat,BackColor=LuckyTheme.Field,ForeColor=text,Margin=new Padding(0,0,4,4)};b.Click+=(s,e)=>action();parent.Controls.Add(b);return b; }
        private void Check(Control parent,string caption,Action<bool> action) { CheckBox c=new CheckBox{Text=caption,Checked=true,AutoSize=true,Margin=new Padding(0,2,7,0)};c.CheckedChanged+=(s,e)=>action(c.Checked);parent.Controls.Add(c); }
        private void AddPointInput(Control parent,bool position) {
            AddLabel(parent,position?"A · Позиция":"B · Цель",11,25,position?accent:Color.FromArgb(255,172,121));
            ComboBox format=new LuckyComboBox{Width=276,DropDownStyle=ComboBoxStyle.DropDownList};format.Items.AddRange(new object[]{"Клетка: 051 094","Точные X Z, метры"});format.SelectedIndex=0;parent.Controls.Add(format);
            FlowLayoutPanel row=new FlowLayoutPanel{Width=280,Height=36,WrapContents=false};parent.Controls.Add(row);
            TextBox input=new TextBox{Width=191,MaxLength=50,BackColor=Color.FromArgb(44,55,55),ForeColor=text,BorderStyle=BorderStyle.FixedSingle,Margin=new Padding(0,4,5,0)};row.Controls.Add(input);
            Action apply=()=>{try{SetPoint(position,Coordinates.Parse(input.Text,format.SelectedIndex==0));Map.FramePair();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Координаты",MessageBoxButtons.OK,MessageBoxIcon.Information);}};
            AddButton(row,"Задать",78,apply);input.KeyDown+=(s,e)=>{if(e.KeyCode==Keys.Enter){apply();e.SuppressKeyPress=true;}};
            if(position){PositionInput=input;PositionFormat=format;}else{TargetInput=input;TargetFormat=format;}
            format.SelectedIndexChanged+=(s,e)=>SyncInputs();
        }
        public void SetPoint(bool position,MapPoint p) { if(!Coordinates.Valid(p))throw new ArgumentException("Invalid map point");if(position)State.Position=p;else State.Target=p;dirty=true;Sync(); }
        private void SyncInputs() {
            if(PositionInput==null||TargetInput==null)return;
            PositionInput.Text=FormatPoint(State.Position,PositionFormat.SelectedIndex==0);TargetInput.Text=FormatPoint(State.Target,TargetFormat.SelectedIndex==0);
        }
        private string FormatPoint(MapPoint p,bool grid) { if(p==null)return "";return grid?Coordinates.Grid(p):String.Format(CultureInfo.InvariantCulture,"{0:0.###} {1:0.###}",p.X,p.Z); }
        private void Sync() {
            Map.Position=State.Position;Map.Target=State.Target;SyncInputs();Map.Invalidate();
            result.Text=State.Position!=null&&State.Target!=null?String.Format(CultureInfo.InvariantCulture,"Расстояние: {0:0.0} м\nПо горизонтальной карте",Coordinates.Distance(State.Position,State.Target)):"Выберите позицию и цель";
            Text="LuckyGames · Бахмут — Орудие "+Fleet.ActiveId+(dirty?" • не сохранено":"");
            RefreshGunMarkers();
            UpdateSolution();
            UpdatePlanning();
            if(readout!=null)readout.SetSolution(CurrentSolution,WeaponChoice.SelectedIndex==1,Fleet.ActiveId);
        }
        private void AddCalculationPanel(TableLayoutPanel area) {
            CalculationTabs=new LuckyTabs{Dock=DockStyle.Fill};area.Controls.Add(CalculationTabs,0,1);
            TabPage calculationPage=new TabPage("Расчёт"){BackColor=panel,ForeColor=text};CalculationTabs.TabPages.Add(calculationPage);
            FlowLayoutPanel box=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(12,6,8,4)};
            calculationPage.Controls.Add(box);
            FlowLayoutPanel weapons=new FlowLayoutPanel{Width=650,Height=34,WrapContents=false,Margin=Padding.Empty};box.Controls.Add(weapons);
            WeaponChoice=new LuckyComboBox{Width=310,DropDownStyle=ComboBoxStyle.DropDownList};
            WeaponChoice.Items.AddRange(new object[]{"Советский миномёт · 82 мм","M777 · мод 2.1.5"});
            WeaponChoice.SelectedIndex=State.WeaponId=="m777"?1:0;weapons.Controls.Add(WeaponChoice);
            TrajectoryChoice=new LuckyComboBox{Width=260,DropDownStyle=ComboBoxStyle.DropDownList};TrajectoryChoice.Items.AddRange(new object[]{"Высокая · High angle","Низкая · Low angle"});TrajectoryChoice.SelectedIndex=0;weapons.Controls.Add(TrajectoryChoice);
            FlowLayoutPanel choices=new FlowLayoutPanel{Width=650,Height=36,WrapContents=false,Margin=Padding.Empty};box.Controls.Add(choices);
            ShellChoice=new LuckyComboBox{Width=270,DropDownStyle=ComboBoxStyle.DropDownList};
            choices.Controls.Add(ShellChoice);
            chargeLabel=new Label{Text="Колец:",AutoSize=true,Margin=new Padding(10,7,4,0)};choices.Controls.Add(chargeLabel);
            RingsChoice=new LuckyComboBox{Width=75,DropDownStyle=ComboBoxStyle.DropDownList};choices.Controls.Add(RingsChoice);
            SolutionText=new Label{Width=650,Height=64,Font=new Font("Segoe UI",12),ForeColor=accent,Margin=new Padding(0,3,0,2)};box.Controls.Add(SolutionText);
            tableSource=new Label{Width=650,Height=36,Font=new Font("Segoe UI",9),ForeColor=Color.Silver};box.Controls.Add(tableSource);
            calculationNotice=new Label{Width=650,Height=38,Font=new Font("Segoe UI",9),ForeColor=Color.Silver};box.Controls.Add(calculationNotice);
            FillWeaponChoices();
            ShellChoice.SelectedIndexChanged+=(s,e)=>{if(updatingTable)return;int preferred=RingsChoice.SelectedItem==null?-1:(int)RingsChoice.SelectedItem;updatingTable=true;FillRings(preferred);updatingTable=false;TableChanged();};
            RingsChoice.SelectedIndexChanged+=(s,e)=>{if(!updatingTable)TableChanged();};
            WeaponChoice.SelectedIndexChanged+=(s,e)=>{if(switchingGun)return;State.WeaponId=ActiveWeapon();FillWeaponChoices();TableChanged();};
            TrajectoryChoice.SelectedIndexChanged+=(s,e)=>{if(updatingTable)return;int preferred=RingsChoice.SelectedItem==null?2:(int)RingsChoice.SelectedItem;updatingTable=true;FillRings(preferred);updatingTable=false;TableChanged();};
            AddPlanningPanel();
        }
        private NumericUpDown PlanningNumber(Control parent,string caption,double value,int maximum) {
            parent.Controls.Add(new Label{Text=caption,AutoSize=true,Margin=new Padding(0,7,3,0)});
            NumericUpDown input=new NumericUpDown{Width=65,Minimum=0,Maximum=maximum,Increment=50,Value=(decimal)value,Margin=new Padding(0,3,12,0)};parent.Controls.Add(input);return input;
        }
        private void AddPlanningPanel() {
            TabPage page=new TabPage("Подбор позиции"){BackColor=panel,ForeColor=text};CalculationTabs.TabPages.Add(page);
            FlowLayoutPanel box=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(12,5,8,4)};page.Controls.Add(box);
            FlowLayoutPanel top=new FlowLayoutPanel{Width=650,Height=34,WrapContents=false,Margin=Padding.Empty};box.Controls.Add(top);
            ShowCandidates=new CheckBox{Text="Показать область подбора",AutoSize=true,Checked=State.Planning.Show,Margin=new Padding(0,6,12,0)};top.Controls.Add(ShowCandidates);
            AddButton(top,"Показать вокруг цели",220,()=>{GameTable table=SelectedTable();if(State.Target!=null&&table!=null){double radius=Math.Max(300,table.rows.Last().distance-State.Planning.Reserve);double left=Math.Max(0,State.Target.X-radius),right=Math.Min(10240,State.Target.X+radius),bottom=Math.Max(0,State.Target.Z-radius),topEdge=Math.Min(10240,State.Target.Z+radius);Map.CenterX=(left+right)/2;Map.CenterZ=(bottom+topEdge)/2;Map.PixelsPerMetre=Math.Max(.025,Math.Min(Map.Width/(right-left+200),Map.Height/(topEdge-bottom+200)));Map.Invalidate();}});
            FlowLayoutPanel inputs=new FlowLayoutPanel{Width=650,Height=36,WrapContents=false,Margin=Padding.Empty};box.Controls.Add(inputs);
            ReserveInput=PlanningNumber(inputs,"Запас, м",State.Planning.Reserve,3000);
            RoadOffsetInput=PlanningNumber(inputs,"От дорог, м",State.Planning.RoadOffset,1000);
            SiteOffsetInput=PlanningNumber(inputs,"От точек, м",State.Planning.SiteOffset,2000);
            PlanningText=new Label{Width=650,Height=60,ForeColor=accent,Margin=new Padding(0,3,0,0)};box.Controls.Add(PlanningText);
            planningSummary=new Label{Width=650,Height=37,ForeColor=Color.Silver,Font=new Font("Segoe UI",9)};box.Controls.Add(planningSummary);
            box.Controls.Add(new Label{Text="Зелёное — проходит фильтры. Выберите A в режиме «Позиция».\nВода, здания, высоты и возможность установки не проверены.",Width=650,Height=37,ForeColor=Color.Silver,Font=new Font("Segoe UI",9)});
            ShowCandidates.CheckedChanged+=(s,e)=>PlanningChanged();ReserveInput.ValueChanged+=(s,e)=>PlanningChanged();RoadOffsetInput.ValueChanged+=(s,e)=>PlanningChanged();SiteOffsetInput.ValueChanged+=(s,e)=>PlanningChanged();
        }
        private void PlanningChanged() {
            if(switchingGun)return;
            State.Planning=new PlanningOptions{Reserve=(double)ReserveInput.Value,RoadOffset=(double)RoadOffsetInput.Value,SiteOffset=(double)SiteOffsetInput.Value,Show=ShowCandidates.Checked};dirty=true;Sync();
        }
        private void UpdatePlanning() {
            if(PlanningText==null)return;
            GameTable t=SelectedTable();PlanningOptions options=State.Planning;Assessment=null;
            string key=options.Show&&State.Target!=null&&t!=null?String.Format(CultureInfo.InvariantCulture,"{0}:{1:R}:{2:R}:{3}:{4}:{5}",t.id,State.Target.X,State.Target.Z,options.Reserve,options.RoadOffset,options.SiteOffset):"off";
            if(key!=maskKey) {
                CandidateMask next=key=="off"?null:PositionPlanner.CreateMask(t,State.Target,options,roadIndex,originals);
                CandidateMask old=Map.Candidates;Map.Candidates=next;maskKey=key;if(old!=null)old.Dispose();Map.Invalidate();
            }
            if(t==null||State.Target==null) {PlanningText.Text="Выберите цель B и игровую таблицу на вкладке «Расчёт».";planningSummary.Text="Отступ от точек применяется ко всем 10 точкам сценария.";return;}
            double min=t.rows.First().distance,max=t.rows.Last().distance-options.Reserve;
            string limits=max<min?"При таком запасе допустимой дальности нет.":String.Format("До цели: {0}–{1} м · {2}, {3}: {4}{5}",min,max,t.shell,t.weapon=="m777"?"заряд":"колец",t.rings,t.weapon=="m777"?(t.trajectory=="low"?" · Low":" · High"):"");
            string mask=Map.Candidates==null?"Слой выключен.":Map.Candidates.Cells==0?"Нет подходящих целых ячеек 20 м.":"Зелёные ячейки 20 м; границы показаны с запасом.";
            planningSummary.Text=limits+"\n"+mask;
            if(State.Position==null) {PlanningText.ForeColor=accent;PlanningText.Text="Выберите позицию A для проверки.\nОтступ считается от края дороги и от всех точек сценария.";return;}
            Assessment=PositionPlanner.Assess(t,State.Target,State.Position,options,roadIndex,originals);
            PlanningText.ForeColor=Assessment.Allowed?accent:Color.FromArgb(255,172,121);
            List<string> reasons=new List<string>();if(!Assessment.RangeAllowed)reasons.Add("дальность / запас");if(!Assessment.RoadAllowed)reasons.Add("близко к дороге");if(!Assessment.SiteAllowed)reasons.Add("близко к точке");
            PlanningText.Text=(Assessment.Allowed?"A проходит выбранные фильтры.":"A не подходит: "+String.Join(", ",reasons)+".")+String.Format(CultureInfo.InvariantCulture,"\nЗапас дальности {0:0} м · До края дороги {1:0} м\nДо ближайшей точки сценария {2:0} м",Assessment.Reserve,Assessment.RoadDistance,Assessment.SiteDistance);
        }
        private void FillRings(int preferred) {
            RingsChoice.Items.Clear();
            foreach(GameTable t in ActiveTables().Where(t=>t.shell==(string)ShellChoice.SelectedItem))RingsChoice.Items.Add(t.rings);
            RingsChoice.SelectedIndex=RingsChoice.Items.Contains(preferred)?RingsChoice.Items.IndexOf(preferred):(RingsChoice.Items.Count>0?0:-1);
        }
        private string ActiveWeapon() {return WeaponChoice.SelectedIndex==1?"m777":"mortar82";}
        private IEnumerable<GameTable> ActiveTables() {return gameTables.Where(t=>t.weapon==ActiveWeapon()&&(t.weapon!="m777"||t.trajectory==(TrajectoryChoice.SelectedIndex==1?"low":"high")));}
        private void FillWeaponChoices() {
            updatingTable=true;bool artillery=ActiveWeapon()=="m777";
            GameTable selected=gameTables.FirstOrDefault(t=>t.weapon==ActiveWeapon()&&t.id==(artillery?State.M777TableId:State.TableId))??gameTables.First(t=>t.id==(artillery?"m777-2-low":"he4"));
            TrajectoryChoice.Visible=artillery;TrajectoryChoice.SelectedIndex=selected.trajectory=="low"?1:0;
            chargeLabel.Text=artillery?"Заряд:":"Колец:";
            ShellChoice.Items.Clear();ShellChoice.Items.AddRange(ActiveTables().Select(t=>t.shell).Distinct().Cast<object>().ToArray());ShellChoice.SelectedItem=selected.shell;
            FillRings(selected.rings);updatingTable=false;
        }
        private GameTable SelectedTable() {return ActiveTables().FirstOrDefault(t=>t.shell==(string)ShellChoice.SelectedItem&&RingsChoice.SelectedItem!=null&&t.rings==(int)RingsChoice.SelectedItem);}
        private void TableChanged() {if(switchingGun)return;GameTable t=SelectedTable();if(t!=null){if(t.weapon=="m777")State.M777TableId=t.id;else State.TableId=t.id;}dirty=true;Sync();}
        private void UpdateSolution() {
            if(SolutionText==null)return;
            GameTable t=SelectedTable();CurrentSolution=GameTables.Calculate(t,State.Position,State.Target);
            bool artillery=WeaponChoice.SelectedIndex==1;
            string propellant=t==null?"":new[]{"","M231 Charge-1L","M231 Charge-2L","M232 Charge-3H","M232 Charge-4H","M232 Charge-5H"}[artillery?t.rings:0];
            calculationNotice.Text=artillery?"6400 mil на круг · "+propellant+"\nОдинаковая высота; ветер, разброс и препятствия не учтены.":"Одинаковая высота точек; ветер и разброс не учтены.\nОсветительные: доступны только 3 и 4 кольца — остальные страницы не предоставлены.";
            if(t!=null&&t.shell=="M116 SMOKE")calculationNotice.Text="M116: баллистика M107 · "+propellant+" · 6400 mil\nСрабатывание дыма, высоты, ветер и препятствия не учтены.";
            GameSolution s=CurrentSolution;
            if(s.Available) {
                SolutionText.ForeColor=accent;
                SolutionText.Text=String.Format(CultureInfo.InvariantCulture,"Азимут  {0:0.0}°  /  {1:0000} {5}\nВозвышение  {2:0000} {5}  /  {3:0.0}°     Полёт ≈ {4:0.0} с",s.AzimuthDegrees,s.AzimuthUnits,s.ElevationUnits,s.ElevationDegrees,s.Seconds,artillery?"mil":"тыс");
            } else {SolutionText.ForeColor=Color.FromArgb(255,172,121);SolutionText.Text=s.Message;}
            string method=s.Available?(s.LowerDistance==s.UpperDistance?"Табличная строка "+s.LowerDistance+" м":"Интерполяция "+s.LowerDistance+"–"+s.UpperDistance+" м"):"Без экстраполяции";
            string source=s.Available?s.Source:(t==null?"":t.source);if(artillery)source=source.Replace("references/m777-screenshots/","");
            tableSource.Text=t==null?"Нет таблицы":String.Format("Диапазон {0}–{1} м · {2}\nИсточник: {3}",t.rows.First().distance,t.rows.Last().distance,method,source);
        }
        private void RefreshSites() {
            List<Site> visible=new List<Site>();
            foreach(Site s in originals.Concat(State.Bookmarks))visible.Add(new Site{id=s.id,name=State.Names.ContainsKey(s.id)?State.Names[s.id]:s.name,x=s.x,z=s.z,source=s.source});
            sites.DataSource=null;sites.DataSource=visible;Map.Sites=visible;Map.Invalidate();
        }
        private void ChooseSite() { Site site=sites.SelectedItem as Site;if(site==null)return;SetPoint(Map.Mode=="position",new MapPoint(site.x,site.z));Map.FocusPoint(new MapPoint(site.x,site.z)); }
        private void RenameSite() { Site site=sites.SelectedItem as Site;if(site==null||String.IsNullOrWhiteSpace(siteName.Text))return;State.Names[site.id]=siteName.Text.Trim();dirty=true;RefreshSites();Sync(); }
        private void Bookmark() {
            MapPoint p=Map.Mode=="position"?State.Position:State.Target;
            if(p==null){MessageBox.Show(this,"Сначала выберите точку. В режиме «Позиция» сохраняется A, в остальных режимах — B.","Закладка");return;}
            string name=String.IsNullOrWhiteSpace(siteName.Text)?"Точка "+Coordinates.Grid(p):siteName.Text.Trim();
            State.Bookmarks.Add(new Site{id="user:"+Guid.NewGuid().ToString("N"),name=name,x=p.X,z=p.Z,source="user"});dirty=true;RefreshSites();Sync();
        }
        public bool SaveState() { try {SaveFleet();dirty=false;Sync();status.Text="Все орудия, точки и настройки сохранены";return true;}catch(Exception ex){MessageBox.Show(this,"Не удалось сохранить: "+ex.Message,"Ошибка сохранения");return false;} }
        private void OnClosing(object sender,FormClosingEventArgs e) {
            if(!dirty)return;DialogResult answer=MessageBox.Show(this,"Сохранить все орудия, позиции и названия перед закрытием?","Бахмут",MessageBoxButtons.YesNoCancel,MessageBoxIcon.Question);
            if(answer==DialogResult.Cancel||(answer==DialogResult.Yes&&!SaveState()))e.Cancel=true;
        }
        public void MarkCleanForVerification() {dirty=false;}
    }
    public static class Program {
        [STAThread] public static void Main(string[] args) {
            string root=args.Length>0?args[0]:AppDomain.CurrentDomain.BaseDirectory;
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            try {Application.Run(new MainForm(root));}
            catch(Exception ex) {MessageBox.Show("Не удалось открыть карту: "+ex.Message,"Бахмут",MessageBoxButtons.OK,MessageBoxIcon.Error);}
        }
    }
}
