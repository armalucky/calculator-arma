using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace BakhmutMap {
    public sealed class WindowModeButton:LuckyButton {
        public bool Fullscreen;
        protected override void OnPaint(PaintEventArgs e){
            base.OnPaint(e);
            using(var pen=new Pen(Enabled?LuckyTheme.Text:LuckyTheme.Muted,1.6f)){
                int x=Width/2-8,y=Height/2-7;
                if(Fullscreen){e.Graphics.DrawRectangle(pen,x+4,y,12,10);using(var fill=new SolidBrush(BackColor))e.Graphics.FillRectangle(fill,x,y+4,12,10);e.Graphics.DrawRectangle(pen,x,y+4,12,10);}
                else {e.Graphics.DrawLines(pen,new[]{new Point(x,y+5),new Point(x,y),new Point(x+5,y)});e.Graphics.DrawLines(pen,new[]{new Point(x+11,y),new Point(x+16,y),new Point(x+16,y+5)});e.Graphics.DrawLines(pen,new[]{new Point(x,y+9),new Point(x,y+14),new Point(x+5,y+14)});e.Graphics.DrawLines(pen,new[]{new Point(x+11,y+14),new Point(x+16,y+14),new Point(x+16,y+9)});}
            }
        }
    }
    public partial class MainForm {
        public WindowModeButton FullscreenButton;
        public bool IsFullscreen {get;private set;}
        public string WindowModeSettingsPath;
        private Rectangle windowedBounds;
        private Size windowedMinimum;
        private FormWindowState windowedState;
        private void ApplySavedWindowMode(){
            WindowModeSettingsPath=WindowModeSettingsPath??Path.Combine(rootPath,"user-data","lucky-window-mode.txt");
            bool fullscreen=true;
            try{if(File.Exists(WindowModeSettingsPath))fullscreen=File.ReadAllText(WindowModeSettingsPath).Trim()!="windowed";}catch(IOException){}catch(UnauthorizedAccessException){}
            SetFullscreen(fullscreen,false);
        }
        private void RefreshWindowModeButton(){
            if(FullscreenButton==null)return;
            FullscreenButton.Fullscreen=IsFullscreen;
            string caption=LuckyLanguage.T(IsFullscreen?"Оконный режим · F11 / Esc":"На весь экран · F11");
            FullscreenButton.AccessibleName=caption;HelpTips.SetToolTip(FullscreenButton,caption);FullscreenButton.Invalidate();
        }
        public void SetFullscreen(bool fullscreen,bool persist){
            if(fullscreen!=IsFullscreen){
                SuspendLayout();
                try{
                    if(fullscreen){
                        Rectangle screen=Screen.FromControl(this).Bounds;
                        windowedState=WindowState;windowedBounds=WindowState==FormWindowState.Normal?Bounds:RestoreBounds;windowedMinimum=MinimumSize;
                        WindowState=FormWindowState.Normal;MinimumSize=Size.Empty;FormBorderStyle=FormBorderStyle.None;Bounds=screen;IsFullscreen=true;
                    }else{
                        WindowState=FormWindowState.Normal;FormBorderStyle=FormBorderStyle.Sizable;MinimumSize=windowedMinimum;
                        Rectangle area=Screen.FromRectangle(windowedBounds).WorkingArea;
                        Rectangle restored=windowedBounds;
                        if(!area.IntersectsWith(restored))restored.Location=area.Location;
                        Bounds=restored;WindowState=windowedState==FormWindowState.Minimized?FormWindowState.Normal:windowedState;IsFullscreen=false;
                    }
                }finally{ResumeLayout(true);}
            }
            RefreshWindowModeButton();
            if(persist){
                WindowModeSettingsPath=WindowModeSettingsPath??Path.Combine(rootPath,"user-data","lucky-window-mode.txt");
                try{Directory.CreateDirectory(Path.GetDirectoryName(WindowModeSettingsPath));File.WriteAllText(WindowModeSettingsPath,fullscreen?"fullscreen":"windowed");}
                catch(IOException ex){MessageBox.Show(this,LuckyLanguage.T("Не удалось сохранить режим окна: ")+ex.Message,"LuckyGames");}
                catch(UnauthorizedAccessException ex){MessageBox.Show(this,LuckyLanguage.T("Не удалось сохранить режим окна: ")+ex.Message,"LuckyGames");}
            }
        }
        protected override bool ProcessCmdKey(ref Message msg,Keys keyData){
            if(keyData==Keys.F11){SetFullscreen(!IsFullscreen,true);return true;}
            if(keyData==Keys.Escape&&IsFullscreen){
                foreach(var combo in new[]{LanguageChoice,WeaponChoice,ShellChoice,RingsChoice,TrajectoryChoice,PositionFormat,TargetFormat})if(combo!=null&&combo.DroppedDown)return base.ProcessCmdKey(ref msg,keyData);
                SetFullscreen(false,true);return true;
            }
            return base.ProcessCmdKey(ref msg,keyData);
        }
    }
}
