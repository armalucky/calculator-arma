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
    public static class LuckyTheme {
        public static readonly Color Background=Color.FromArgb(18,21,20),Panel=Color.FromArgb(27,31,29),Field=Color.FromArgb(42,48,43),Text=Color.FromArgb(241,242,234),Muted=Color.FromArgb(184,194,180),Gold=Color.FromArgb(218,196,145),Border=Color.FromArgb(66,77,65);
        public static GraphicsPath Rounded(RectangleF r,float radius){float d=Math.Min(radius*2,Math.Min(r.Width,r.Height));var p=new GraphicsPath();p.AddArc(r.X,r.Y,d,d,180,90);p.AddArc(r.Right-d,r.Y,d,d,270,90);p.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);p.AddArc(r.X,r.Bottom-d,d,d,90,90);p.CloseFigure();return p;}
        public static void Surface(Graphics g,Control c,Color fill,bool focus){
            g.Clear(c.Parent==null?Panel:c.Parent.BackColor);g.SmoothingMode=SmoothingMode.AntiAlias;
            using(var path=Rounded(new RectangleF(1,1,c.Width-2,c.Height-2),11))using(Brush b=new SolidBrush(fill)){g.FillPath(b,path);if(focus)using(Pen p=new Pen(Gold,1.5f))g.DrawPath(p,path);}
        }
        public static void Style(Control c){
            if(c is MapCanvas)return;
            c.ForeColor=Text;
            if(c is TextBox||c is ComboBox||c is NumericUpDown||c is ListBox)c.BackColor=Field;
            else if(c is Panel||c is TabPage||c is TabControl)c.BackColor=Panel;
            ComboBox combo=c as ComboBox;
            if(combo!=null){combo.FlatStyle=FlatStyle.Flat;combo.Font=new Font("Segoe UI",11);combo.ItemHeight=30;combo.DrawMode=DrawMode.OwnerDrawFixed;combo.DrawItem+=(s,e)=>{if(e.Index<0)return;bool selected=(e.State&DrawItemState.Selected)!=0;using(Brush b=new SolidBrush(selected?Gold:Field))e.Graphics.FillRectangle(b,e.Bounds);TextRenderer.DrawText(e.Graphics,combo.GetItemText(combo.Items[e.Index]),combo.Font,new Rectangle(e.Bounds.X+8,e.Bounds.Y,e.Bounds.Width-26,e.Bounds.Height),selected?Background:Text,TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);e.DrawFocusRectangle();};}
            if(combo!=null)combo.MinimumSize=new Size(0,combo.Height);
            TextBox input=c as TextBox;if(input!=null){input.BorderStyle=input.Parent is LuckyInput?BorderStyle.None:BorderStyle.FixedSingle;input.Font=new Font("Consolas",12);}
            Button btt=c as Button;if(btt!=null){btt.FlatStyle=FlatStyle.Flat;btt.FlatAppearance.BorderColor=Border;btt.FlatAppearance.MouseOverBackColor=Color.FromArgb(61,65,49);btt.FlatAppearance.MouseDownBackColor=Color.FromArgb(78,81,57);btt.BackColor=Field;btt.Cursor=Cursors.Hand;}
            foreach(Control child in c.Controls)Style(child);
        }
    }
    public class LuckyButton:Button {
        public bool Primary;
        private bool hover;
        public LuckyButton(){SetStyle(ControlStyles.OptimizedDoubleBuffer|ControlStyles.UserPaint,true);Height=38;Cursor=Cursors.Hand;FlatStyle=FlatStyle.Flat;}
        protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
        protected override void OnMouseLeave(EventArgs e){hover=false;Invalidate();base.OnMouseLeave(e);}
        protected override void OnPaint(PaintEventArgs e){
            Color fill=!Enabled?LuckyTheme.Panel:Primary?(hover?Color.FromArgb(231,207,148):LuckyTheme.Gold):(hover?Color.FromArgb(58,63,46):LuckyTheme.Field);
            LuckyTheme.Surface(e.Graphics,this,fill,Focused);
            TextRenderer.DrawText(e.Graphics,Text,Font,new Rectangle(6,0,Width-12,Height),!Enabled?LuckyTheme.Muted:Primary?LuckyTheme.Background:LuckyTheme.Text,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
            if(Focused)using(var path=LuckyTheme.Rounded(new RectangleF(4,4,Width-8,Height-8),8))using(Pen p=new Pen(Primary?LuckyTheme.Background:LuckyTheme.Gold,1))e.Graphics.DrawPath(p,path);
        }
    }
    public class LuckySegment:RadioButton {
        private bool hover;
        public LuckySegment(){SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);Cursor=Cursors.Hand;}
        protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
        protected override void OnMouseLeave(EventArgs e){hover=false;Invalidate();base.OnMouseLeave(e);}
        protected override void OnCheckedChanged(EventArgs e){base.OnCheckedChanged(e);Invalidate();}
        protected override void OnPaint(PaintEventArgs e){LuckyTheme.Surface(e.Graphics,this,Checked?LuckyTheme.Gold:hover?Color.FromArgb(57,65,56):LuckyTheme.Field,Focused);TextRenderer.DrawText(e.Graphics,Text,Font,ClientRectangle,Checked?LuckyTheme.Background:LuckyTheme.Text,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);}
    }
    public class LuckyComboBox:ComboBox {
        public LuckyComboBox(){SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);DropDownStyle=ComboBoxStyle.DropDownList;}
        public override Size GetPreferredSize(Size proposedSize){Size preferred=base.GetPreferredSize(proposedSize);return new Size(preferred.Width,Math.Max(Height,preferred.Height));}
        protected override void OnSelectedIndexChanged(EventArgs e){base.OnSelectedIndexChanged(e);Invalidate();}
        protected override void OnGotFocus(EventArgs e){base.OnGotFocus(e);Invalidate();}
        protected override void OnLostFocus(EventArgs e){base.OnLostFocus(e);Invalidate();}
        protected override void OnPaint(PaintEventArgs e){
            LuckyTheme.Surface(e.Graphics,this,LuckyTheme.Field,Focused);
            TextRenderer.DrawText(e.Graphics,SelectedItem==null?Text:GetItemText(SelectedItem),Font,new Rectangle(12,0,Width-42,Height),Enabled?LuckyTheme.Text:LuckyTheme.Muted,TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
            using(Pen p=new Pen(LuckyTheme.Muted,1.6f)){p.StartCap=p.EndCap=LineCap.Round;e.Graphics.DrawLines(p,new[]{new PointF(Width-25,Height/2f-2),new PointF(Width-20,Height/2f+3),new PointF(Width-15,Height/2f-2)});}
        }
    }
    public class LuckyInput:Panel {
        public readonly TextBox Input;
        public LuckyInput(TextBox input){Input=input;DoubleBuffered=true;Height=44;BackColor=LuckyTheme.Field;Controls.Add(input);input.BorderStyle=BorderStyle.None;input.FontChanged+=(s,e)=>PerformLayout();input.GotFocus+=(s,e)=>Invalidate();input.LostFocus+=(s,e)=>Invalidate();Click+=(s,e)=>input.Focus();}
        protected override void OnLayout(LayoutEventArgs e){base.OnLayout(e);if(Input!=null)Input.SetBounds(12,Math.Max(4,(Height-Input.PreferredHeight)/2),Math.Max(1,Width-24),Input.PreferredHeight);}
        protected override void OnPaint(PaintEventArgs e){LuckyTheme.Surface(e.Graphics,this,LuckyTheme.Field,Input.ContainsFocus);}
    }
    public class LuckyHeader:Control {
        private Image cover;
        public LuckyHeader(string path){DoubleBuffered=true;SetStyle(ControlStyles.ResizeRedraw,true);BackColor=LuckyTheme.Background;Dock=DockStyle.Fill;if(File.Exists(path))cover=Image.FromFile(path);}
        protected override void OnPaint(PaintEventArgs e){
            e.Graphics.Clear(BackColor);
            if(cover!=null){using(var path=LuckyTheme.Rounded(new RectangleF(0,0,280,Height-4),12))e.Graphics.SetClip(path);e.Graphics.DrawImage(cover,new Rectangle(0,-38,280,140));e.Graphics.ResetClip();}
            using(Font title=new Font("Segoe UI",17,FontStyle.Bold))using(Font body=new Font("Segoe UI",10)){
                TextRenderer.DrawText(e.Graphics,"Бахмут",title,new Point(300,3),LuckyTheme.Text);
                TextRenderer.DrawText(e.Graphics,"Карта и расчёт · Arma Reforger",body,new Point(302,35),LuckyTheme.Muted);
                TextRenderer.DrawText(e.Graphics,"10,24 × 10,24 км",body,new Rectangle(Width-230,8,210,24),LuckyTheme.Gold,TextFormatFlags.Right);
                TextRenderer.DrawText(e.Graphics,"До 6 орудий",body,new Rectangle(Width-230,32,210,24),LuckyTheme.Muted,TextFormatFlags.Right);
            }
        }
        protected override void Dispose(bool disposing){if(disposing&&cover!=null)cover.Dispose();base.Dispose(disposing);}
    }
    public class LuckyTabs:TabControl {
        public LuckyTabs(){SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);}
        protected override void OnPaint(PaintEventArgs e){
            e.Graphics.Clear(LuckyTheme.Panel);
            for(int i=0;i<TabPages.Count;i++){
                Rectangle r=GetTabRect(i);bool selected=i==SelectedIndex;
                r.Inflate(-3,-2);using(var path=LuckyTheme.Rounded(r,10))using(Brush b=new SolidBrush(selected?LuckyTheme.Gold:LuckyTheme.Field))e.Graphics.FillPath(b,path);
                TextRenderer.DrawText(e.Graphics,TabPages[i].Text,Font,r,selected?LuckyTheme.Background:LuckyTheme.Text,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);
                if(Focused&&selected)ControlPaint.DrawFocusRectangle(e.Graphics,Rectangle.Inflate(r,-3,-3));
            }
        }
    }
    public class LuckyReadout:Control {
        private GameSolution solution;
        private bool artillery;
        private int gun;
        public LuckyReadout(){DoubleBuffered=true;Dock=DockStyle.Fill;BackColor=LuckyTheme.Background;AccessibleName="Результат расчёта выбранного орудия";}
        public void SetSolution(GameSolution value,bool m777,int id){solution=value;artillery=m777;gun=id;AccessibleDescription=value!=null&&value.Available?String.Format("Орудие {0}. Азимут {1} mil. Возвышение {2} mil. Полёт {3:0.0} секунд",id,value.AzimuthUnits,value.ElevationUnits,value.Seconds):value==null?"Нет расчёта":value.Message;Invalidate();}
        protected override void OnPaint(PaintEventArgs e){
            e.Graphics.Clear(BackColor);
            using(Font caption=new Font("Segoe UI",9))using(Font number=new Font("Segoe UI",26,FontStyle.Regular))using(Font sub=new Font("Segoe UI",10)) {
                if(solution==null||!solution.Available){TextRenderer.DrawText(e.Graphics,solution==null?"Выберите позицию и цель":solution.Message,sub,new Rectangle(20,18,Width-40,Height-25),LuckyTheme.Gold,TextFormatFlags.WordBreak);return;}
                string unit=artillery?"mil":"тыс";
                string[] labels={"АЗИМУТ · A"+gun,"ВОЗВЫШЕНИЕ","ВРЕМЯ ПОЛЁТА"};
                string[] values={solution.AzimuthDegrees.ToString("0.0",CultureInfo.CurrentCulture)+"°",solution.ElevationDegrees.ToString("0.0",CultureInfo.CurrentCulture)+"°",solution.Seconds.ToString("0.0",CultureInfo.CurrentCulture)+" с"};
                string[] extra={solution.AzimuthUnits.ToString("0000")+" "+unit,solution.ElevationUnits.ToString("0000")+" "+unit,"приблизительно"};
                for(int i=0;i<3;i++){int x=i*Width/3+18;TextRenderer.DrawText(e.Graphics,labels[i],caption,new Point(x,4),LuckyTheme.Muted);TextRenderer.DrawText(e.Graphics,values[i],number,new Point(x,20),LuckyTheme.Gold);TextRenderer.DrawText(e.Graphics,extra[i],sub,new Point(x,64),LuckyTheme.Text);if(i>0)using(Pen pen=new Pen(LuckyTheme.Border))e.Graphics.DrawLine(pen,x-18,12,x-18,Height-12);}
            }
        }
    }
    public partial class MainForm {
        public FleetState Fleet;
        public Button AddGunButton,RemoveGunButton,ShareTargetButton;
        public FlowLayoutPanel GunTabs;
        public ToolTip HelpTips;
        private LuckyReadout readout;
        private Label activeHeading;
        private bool switchingGun;
        private bool saveBlocked;
        private Label fleetCount;
        private List<RadioButton> gunButtons=new List<RadioButton>();
        private string legacyStatePath;
        private void InitializeLucky(string root){
            string preferredLanguage=ReadLanguage(root);LuckyLanguage.Code="ru";
            rootPath=root;statePath=Path.Combine(root,"user-data","lucky-session.json");legacyStatePath=Path.Combine(root,"user-data","session.json");
            gameTables=GameTables.Load(Path.Combine(root,"data/game-tables.json"));gameTables.AddRange(GameTables.Load(Path.Combine(root,"data/m777-tables.json")));
            // In the supplied mod M116 inherits M107's ShellMoveComponent unchanged.
            gameTables.AddRange(gameTables.Where(t=>t.weapon=="m777"&&t.shell=="M107 HE").Select(t=>new GameTable{
                id=t.id+"-smoke",shell="M116 SMOKE",weapon=t.weapon,trajectory=t.trajectory,
                rings=t.rings,unitsPerCircle=t.unitsPerCircle,source=t.source,
                rows=t.rows.Select(r=>new GameRow{distance=r.distance,elevation=r.elevation,seconds=r.seconds,source=r.source}).ToList()
            }).ToList());
            roadIndex=RoadIndex.Load(Path.Combine(root,"data/maps/bakhmut/roads.json"));
            originals=new JavaScriptSerializer().Deserialize<List<Site>>(File.ReadAllText(Path.Combine(root,"data/maps/bakhmut/points.json")));
            Fleet=new FleetState();
            try{if(File.Exists(statePath))Fleet=FleetState.Load(statePath);else {Session imported=File.Exists(legacyStatePath)?Storage.Load(legacyStatePath):new Session();Fleet.Guns.Add(new GunSlot{Id=1,Data=imported});}}
            catch(Exception ex){saveBlocked=File.Exists(statePath);Fleet=new FleetState();Fleet.Guns.Add(new GunSlot{Id=1,Data=new Session()});MessageBox.Show("Не удалось загрузить сохранение: "+ex.Message+"\nИсходный файл сохранён. "+(saveBlocked?"Запись заблокирована до восстановления файла.":"Открыта пустая сессия."),"LuckyGames");}
            State=Fleet.Guns.First(g=>g.Id==Fleet.ActiveId).Data;
            if(State.NamingVersion<2)SiteNames.ApplyScenarioNames(State,originals);
            AutoScaleDimensions=new SizeF(96,96);AutoScaleMode=AutoScaleMode.Dpi;
            ClientSize=new Size(1440,960);MinimumSize=new Size(1180,820);StartPosition=FormStartPosition.CenterScreen;Font=new Font("Segoe UI",10);BackColor=LuckyTheme.Background;ForeColor=text;
            HelpTips=new ToolTip{InitialDelay=400,ReshowDelay=100,AutoPopDelay=16000,ShowAlways=true};
            var outer=new TableLayoutPanel{Dock=DockStyle.Fill,RowCount=4,ColumnCount=1,Margin=Padding.Empty,Padding=new Padding(8),BackColor=LuckyTheme.Background};
            outer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
            outer.RowStyles.Add(new RowStyle(SizeType.Absolute,64));outer.RowStyles.Add(new RowStyle(SizeType.Absolute,48));outer.RowStyles.Add(new RowStyle(SizeType.Percent,100));outer.RowStyles.Add(new RowStyle(SizeType.Absolute,24));Controls.Add(outer);
            var header=new LuckyHeader(Path.Combine(root,"references/mod-luckygames/scenario0_1024x512.jpg"));outer.Controls.Add(header,0,0);AddLanguagePicker(header);
            GunTabs=new FlowLayoutPanel{Dock=DockStyle.Fill,WrapContents=false,Margin=Padding.Empty,Padding=new Padding(8,6,0,4)};outer.Controls.Add(GunTabs,0,1);
            var body=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,Margin=Padding.Empty};body.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,354));body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));outer.Controls.Add(body,0,2);
            body.RowStyles.Add(new RowStyle(SizeType.Percent,100));
            var sideHost=new Panel{Dock=DockStyle.Fill,Margin=new Padding(0,0,8,0),BackColor=panel};body.Controls.Add(sideHost,0,0);
            var save=new LuckyButton{Text="Сохранить все орудия",Primary=true,Dock=DockStyle.Bottom,Height=44,Font=new Font("Segoe UI",11,FontStyle.Bold)};save.Click+=(s,e)=>SaveState();sideHost.Controls.Add(save);Tip(save,"Сохраняет все орудия, их координаты, цели, заряды, закладки и названия. Ctrl+S. Сохранение прежней версии не изменяется.");
            var sidebar=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(14,8,8,12)};sideHost.Controls.Add(sidebar);sidebar.BringToFront();
            activeHeading=SideLabel(sidebar,"Орудие 1",16,34,LuckyTheme.Text);
            SideLabel(sidebar,"Действие на карте",10,24,LuckyTheme.Muted);
            var modes=new FlowLayoutPanel{Width=310,Height=44,WrapContents=false,Margin=Padding.Empty};sidebar.Controls.Add(modes);
            Map=new MapCanvas(Path.Combine(root,"data/maps/bakhmut")){Dock=DockStyle.Fill,Font=new Font("Segoe UI",9),Margin=Padding.Empty};
            foreach(string mode in new[]{"move","position","target"}){
                string captured=mode;var button=new LuckySegment{Text=mode=="move"?"Обзор":mode=="position"?"Позиция A":"Цель B",Appearance=Appearance.Button,Width=99,Height=36,TextAlign=ContentAlignment.MiddleCenter,FlatStyle=FlatStyle.Flat,Margin=new Padding(0,0,4,0)};
                button.CheckedChanged+=(s,e)=>{button.BackColor=button.Checked?accent:LuckyTheme.Field;button.ForeColor=button.Checked?LuckyTheme.Background:text;if(button.Checked){Map.Mode=captured;Map.Cursor=captured=="move"?Cursors.Hand:Cursors.Cross;}};
                modes.Controls.Add(button);Tip(button,mode=="move"?"Перемещайте карту левой кнопкой. Колесо изменяет масштаб; правая кнопка перемещает карту в любом режиме.":mode=="position"?"Щелчок по карте задаёт позицию только выбранного орудия.":"Щелчок задаёт цель только выбранного орудия. Кнопка «Цель для всех» назначает её остальным.");if(mode=="move")button.Checked=true;
            }
            PointEditor(sidebar,true);PointEditor(sidebar,false);
            ShareTargetButton=SideButton(sidebar,"Назначить эту цель всем",AssignTargetToAll);Tip(ShareTargetButton,"Копирует цель B выбранного орудия всем добавленным орудиям. Их позиции, оружие и заряды остаются своими. Последующие изменения цели индивидуальны.");
            result=SideLabel(sidebar,"Выберите позицию и цель",12,50,accent);
            var view=new FlowLayoutPanel{Width=310,Height=44,WrapContents=false,Margin=Padding.Empty};sidebar.Controls.Add(view);
            Tip(AddButton(view,"Вся карта",101,()=>Map.Fit()),"Показать всю игровую карту.");Tip(AddButton(view,"К точкам",101,()=>Map.FramePair()),"Показать позицию и цель выбранного орудия вместе.");Tip(AddButton(view,"Сброс A/B",99,()=>{State.Position=null;State.Target=null;dirty=true;Sync();}),"Очистить позицию и цель только выбранного орудия.");
            var toggles=new FlowLayoutPanel{Width=310,Height=62,WrapContents=true,Margin=Padding.Empty};sidebar.Controls.Add(toggles);
            Check(toggles,"Дороги",v=>{Map.ShowRoads=v;Map.Invalidate();});Check(toggles,"Сетка",v=>{Map.ShowGrid=v;Map.Invalidate();});Check(toggles,"Названия",v=>{Map.ShowNames=v;Map.Invalidate();});
            foreach(Control c in toggles.Controls)Tip(c,"Показать или скрыть слой «"+c.Text+"». Координаты и расчёты не меняются.");
            Check(toggles,"Здания",v=>{Map.ShowBuildings=v;Map.Invalidate();});
            Tip(toggles.Controls[toggles.Controls.Count-1],"Контуры из файлов игровой карты. Появляются при приближении. Не все объекты мода имеют контур.");
            var savedPoints=new FlowLayoutPanel{Width=310,Height=250,FlowDirection=FlowDirection.TopDown,WrapContents=false,Visible=false,Margin=Padding.Empty};
            var disclosure=SideButton(sidebar,"Точки и закладки · раскрыть",()=>{savedPoints.Visible=!savedPoints.Visible;});Tip(disclosure,"Открыть точки сценария и свои закладки. Здесь можно выбрать точку, переименовать её или сохранить новую.");sidebar.Controls.Add(savedPoints);
            sites=new ListBox{Width=304,Height=126,IntegralHeight=false,BorderStyle=BorderStyle.FixedSingle};savedPoints.Controls.Add(sites);
            sites.SelectedIndexChanged+=(s,e)=>{Site chosen=sites.SelectedItem as Site;if(chosen!=null)siteName.Text=chosen.name;};sites.DoubleClick+=(s,e)=>ChooseSite();Tip(sites,"Двойной щелчок выбирает точку: позиция A в режиме «Позиция», иначе цель B.");
            siteName=new TextBox{Width=304,MaxLength=70};savedPoints.Controls.Add(siteName);Tip(siteName,"Название выбранной точки или новой закладки. Чтобы применить новое название, нажмите «Имя».");
            var siteButtons=new FlowLayoutPanel{Width=310,Height=44,WrapContents=false,Margin=Padding.Empty};savedPoints.Controls.Add(siteButtons);
            Tip(AddButton(siteButtons,"Выбрать",100,ChooseSite),"Назначить выбранную точку позицией A или целью B, в зависимости от режима карты.");Tip(AddButton(siteButtons,"Имя",76,RenameSite),"Переименовать выбранную точку для всех орудий.");Tip(AddButton(siteButtons,"Закладка",125,Bookmark),"Добавить закладку для A в режиме «Позиция», иначе для B. Название берётся из поля выше.");
            notice=SideLabel(sidebar,"Колесо — масштаб · ПКМ — сдвиг\nНаведение — подсказка к элементу",9,42,LuckyTheme.Muted);
            var mapArea=new TableLayoutPanel{Dock=DockStyle.Fill,RowCount=2,ColumnCount=1,Margin=Padding.Empty};mapArea.RowStyles.Add(new RowStyle(SizeType.Percent,100));mapArea.RowStyles.Add(new RowStyle(SizeType.Absolute,234));mapArea.Controls.Add(Map,0,0);body.Controls.Add(mapArea,1,0);
            mapArea.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
            AddCalculationPanel(mapArea);RebuildCalculation();
            CalculationTabs.SelectedIndexChanged+=(s,e)=>{mapArea.RowStyles[1].Height=(CalculationTabs.SelectedIndex==0?234:290)*CurrentAutoScaleDimensions.Height/96f;};
            var footer=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,Margin=Padding.Empty,BackColor=LuckyTheme.Background};
            footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));footer.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,90));outer.Controls.Add(footer,0,3);
            status=new Label{Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft,ForeColor=LuckyTheme.Muted,Text="Выберите орудие, задайте позицию A и цель B",Padding=new Padding(8,0,0,0)};footer.Controls.Add(status,0,0);
            // Preserve visible by Beld attribution and Steam URL; see root AGENTS.md and README.md.
            var credit=new LinkLabel{Name="AuthorCredit",Text="by Beld",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleRight,Margin=Padding.Empty,LinkColor=LuckyTheme.Gold,ActiveLinkColor=LuckyTheme.Text,VisitedLinkColor=LuckyTheme.Gold,AccessibleDescription="Steam: https://steamcommunity.com/id/Beldherder/"};
            credit.Links.Clear();credit.Links.Add(0,credit.Text.Length,"https://steamcommunity.com/id/Beldherder/");
            credit.LinkClicked+=(s,e)=>{try{System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo((string)e.Link.LinkData){UseShellExecute=true});}catch(Exception ex){MessageBox.Show(this,ex.Message,"Steam",MessageBoxButtons.OK,MessageBoxIcon.Information);}};
            footer.Controls.Add(credit,1,0);
            Map.PointPicked=p=>{bool position=Map.Mode=="position";(position?PositionFormat:TargetFormat).SelectedIndex=1;SetPoint(position,p);};
            Map.Hover=p=>status.Text=Coordinates.Valid(p)?String.Format(CultureInfo.InvariantCulture,"Клетка {0}  ·  X {1:0.0} м   Z {2:0.0} м   |   Орудие {3}",Coordinates.Grid(p),p.X,p.Z,Fleet.ActiveId):"Вне границ карты";
            LuckyTheme.Style(body);InstallCalculationTips();
            foreach(Control c in modes.Controls){var r=c as RadioButton;if(r!=null){r.BackColor=r.Checked?accent:LuckyTheme.Field;r.ForeColor=r.Checked?LuckyTheme.Background:text;}}
            foreach(Control c in new Control[]{PositionInput,TargetInput})c.Font=new Font("Consolas",14);
            save.Primary=true;
            Shown+=(s,e)=>{ApplySavedWindowMode();Map.Fit();};FormClosing+=OnClosing;KeyPreview=true;KeyDown+=(s,e)=>{if(e.Control&&e.KeyCode==Keys.S){SaveState();e.SuppressKeyPress=true;}};
            FormClosed+=(s,e)=>HelpTips.Dispose();
            RefreshGunTabs();RefreshSites();Sync();
            CaptureLanguageControls(this);SetLanguage(preferredLanguage,false);
        }
        private Label SideLabel(Control parent,string caption,float size,int height,Color color){var l=new Label{Text=caption,Width=308,Height=height,Font=new Font("Segoe UI",size),ForeColor=color,Margin=new Padding(0,6,0,2)};parent.Controls.Add(l);return l;}
        private Button SideButton(Control parent,string caption,Action action){var b=AddButton(parent,caption,304,action);b.Margin=new Padding(0,4,0,8);return b;}
        private void Tip(Control c,string message){tipSources[c]=message;c.Disposed+=(s,e)=>tipSources.Remove(c);HelpTips.SetToolTip(c,LuckyLanguage.T(message));c.AccessibleDescription=message;if(String.IsNullOrWhiteSpace(c.AccessibleName))c.AccessibleName=c.Text;c.KeyDown+=(s,e)=>{if(e.KeyCode==Keys.F1){HelpTips.Show(LuckyLanguage.T(message),c,0,c.Height,12000);e.Handled=true;}};}
        private void PointEditor(Control parent,bool position){
            var group=new TableLayoutPanel{Width=310,Height=136,ColumnCount=1,RowCount=3,Margin=new Padding(0,0,0,8)};
            group.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));group.RowStyles.Add(new RowStyle(SizeType.Absolute,32));group.RowStyles.Add(new RowStyle(SizeType.Absolute,48));group.RowStyles.Add(new RowStyle(SizeType.Absolute,48));parent.Controls.Add(group);
            SideLabel(group,position?"Позиция орудия · A":"Цель · B",10,24,position?LuckyTheme.Gold:Color.FromArgb(228,180,141));
            var format=new LuckyComboBox{Width=304,DropDownStyle=ComboBoxStyle.DropDownList,Margin=new Padding(0,0,0,8)};format.Items.AddRange(new object[]{"Клетка · 051 094","Точные X Z · метры"});format.SelectedIndex=1;group.Controls.Add(format);
            var row=new TableLayoutPanel{Width=304,Height=48,ColumnCount=2,RowCount=1,Margin=Padding.Empty};row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,96));row.RowStyles.Add(new RowStyle(SizeType.Percent,100));group.Controls.Add(row);
            var input=new TextBox{MaxLength=50,AccessibleName=position?"Координаты позиции A":"Координаты цели B"};
            var inputHost=new LuckyInput(input){Dock=DockStyle.Fill,Margin=new Padding(0,0,8,0)};row.Controls.Add(inputHost,0,0);
            Action apply=()=>{try{SetPoint(position,Coordinates.Parse(input.Text,format.SelectedIndex==0));Map.FramePair();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Координаты",MessageBoxButtons.OK,MessageBoxIcon.Information);}};
            var button=AddButton(row,"Задать",94,apply);button.Dock=DockStyle.Fill;button.Margin=Padding.Empty;row.SetCellPosition(button,new TableLayoutPanelCellPosition(1,0));Tip(button,"Применить координаты из поля слева к выбранному орудию. Также можно нажать Enter в поле.");
            input.KeyDown+=(s,e)=>{if(e.KeyCode==Keys.Enter){apply();e.SuppressKeyPress=true;}};
            Tip(format,"Клетка 051 094 выбирает её центр. Точные X Z — игровые метры, например 6285 2192. Север соответствует увеличению Z.");Tip(input,"Введите X и Z через пробел, затем нажмите «Задать» или Enter. До применения расчёт использует прежнюю точку. Точную точку можно выбрать на карте.");
            if(position){PositionInput=input;PositionFormat=format;}else{TargetInput=input;TargetFormat=format;}format.SelectedIndexChanged+=(s,e)=>SyncInputs();
        }
        private void RebuildCalculation(){
            CalculationTabs.DrawMode=TabDrawMode.OwnerDrawFixed;CalculationTabs.SizeMode=TabSizeMode.Fixed;CalculationTabs.ItemSize=new Size(185,32);CalculationTabs.Padding=new Point(10,4);
            CalculationTabs.DrawItem+=(s,e)=>{Rectangle r=CalculationTabs.GetTabRect(e.Index);bool selected=e.Index==CalculationTabs.SelectedIndex;using(Brush b=new SolidBrush(selected?LuckyTheme.Gold:LuckyTheme.Field))e.Graphics.FillRectangle(b,r);TextRenderer.DrawText(e.Graphics,CalculationTabs.TabPages[e.Index].Text,Font,r,selected?LuckyTheme.Background:text,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);if((e.State&DrawItemState.Focus)!=0)ControlPaint.DrawFocusRectangle(e.Graphics,r);};
            TabPage page=CalculationTabs.TabPages[0];Control old=page.Controls[0];
            var grid=new TableLayoutPanel{Dock=DockStyle.Fill,RowCount=3,ColumnCount=1,Padding=new Padding(12,2,12,2),Margin=Padding.Empty};grid.RowStyles.Add(new RowStyle(SizeType.Absolute,60));grid.RowStyles.Add(new RowStyle(SizeType.Absolute,84));grid.RowStyles.Add(new RowStyle(SizeType.Percent,100));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
            var choices=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=4,RowCount=2,Margin=Padding.Empty};choices.RowStyles.Add(new RowStyle(SizeType.Absolute,23));choices.RowStyles.Add(new RowStyle(SizeType.Percent,100));foreach(float pct in new[]{29f,24f,18f,29f})choices.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,pct));
            string[] labels={"ОРУДИЕ","СНАРЯД","ЗАРЯД / КОЛЬЦА","ТРАЕКТОРИЯ"};Control[] inputs={WeaponChoice,ShellChoice,RingsChoice,TrajectoryChoice};
            WeaponChoice.Items[0]="Миномёт · 82 мм";WeaponChoice.Items[1]="M777";
            for(int i=0;i<4;i++){choices.Controls.Add(new Label{Text=labels[i],Dock=DockStyle.Fill,ForeColor=LuckyTheme.Muted,Font=new Font("Segoe UI",9),Margin=Padding.Empty},i,0);inputs[i].Dock=DockStyle.Top;inputs[i].Margin=new Padding(0,1,10,0);choices.Controls.Add(inputs[i],i,1);}
            grid.Controls.Add(choices,0,0);readout=new LuckyReadout{Margin=Padding.Empty};grid.Controls.Add(readout,0,1);
            calculationNotice.Dock=DockStyle.Fill;calculationNotice.Margin=Padding.Empty;calculationNotice.AutoSize=false;calculationNotice.Font=new Font("Segoe UI",9);calculationNotice.ForeColor=LuckyTheme.Muted;grid.Controls.Add(calculationNotice,0,2);
            SolutionText.Parent=page;SolutionText.Visible=false;tableSource.Parent=page;tableSource.Visible=false;chargeLabel.Parent=page;chargeLabel.Visible=false;
            page.Controls.Remove(old);old.Dispose();page.Controls.Add(grid);grid.BringToFront();
            readout.MouseEnter+=(s,e)=>HelpTips.SetToolTip(readout,tableSource.Text+"\n"+calculationNotice.Text);Tip(readout,"Расчёт для выбранного орудия. Наведите снова, чтобы увидеть источник и диапазон таблицы. Ветер и высоты не учтены.");
            var planBox=CalculationTabs.TabPages[1].Controls[0] as FlowLayoutPanel;
            if(planBox!=null){foreach(Control c in planBox.Controls){c.Width=760;if(c is FlowLayoutPanel)c.Height=Math.Max(c.Height,44);}}
        }
        private void InstallCalculationTips(){
            Tip(WeaponChoice,"Выберите оружие именно этого орудия. Для M777 используется 6400 mil на круг; для миномёта — 6000 тысячных.");Tip(ShellChoice,"Тип снаряда должен совпадать с загруженным в игре. Расчёт берётся из предоставленных игровых таблиц.");
            Tip(RingsChoice,"Для M777: 1L → 1, 2L → 2, 3H → 3, 4H → 4, 5H → 5. Для миномёта — число колец. Выбор должен совпадать с зарядом в игре.");
            Tip(TrajectoryChoice,"Высокая — навесная траектория; низкая — более пологая. У каждого заряда свой диапазон. Препятствия по пути не проверяются.");
            Tip(ShowCandidates,"Показать области, проходящие фильтры для выбранного орудия и его цели. Это не проверка зданий, воды или возможности установки.");Tip(ReserveInput,"Запас горизонтальной дальности за целью, в метрах. Уменьшает максимальную допустимую дистанцию.");Tip(RoadOffsetInput,"Минимальное расстояние от края дороги. Скрытие дорог на карте не отключает этот фильтр.");Tip(SiteOffsetInput,"Минимальное расстояние от всех точек сценария, независимо от их владельца. Закладки не создают зон исключения.");
        }
        private void RefreshGunTabs(){
            foreach(Control c in GunTabs.Controls.Cast<Control>().ToArray()){GunTabs.Controls.Remove(c);c.Dispose();}gunButtons.Clear();
            foreach(GunSlot slot in Fleet.Guns){int id=slot.Id;var button=new LuckySegment{Text="Орудие "+id,Appearance=Appearance.Button,TextAlign=ContentAlignment.MiddleCenter,Width=112,Height=38,FlatStyle=FlatStyle.Flat,Checked=id==Fleet.ActiveId,BackColor=id==Fleet.ActiveId?accent:LuckyTheme.Field,ForeColor=id==Fleet.ActiveId?LuckyTheme.Background:text,Margin=new Padding(0,0,6,0)};button.CheckedChanged+=(s,e)=>{if(button.Checked&&Fleet.ActiveId!=id)SelectGun(id);};GunTabs.Controls.Add(button);gunButtons.Add(button);Tip(button,"Переключить на орудие "+id+". Его позиция, цель, оружие, заряд и траектория хранятся отдельно.");}
            AddGunButton=AddButton(GunTabs,"+",40,()=>AddGun());AddGunButton.Enabled=Fleet.Guns.Count<6;AddGunButton.AccessibleName="Добавить орудие";Tip(AddGunButton,"Добавить орудие, максимум шесть. Позиция будет пустой; цель и настройки копируются из выбранного орудия.");
            RemoveGunButton=AddButton(GunTabs,"Убрать",88,()=>{if(MessageBox.Show(this,"Убрать орудие "+Fleet.ActiveId+" из списка? Его координаты и настройки будут удалены из текущей сессии.","Список орудий",MessageBoxButtons.YesNo,MessageBoxIcon.Question)==DialogResult.Yes)RemoveActiveGun();});RemoveGunButton.Enabled=Fleet.Guns.Count>1;Tip(RemoveGunButton,"Убрать выбранное орудие. Последнее орудие удалить нельзя.");
            fleetCount=new Label{Text=Fleet.Guns.Count+" / 6",AutoSize=true,ForeColor=LuckyTheme.Muted,Margin=new Padding(12,10,0,0)};GunTabs.Controls.Add(fleetCount);
        }
        public bool AddGun(){
            if(Fleet.Guns.Count>=6)return false;
            int id=Enumerable.Range(1,6).First(n=>!Fleet.Guns.Any(g=>g.Id==n));
            Session next=new Session{Target=CopyPoint(State.Target),WeaponId=State.WeaponId,TableId=State.TableId,M777TableId=State.M777TableId,Names=State.Names,Bookmarks=State.Bookmarks,NamingVersion=State.NamingVersion,Planning=new PlanningOptions{Show=false,Reserve=State.Planning.Reserve,RoadOffset=State.Planning.RoadOffset,SiteOffset=State.Planning.SiteOffset}};
            Fleet.Guns.Add(new GunSlot{Id=id,Data=next});SelectGun(id);dirty=true;Sync();return true;
        }
        private static MapPoint CopyPoint(MapPoint p){return p==null?null:new MapPoint(p.X,p.Z);}
        public void SelectGun(int id){
            GunSlot slot=Fleet.Guns.FirstOrDefault(g=>g.Id==id);if(slot==null)throw new ArgumentException("Unknown gun");
            slot.Data.Names=State.Names;slot.Data.Bookmarks=State.Bookmarks;slot.Data.NamingVersion=State.NamingVersion;
            switchingGun=true;
            try{State=slot.Data;Fleet.ActiveId=id;WeaponChoice.SelectedIndex=State.WeaponId=="m777"?1:0;FillWeaponChoices();ShowCandidates.Checked=State.Planning.Show;ReserveInput.Value=(decimal)State.Planning.Reserve;RoadOffsetInput.Value=(decimal)State.Planning.RoadOffset;SiteOffsetInput.Value=(decimal)State.Planning.SiteOffset;PositionFormat.SelectedIndex=1;TargetFormat.SelectedIndex=1;}
            finally{switchingGun=false;}
            maskKey=null;dirty=true;RefreshGunTabs();RefreshSites();Sync();
        }
        public bool RemoveActiveGun(){if(Fleet.Guns.Count<=1)return false;Fleet.Guns.RemoveAll(g=>g.Id==Fleet.ActiveId);SelectGun(Fleet.Guns[0].Id);return true;}
        public void AssignTargetToAll(){if(State.Target==null)return;foreach(GunSlot slot in Fleet.Guns)slot.Data.Target=CopyPoint(State.Target);dirty=true;Sync();status.Text="Цель назначена всем орудиям; позиции и заряды не изменены";}
        private void RefreshGunMarkers(){if(Fleet==null)return;Map.GunMarkers=Fleet.Guns.Where(g=>g.Id!=Fleet.ActiveId&&g.Data.Position!=null).Select(g=>new Site{id="gun:"+g.Id,name="A"+g.Id,x=g.Data.Position.X,z=g.Data.Position.Z}).ToList();Map.PositionCaption="A"+Fleet.ActiveId+" · Позиция";activeHeading.Text="Орудие "+Fleet.ActiveId;ShareTargetButton.Enabled=State.Target!=null&&Fleet.Guns.Count>1;}
        private void SaveFleet(){if(saveBlocked)throw new InvalidOperationException("Исходное сохранение повреждено. Чтобы не затереть его, запись отключена до восстановления lucky-session.json.");foreach(GunSlot slot in Fleet.Guns){slot.Data.Names=State.Names;slot.Data.Bookmarks=State.Bookmarks;slot.Data.NamingVersion=State.NamingVersion;}Fleet.Save(statePath);}
    }
}
