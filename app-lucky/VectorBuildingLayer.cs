using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Web.Script.Serialization;

namespace BakhmutMap {
    public class BuildingData {public int schema{get;set;}public List<BuildingContour> buildings{get;set;}}
    public class BuildingContour {public int group{get;set;}public double[][] vertices{get;set;}}
    // Source contours only. Symbols without footprints are deliberately not expanded.
    public sealed class VectorBuildingLayer:IDisposable {
        private sealed class Shape {public PointF[] Points;public RectangleF Bounds;}
        private readonly List<Shape> shapes=new List<Shape>();
        public int PolygonCount {get{return shapes.Count;}}
        public VectorBuildingLayer(string file){
            var data=new JavaScriptSerializer{MaxJsonLength=20000000}.Deserialize<BuildingData>(File.ReadAllText(file));
            if(data==null||data.schema!=1||data.buildings==null)throw new FormatException("Invalid building geometry");
            foreach(var contour in data.buildings){
                if(contour==null||contour.vertices==null||contour.vertices.Length<3)throw new FormatException("Invalid contour");
                var points=new PointF[contour.vertices.Length];
                float left=float.MaxValue,bottom=float.MaxValue,right=float.MinValue,top=float.MinValue;
                for(int i=0;i<points.Length;i++){
                    var p=contour.vertices[i];
                    if(p==null||p.Length!=2||double.IsNaN(p[0])||double.IsNaN(p[1])||double.IsInfinity(p[0])||double.IsInfinity(p[1])||Math.Abs(p[0])>100000||Math.Abs(p[1])>100000)throw new FormatException("Invalid contour coordinate");
                    points[i]=new PointF((float)p[0],(float)p[1]);
                    left=Math.Min(left,points[i].X);right=Math.Max(right,points[i].X);bottom=Math.Min(bottom,points[i].Y);top=Math.Max(top,points[i].Y);
                }
                shapes.Add(new Shape{Points=points,Bounds=RectangleF.FromLTRB(left,bottom,right,top)});
            }
        }
        public void Draw(Graphics g,MapCanvas map){
            if(map.PixelsPerMetre<0.3)return;
            var nw=map.World(new PointF(0,0));var se=map.World(new PointF(map.Width,map.Height));
            var view=RectangleF.FromLTRB((float)nw.X,(float)se.Z,(float)se.X,(float)nw.Z);
            var state=g.Save();
            try{
                var corner=map.Screen(new MapPoint(0,Coordinates.Extent));float extent=(float)(Coordinates.Extent*map.PixelsPerMetre);
                g.SetClip(new RectangleF(corner.X,corner.Y,extent,extent),CombineMode.Intersect);
                g.SmoothingMode=SmoothingMode.AntiAlias;
                using(var transform=new Matrix((float)map.PixelsPerMetre,0,0,(float)-map.PixelsPerMetre,(float)(map.Width/2.0-map.CenterX*map.PixelsPerMetre),(float)(map.Height/2.0+map.CenterZ*map.PixelsPerMetre)))
                using(var fill=new SolidBrush(Color.FromArgb(182,188,178)))
                using(var stroke=new Pen(Color.FromArgb(65,73,65),(float)(0.8/map.PixelsPerMetre))){
                    g.Transform=transform;
                    foreach(var shape in shapes)if(shape.Bounds.IntersectsWith(view)){g.FillPolygon(fill,shape.Points);g.DrawPolygon(stroke,shape.Points);}
                }
            }finally{g.Restore(state);}
        }
        public void Dispose(){shapes.Clear();}
    }
}
