using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;

namespace BakhmutMap {
    public class PlanningOptions {
        public double Reserve { get; set; }
        public double RoadOffset { get; set; }
        public double SiteOffset { get; set; }
        public bool Show { get; set; }
        public PlanningOptions() {Reserve=200;RoadOffset=100;SiteOffset=300;}
        public static bool Valid(PlanningOptions p) {return p!=null&&p.Reserve>=0&&p.Reserve<=3000&&p.RoadOffset>=0&&p.RoadOffset<=1000&&p.SiteOffset>=0&&p.SiteOffset<=2000;}
    }
    public class RoadFile {public int schema {get;set;} public List<RoadRecord> roads {get;set;}}
    public class RoadRecord {public double[][][] quads {get;set;}}
    public class RoadShape {
        public double[][] Vertices;
        public double MinX,MaxX,MinZ,MaxZ;
        public RoadShape(double[][] vertices) {
            if(vertices==null||vertices.Length!=4||vertices.Any(v=>v==null||v.Length!=2||v.Any(n=>Double.IsNaN(n)||Double.IsInfinity(n)||Math.Abs(n)>100000)))throw new FormatException("Invalid road polygon");
            Vertices=vertices;MinX=vertices.Min(v=>v[0]);MaxX=vertices.Max(v=>v[0]);MinZ=vertices.Min(v=>v[1]);MaxZ=vertices.Max(v=>v[1]);
        }
        public double DistanceSquared(double x,double z) {
            double best=Double.PositiveInfinity;bool inside=false;
            for(int i=0,j=3;i<4;j=i++) {
                double ax=Vertices[j][0],az=Vertices[j][1],bx=Vertices[i][0],bz=Vertices[i][1];
                if((az>z)!=(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
                double dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
                double t=length==0?0:Math.Max(0,Math.Min(1,((x-ax)*dx+(z-az)*dz)/length));
                double ex=x-ax-t*dx,ez=z-az-t*dz;best=Math.Min(best,ex*ex+ez*ez);
            }
            return inside?0:best;
        }
    }
    // BVH nearest-polygon search: offset is measured from the road edge, not its centreline.
    public class RoadIndex {
        private class Node {
            public double MinX,MaxX,MinZ,MaxZ;
            public Node Left,Right;public RoadShape[] Shapes;
            public double LowerBound(double x,double z) {double dx=Math.Max(0,Math.Max(MinX-x,x-MaxX)),dz=Math.Max(0,Math.Max(MinZ-z,z-MaxZ));return dx*dx+dz*dz;}
        }
        private Node root;
        public int Count {get;private set;}
        public RoadIndex(IEnumerable<RoadShape> shapes) {
            RoadShape[] array=shapes.ToArray();if(array.Length==0)throw new FormatException("No road geometry");Count=array.Length;root=Build(array);
        }
        public static RoadIndex Load(string path) {
            JavaScriptSerializer serializer=new JavaScriptSerializer{MaxJsonLength=20000000};
            RoadFile file=serializer.Deserialize<RoadFile>(File.ReadAllText(path));
            if(file==null||file.schema!=1||file.roads==null||file.roads.Any(r=>r==null||r.quads==null))throw new FormatException("Invalid road data");
            return new RoadIndex(file.roads.SelectMany(r=>r.quads).Select(q=>new RoadShape(q)));
        }
        private static Node Build(RoadShape[] shapes) {
            Node n=new Node{MinX=shapes.Min(s=>s.MinX),MaxX=shapes.Max(s=>s.MaxX),MinZ=shapes.Min(s=>s.MinZ),MaxZ=shapes.Max(s=>s.MaxZ)};
            if(shapes.Length<=8)n.Shapes=shapes;
            else {bool byX=n.MaxX-n.MinX>=n.MaxZ-n.MinZ;Array.Sort(shapes,(a,b)=>(byX?a.MinX+a.MaxX:a.MinZ+a.MaxZ).CompareTo(byX?b.MinX+b.MaxX:b.MinZ+b.MaxZ));int half=shapes.Length/2;n.Left=Build(shapes.Take(half).ToArray());n.Right=Build(shapes.Skip(half).ToArray());}
            return n;
        }
        private static double Find(Node n,double x,double z,double best) {
            if(n.LowerBound(x,z)>best)return best;
            if(n.Shapes!=null) {foreach(RoadShape s in n.Shapes){best=Math.Min(best,s.DistanceSquared(x,z));if(best==0)break;}return best;}
            Node first=n.Left,second=n.Right;if(first.LowerBound(x,z)>second.LowerBound(x,z)){first=n.Right;second=n.Left;}
            best=Find(first,x,z,best);return best==0?0:Find(second,x,z,best);
        }
        public double Distance(MapPoint p) {if(!Coordinates.Valid(p))throw new ArgumentException("Invalid map point");return Math.Sqrt(Find(root,p.X,p.Z,Double.PositiveInfinity));}
    }
    public class PositionAssessment {
        public double Distance,Reserve,RoadDistance,SiteDistance;
        public bool RangeAllowed,RoadAllowed,SiteAllowed;
        public bool Allowed {get{return RangeAllowed&&RoadAllowed&&SiteAllowed;}}
    }
    public class CandidateMask : IDisposable {
        public const int CellSize=20,Size=512;
        public Bitmap Image;
        public int Cells;
        public void Dispose() {if(Image!=null)Image.Dispose();}
    }
    public static class PositionPlanner {
        public static double NearestSite(MapPoint p,List<Site> sites) {return sites.Count==0?Double.PositiveInfinity:sites.Min(s=>Coordinates.Distance(p,new MapPoint(s.x,s.z)));}
        public static PositionAssessment Assess(GameTable table,MapPoint target,MapPoint position,PlanningOptions options,RoadIndex roads,List<Site> sites) {
            if(table==null||!Coordinates.Valid(target)||!Coordinates.Valid(position)||!PlanningOptions.Valid(options))throw new ArgumentException("Invalid planning input");
            double distance=Coordinates.Distance(target,position);
            double roadDistance=roads.Distance(position);
            double siteDistance=NearestSite(position,sites);
            return new PositionAssessment{Distance=distance,Reserve=table.rows.Last().distance-distance,RoadDistance=roadDistance,SiteDistance=siteDistance,
                RangeAllowed=distance>=table.rows.First().distance&&distance<=table.rows.Last().distance-options.Reserve,
                RoadAllowed=roadDistance>0&&roadDistance>=options.RoadOffset,SiteAllowed=siteDistance>0&&siteDistance>=options.SiteOffset};
        }
        public static CandidateMask CreateMask(GameTable table,MapPoint target,PlanningOptions options,RoadIndex roads,List<Site> sites) {
            if(table==null||!Coordinates.Valid(target)||!PlanningOptions.Valid(options))throw new ArgumentException("Invalid planning input");
            CandidateMask mask=new CandidateMask();int size=CandidateMask.Size,step=CandidateMask.CellSize;
            int[] pixels=new int[size*size];
            // A whole 20 m cell must satisfy both distances: half-diagonal is a conservative margin.
            double margin=step/Math.Sqrt(2),inner=table.rows.First().distance+margin,outer=table.rows.Last().distance-options.Reserve-margin;
            if(outer>=inner) {
                int minX=Math.Max(0,(int)Math.Floor((target.X-outer)/step)),maxX=Math.Min(size-1,(int)Math.Floor((target.X+outer)/step));
                int minZ=Math.Max(0,(int)Math.Floor((target.Z-outer)/step)),maxZ=Math.Min(size-1,(int)Math.Floor((target.Z+outer)/step));
                for(int iz=minZ;iz<=maxZ;iz++)for(int ix=minX;ix<=maxX;ix++) {
                    MapPoint p=new MapPoint((ix+.5)*step,(iz+.5)*step);double d=Coordinates.Distance(target,p);
                    if(d<inner||d>outer||NearestSite(p,sites)<options.SiteOffset+margin||roads.Distance(p)<options.RoadOffset+margin)continue;
                    pixels[(size-1-iz)*size+ix]=Color.FromArgb(105,45,235,174).ToArgb();mask.Cells++;
                }
            }
            mask.Image=new Bitmap(size,size,PixelFormat.Format32bppArgb);
            BitmapData data=mask.Image.LockBits(new Rectangle(0,0,size,size),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
            try {for(int y=0;y<size;y++)Marshal.Copy(pixels,y*size,IntPtr.Add(data.Scan0,y*data.Stride),size);}finally{mask.Image.UnlockBits(data);}
            return mask;
        }
    }
    public static class SiteNames {
        public static void ApplyScenarioNames(Session state,List<Site> originals) {
            if(state.NamingVersion>=2)return;
            foreach(Site site in originals)state.Names[site.id]=site.name;
            state.NamingVersion=2;
        }
    }
}
