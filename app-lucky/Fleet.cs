using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace BakhmutMap {
    public class GunSlot {
        public int Id {get;set;}
        public Session Data {get;set;}
    }
    public class FleetState {
        public int Version {get;set;}
        public int ActiveId {get;set;}
        public List<GunSlot> Guns {get;set;}
        public FleetState(){Version=1;ActiveId=1;Guns=new List<GunSlot>();}
        public void Validate(){
            if(Version!=1||Guns==null||Guns.Count<1||Guns.Count>6||Guns.Any(g=>g==null||g.Id<1||g.Id>6)||Guns.Select(g=>g.Id).Distinct().Count()!=Guns.Count||!Guns.Any(g=>g.Id==ActiveId))throw new FormatException("Некорректный список орудий.");
            foreach(GunSlot g in Guns)Coordinates.Validate(g.Data);
        }
        public static FleetState Load(string path){
            if(new FileInfo(path).Length>2000000)throw new FormatException("Сохранение слишком большое.");
            FleetState f=new JavaScriptSerializer().Deserialize<FleetState>(File.ReadAllText(path));
            if(f==null)throw new FormatException("Пустое сохранение.");f.Validate();return f;
        }
        public void Save(string path){
            Validate();Directory.CreateDirectory(Path.GetDirectoryName(path));
            string json=new JavaScriptSerializer().Serialize(this);
            if(System.Text.Encoding.UTF8.GetByteCount(json)>2000000)throw new FormatException("Слишком много данных для сохранения.");
            string temp=path+".tmp";File.WriteAllText(temp,json,System.Text.Encoding.UTF8);
            if(File.Exists(path))File.Replace(temp,path,path+".bak");else File.Move(temp,path);
        }
    }
}
