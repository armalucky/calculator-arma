using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Globalization;
using System.Windows.Forms;

namespace BakhmutMap {
    public static partial class LuckyLanguage {
        public static string Code="ru";
        public static string T(string source){string value;return source!=null&&Code=="en"&&Words.TryGetValue(source,out value)?value:source;}
    }
    public partial class MainForm {
        public ComboBox LanguageChoice;
        public string LanguageSettingsPath;
        private bool changingLanguage;
        private readonly Dictionary<Control,string> captions=new Dictionary<Control,string>();
        private readonly Dictionary<Control,string> tipSources=new Dictionary<Control,string>();
        private readonly Dictionary<Control,string> accessibleNames=new Dictionary<Control,string>();
        private string ReadLanguage(string root){
            LanguageSettingsPath=Path.Combine(root,"user-data","lucky-language.txt");
            try{return File.Exists(LanguageSettingsPath)&&File.ReadAllText(LanguageSettingsPath).Trim()=="en"?"en":"ru";}catch(IOException){return "ru";}
        }
        private void AddLanguagePicker(Control header){
            LanguageChoice=new LuckyComboBox{Width=144,Height=38,DropDownStyle=ComboBoxStyle.DropDownList,Anchor=AnchorStyles.Top|AnchorStyles.Right,AccessibleName="Language / Язык"};
            LanguageChoice.Items.AddRange(new object[]{"Русский","English"});LanguageChoice.SelectedIndex=0;
            var strip=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=3,RowCount=1,Margin=Padding.Empty};
            strip.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));strip.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,164));strip.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,48));
            var parent=(TableLayoutPanel)header.Parent;var cell=parent.GetPositionFromControl(header);parent.Controls.Remove(header);parent.Controls.Add(strip,cell.Column,cell.Row);strip.Controls.Add(header,0,0);
            var box=new Panel{Dock=DockStyle.Fill,Padding=new Padding(12,10,0,0),Margin=Padding.Empty};strip.Controls.Add(box,1,0);box.Controls.Add(LanguageChoice);LanguageChoice.Location=new Point(12,10);
            LuckyTheme.Style(LanguageChoice);
            FullscreenButton=new WindowModeButton{Width=42,Height=38,Margin=new Padding(0,10,0,0)};strip.Controls.Add(FullscreenButton,2,0);
            FullscreenButton.Click+=(s,e)=>SetFullscreen(!IsFullscreen,true);RefreshWindowModeButton();
            LanguageChoice.SelectedIndexChanged+=(s,e)=>{if(!changingLanguage)SetLanguage(LanguageChoice.SelectedIndex==1?"en":"ru",true);};
        }
        private void CaptureLanguageControls(Control c){
            // User-entered names and coordinates, list data and numeric input are never translated.
            if(!(c is TextBoxBase)&&!(c is ComboBox)&&!(c is ListBox)&&!(c is NumericUpDown))captions[c]=c.Text;
            if(!String.IsNullOrEmpty(c.AccessibleName))accessibleNames[c]=c.AccessibleName;
            var combo=c as ComboBox;
            if(combo!=null&&combo!=LanguageChoice){combo.FormattingEnabled=true;combo.Format+=(s,e)=>e.Value=LuckyLanguage.T(Convert.ToString(e.Value));}
            if(c is TextBoxBase||c is NumericUpDown||c is ComboBox)return;
            foreach(Control child in c.Controls)CaptureLanguageControls(child);
        }
        public void SetLanguage(string code,bool persist){
            if(code!="ru"&&code!="en")throw new ArgumentException("Unknown language");
            changingLanguage=true;
            string positionText=PositionInput.Text,targetText=TargetInput.Text,nameText=siteName.Text;
            try{
                LuckyLanguage.Code=code;
                CultureInfo.CurrentCulture=CultureInfo.GetCultureInfo(code=="en"?"en-US":"ru-RU");
                foreach(var item in captions.Where(p=>!p.Key.IsDisposed))item.Key.Text=LuckyLanguage.T(item.Value);
                foreach(var item in accessibleNames.Where(p=>!p.Key.IsDisposed))item.Key.AccessibleName=LuckyLanguage.T(item.Value);
                foreach(var item in tipSources.Where(p=>!p.Key.IsDisposed)){HelpTips.SetToolTip(item.Key,LuckyLanguage.T(item.Value));item.Key.AccessibleDescription=LuckyLanguage.T(item.Value);}
                LanguageChoice.SelectedIndex=code=="en"?1:0;
                RefreshGunTabs();Sync();RefreshWindowModeButton();PositionInput.Text=positionText;TargetInput.Text=targetText;siteName.Text=nameText;Invalidate(true);
                if(persist){
                    try{Directory.CreateDirectory(Path.GetDirectoryName(LanguageSettingsPath));File.WriteAllText(LanguageSettingsPath,code);}
                    catch(IOException ex){MessageBox.Show(this,LuckyLanguage.T("Не удалось сохранить язык: ")+ex.Message,"LuckyGames");}
                    catch(UnauthorizedAccessException ex){MessageBox.Show(this,LuckyLanguage.T("Не удалось сохранить язык: ")+ex.Message,"LuckyGames");}
                }
            }finally{changingLanguage=false;}
        }
    }
}
