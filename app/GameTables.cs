using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace BakhmutMap {
    public class GameRow {
        public double distance { get; set; }
        public double elevation { get; set; }
        public double seconds { get; set; }
        public string source { get; set; }
    }
    public class GameTable {
        public string id { get; set; }
        public string shell { get; set; }
        public int rings { get; set; }
        public string source { get; set; }
        public List<GameRow> rows { get; set; }
        public string weapon { get; set; }
        public string trajectory { get; set; }
        public int unitsPerCircle { get; set; }
        public GameTable() {weapon="mortar82";trajectory="high";unitsPerCircle=6000;}
    }
    public class GameSolution {
        public bool Available { get; set; }
        public string Message { get; set; }
        public double Distance { get; set; }
        public double AzimuthDegrees { get; set; }
        public double Elevation { get; set; }
        public double Seconds { get; set; }
        public double LowerDistance { get; set; }
        public double UpperDistance { get; set; }
        public int UnitsPerCircle {get;set;}
        public string Source {get;set;}
        public GameSolution() {UnitsPerCircle=6000;}
        public int AzimuthUnits { get { return (int)Math.Round(AzimuthDegrees*UnitsPerCircle/360,MidpointRounding.AwayFromZero)%UnitsPerCircle; } }
        public double ElevationDegrees {get{return ElevationUnits*360.0/UnitsPerCircle;}}
        public int ElevationUnits { get { return (int)Math.Round(Elevation,MidpointRounding.AwayFromZero); } }
    }
    // Interpolates only the supplied game lookup tables. No physical ballistic model.
    public static class GameTables {
        private static bool Finite(double x) { return !Double.IsNaN(x)&&!Double.IsInfinity(x); }
        public static List<GameTable> Load(string path) {
            List<GameTable> tables=new JavaScriptSerializer().Deserialize<List<GameTable>>(File.ReadAllText(path));
            if(tables==null||tables.Count==0)throw new FormatException("No game tables");
            HashSet<string> ids=new HashSet<string>();
            foreach(GameTable table in tables) {
                if(table==null||String.IsNullOrWhiteSpace(table.id)||!ids.Add(table.id)||String.IsNullOrWhiteSpace(table.shell)||String.IsNullOrWhiteSpace(table.source)||table.rows==null||table.rows.Count<2)throw new FormatException("Invalid game table");
                if(table.weapon=="mortar82") {if(table.unitsPerCircle!=6000||table.rings<0||table.rings>4||table.trajectory!="high")throw new FormatException("Invalid mortar profile");}
                else if(table.weapon=="m777") {if(table.unitsPerCircle!=6400||table.rings<1||table.rings>5||(table.trajectory!="high"&&table.trajectory!="low"))throw new FormatException("Invalid M777 profile");}
                else throw new FormatException("Unknown weapon profile");
                double previous=-1;
                foreach(GameRow row in table.rows) {
                    if(row==null||!Finite(row.distance)||!Finite(row.elevation)||!Finite(row.seconds)||row.distance<=previous||row.distance<=0||row.elevation<=0||row.elevation>=table.unitsPerCircle/4||row.seconds<=0)throw new FormatException("Invalid game table row: "+table.id);
                    previous=row.distance;
                }
            }
            return tables;
        }
        public static GameSolution Calculate(GameTable table,MapPoint position,MapPoint target) {
            GameSolution result=new GameSolution();
            if(table!=null)result.UnitsPerCircle=table.unitsPerCircle;
            if(!Coordinates.Valid(position)||!Coordinates.Valid(target)) { result.Message="Выберите позицию и цель на карте.";return result; }
            result.Distance=Coordinates.Distance(position,target);
            if(result.Distance<0.001) { result.Message="Позиция и цель совпадают; азимут не определён.";return result; }
            result.AzimuthDegrees=(Math.Atan2(target.X-position.X,target.Z-position.Z)*180/Math.PI+360)%360;
            if(table==null) { result.Message="Выберите игровую таблицу.";return result; }
            GameRow first=table.rows.First(),last=table.rows.Last();
            if(result.Distance<first.distance-1e-7||result.Distance>last.distance+1e-7) {
                result.Message="Вне выбранной таблицы: "+first.distance+"–"+last.distance+" м. Измените заряд, траекторию или позицию.";return result;
            }
            GameRow lower=first,upper=last;
            double sampleDistance=Math.Max(first.distance,Math.Min(last.distance,result.Distance));
            foreach(GameRow row in table.rows) {
                if(row.distance<=sampleDistance)lower=row;
                if(row.distance>=sampleDistance) {upper=row;break;}
            }
            double ratio=upper.distance==lower.distance?0:(sampleDistance-lower.distance)/(upper.distance-lower.distance);
            result.Elevation=lower.elevation+(upper.elevation-lower.elevation)*ratio;
            result.Seconds=lower.seconds+(upper.seconds-lower.seconds)*ratio;
            result.LowerDistance=lower.distance;result.UpperDistance=upper.distance;
            result.Source=String.Join(" | ",new[]{lower.source??table.source,upper.source??table.source}.Distinct());
            result.Available=true;return result;
        }
    }
}
