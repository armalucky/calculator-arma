using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using BakhmutMap;

namespace LuckyMapReference {
    public static class Exporter {
        static string Hash(byte[] bytes) { using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(bytes)).Replace("-","").ToLowerInvariant(); }
        static MapPoint P(double x,double z) {return new MapPoint(x,z);}
        static RoadIndex RectangleRoads() {return new RoadIndex(new[]{new RoadShape(new[]{new[]{1000.0,1000.0},new[]{1100.0,1000.0},new[]{1100.0,1020.0},new[]{1000.0,1020.0}})});}
        static object Case(GameTable table,MapPoint a,MapPoint b,string label) {
            return new {Label=label,TableId=table==null?null:table.id,Position=a,Target=b,Expected=GameTables.Calculate(table,a,b)};
        }
        static object Mask(GameTable table,MapPoint target,PlanningOptions options,RoadIndex roads,List<Site> sites,string set) {
            using(var mask=PositionPlanner.CreateMask(table,target,options,roads,sites)) {
                var bytes=new byte[512*512];var row=new int[512];
                var data=mask.Image.LockBits(new Rectangle(0,0,512,512),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
                try {for(int y=0;y<512;y++){Marshal.Copy(IntPtr.Add(data.Scan0,y*data.Stride),row,0,512);for(int x=0;x<512;x++)bytes[y*512+x]=(byte)(((uint)row[x]>>24)==0?0:1);}}
                finally{mask.Image.UnlockBits(data);}
                return new {TableId=table.id,Target=target,Options=options,RoadSet=set,Sites=sites,ExpectedCells=mask.Cells,ExpectedSha256=Hash(bytes)};
            }
        }
        public static void Run(string root,string output) {
            var serializer=new JavaScriptSerializer{MaxJsonLength=20000000};
            var tables=GameTables.Load(Path.Combine(root,"data/game-tables.json"));
            tables.AddRange(GameTables.Load(Path.Combine(root,"data/m777-tables.json")));
            // Same game-only M116 derivation used by LuckyUI; calculation stays in original GameTables.
            tables.AddRange(tables.Where(t=>t.weapon=="m777"&&t.shell=="M107 HE").Select(t=>new GameTable{
                id=t.id+"-smoke",shell="M116 SMOKE",weapon=t.weapon,trajectory=t.trajectory,rings=t.rings,unitsPerCircle=t.unitsPerCircle,source=t.source,
                rows=t.rows.Select(r=>new GameRow{distance=r.distance,elevation=r.elevation,seconds=r.seconds,source=r.source}).ToList()
            }).ToList());
            var hashes=new Dictionary<string,string>();
            foreach(var path in new[]{"app/MapApp.cs","app/GameTables.cs","app/PositionPlanner.cs","app-lucky/LuckyUI.cs","data/game-tables.json","data/m777-tables.json","data/maps/bakhmut/roads.json","data/maps/bakhmut/points.json"})hashes[path]=Hash(File.ReadAllBytes(Path.Combine(root,path)));
            var calculations=new List<object>();
            foreach(var table in tables) {
                var samples=table.rows.Select(r=>r.distance).ToList();
                for(int i=1;i<table.rows.Count;i++)samples.Add((table.rows[i-1].distance+table.rows[i].distance)/2);
                double first=table.rows.First().distance,last=table.rows.Last().distance;
                samples.AddRange(new[]{first-0.01,first-5e-8,first+5e-8,last-5e-8,last+5e-8,last+0.01});
                foreach(double d in samples)calculations.Add(Case(table,P(0,0),d<=10240?P(d,0):P(d/Math.Sqrt(2),d/Math.Sqrt(2)),"table sample"));
                foreach(var b in new[]{P(5120,6020),P(6020,5120),P(5120,4220),P(4220,5120),P(5119.9,6020),P(6020,6020),P(4220,4220)})calculations.Add(Case(table,P(5120,5120),b,"direction"));
                calculations.Add(Case(table,null,P(1000,1000),"missing A"));
                calculations.Add(Case(table,P(1000,1000),null,"missing B"));
                calculations.Add(Case(table,P(-1,0),P(1000,1000),"invalid A"));
                calculations.Add(Case(table,P(1000,1000),P(1000,1000),"coincident"));
                calculations.Add(Case(table,P(1000,1000),P(1000.0005,1000),"almost coincident"));
            }
            calculations.Add(Case(null,P(0,0),P(900,0),"missing table"));
            var coordinates=new List<object>();
            var texts=new[]{"000 000","102 102","000 102","056 039","6285.25 2192,5","  10 ; 20  ","1e2\t+2E2","0 10240","-1 0","10241 0","1.5 2","103 2","NaN 1","Infinity 1","1e999 1","0x10 20","1 2 3","","1\n2",".5 2.","1,2,3 4"};
            foreach(var input in texts)foreach(bool asGrid in new[]{false,true}) {
                try{var p=Coordinates.Parse(input,asGrid);coordinates.Add(new{Text=input,Grid=asGrid,Expected=p,GridText=Coordinates.Grid(p),Error=(string)null});}
                catch(Exception e){coordinates.Add(new{Text=input,Grid=asGrid,Expected=(MapPoint)null,GridText=(string)null,Error=e.Message});}
            }
            var originals=serializer.Deserialize<List<Site>>(File.ReadAllText(Path.Combine(root,"data/maps/bakhmut/points.json")));
            var realRoads=RoadIndex.Load(Path.Combine(root,"data/maps/bakhmut/roads.json"));
            var rectangle=RectangleRoads();
            var roadCases=new List<object>();
            var random=new Random(20260909);
            for(int i=0;i<160;i++){var p=P(random.NextDouble()*10240,random.NextDouble()*10240);roadCases.Add(new{RoadSet="real",Position=p,Expected=realRoads.Distance(p)});}
            foreach(var p in new[]{P(1050,1010),P(1050,1050),P(1130,1060),P(1100,1010),P(1000,1000),P(0,0)})roadCases.Add(new{RoadSet="rectangle",Position=p,Expected=rectangle.Distance(p)});
            var assessments=new List<object>();
            foreach(var table in tables)for(int i=0;i<12;i++) {
                var p=P(random.NextDouble()*10240,random.NextDouble()*10240);var target=P(5637.116,3925.659);
                var options=new PlanningOptions{Reserve=i%3*200,RoadOffset=i%4*50,SiteOffset=i%5*100,Show=i%2==0};
                assessments.Add(new{TableId=table.id,Position=p,Target=target,Options=options,RoadSet="real",Sites=originals,Expected=PositionPlanner.Assess(table,target,p,options,realRoads,originals)});
            }
            var he=tables.First(t=>t.id=="he4");
            var testSites=new List<Site>{new Site{id="test",name="test",x=5000,z=4000}};
            foreach(var p in new[]{P(6100,4000),P(6100.1,4000),P(4399,4000),P(4400,4000),P(5300,4000),P(5299,4000),P(5000,4000),P(1050,1010)})foreach(bool zero in new[]{false,true}) {
                var options=zero?new PlanningOptions{Reserve=0,RoadOffset=0,SiteOffset=0}:new PlanningOptions();
                assessments.Add(new{TableId=he.id,Position=p,Target=P(4000,4000),Options=options,RoadSet="rectangle",Sites=testSites,Expected=PositionPlanner.Assess(he,P(4000,4000),p,options,rectangle,testSites)});
            }
            var masks=new List<object>();
            foreach(var id in new[]{"he4","smoke2","m777-2-low","m777-5-high-smoke"})masks.Add(Mask(tables.First(t=>t.id==id),P(5637.116,3925.659),new PlanningOptions(),realRoads,originals,"real"));
            masks.Add(Mask(he,P(0,10240),new PlanningOptions(),realRoads,originals,"real"));
            masks.Add(Mask(he,P(4000,4000),new PlanningOptions{Reserve=3000},rectangle,testSites,"rectangle"));
            masks.Add(Mask(he,P(4000,4000),new PlanningOptions(),rectangle,testSites,"rectangle"));
            masks.Add(Mask(he,P(1100,1000),new PlanningOptions{Reserve=0,RoadOffset=0,SiteOffset=0},rectangle,new List<Site>(),"rectangle"));
            var rounds=new[]{-2.5,-1.5,-0.5,0,0.499999999999,0.5,1.5,1299.5,1599.5}.Select(n=>new{Input=n,Expected=Math.Round(n,MidpointRounding.AwayFromZero)}).ToArray();
            var result=new{Version=1,SourceHashes=hashes,TableCount=tables.Count,RoadCount=realRoads.Count,Coordinates=coordinates,Calculations=calculations,RoadDistances=roadCases,Assessments=assessments,Masks=masks,Rounding=rounds};
            File.WriteAllText(output,serializer.Serialize(result),new UTF8Encoding(false));
            Console.WriteLine("C# reference: "+tables.Count+" profiles, "+calculations.Count+" calculations, "+coordinates.Count+" coordinate cases, "+roadCases.Count+" road distances, "+assessments.Count+" assessments, "+masks.Count+" full masks.");
        }
    }
}
