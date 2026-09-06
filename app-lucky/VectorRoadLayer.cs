using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace BakhmutMap {
    public class VisualRoadData {public int schema{get;set;}public List<VisualRoad> roads{get;set;}}
    public class VisualRoad {public int type{get;set;}public double[][][] quads{get;set;}}
    // Draw the original TOPO polygons; never simplify, snap or widen them.
    public sealed class VectorRoadLayer:IDisposable {
        private sealed class Shape:IDisposable {
            public GraphicsPath Path=new GraphicsPath(FillMode.Winding);
            public SolidBrush Brush;
            public RectangleF Bounds;
            public void Dispose(){Path.Dispose();if(Brush!=null)Brush.Dispose();}
        }
        private readonly List<Shape> shapes=new List<Shape>();
        public int PolygonCount{get;private set;}
        public VectorRoadLayer(string file){
            var data=new JavaScriptSerializer{MaxJsonLength=20000000}.Deserialize<VisualRoadData>(File.ReadAllText(file));
            if(data==null||data.schema!=1||data.roads==null)throw new FormatException("Invalid visual road data");
            try{
                foreach(VisualRoad road in data.roads){
                    if(road==null||road.quads==null)throw new FormatException("Missing road geometry");
                    var shape=new Shape();shapes.Add(shape);
                    shape.Brush=new SolidBrush(ColorTranslator.FromHtml(road.type==1?"#dbc857":road.type==2?"#dcc078":road.type==3?"#a88964":road.type==5?"#a8997b":"#cab575"));
                    foreach(double[][] quad in road.quads){
                        // Reuse the same validator as the unchanged position planner.
                        new RoadShape(quad);
                        PointF[] points=quad.Select(p=>new PointF((float)p[0],(float)p[1])).ToArray();
                        double winding=0;for(int i=0;i<4;i++){int j=(i+1)%4;winding+=quad[i][0]*quad[j][1]-quad[j][0]*quad[i][1];}
                        if(winding<0)Array.Reverse(points);
                        shape.Path.AddPolygon(points);PolygonCount++;
                    }
                    shape.Bounds=shape.Path.GetBounds();
                }
            }catch{Dispose();throw;}
        }
        public void Draw(Graphics g,MapCanvas map){
            MapPoint topLeft=map.World(new PointF(0,0)),bottomRight=map.World(new PointF(map.Width,map.Height));
            RectangleF view=RectangleF.FromLTRB((float)topLeft.X,(float)bottomRight.Z,(float)bottomRight.X,(float)topLeft.Z);
            GraphicsState state=g.Save();
            try{
                PointF nw=map.Screen(new MapPoint(0,Coordinates.Extent));float extent=(float)(Coordinates.Extent*map.PixelsPerMetre);
                g.SetClip(new RectangleF(nw.X,nw.Y,extent,extent),CombineMode.Intersect);
                g.SmoothingMode=SmoothingMode.AntiAlias;g.PixelOffsetMode=PixelOffsetMode.Default;
                using(var transform=new Matrix((float)map.PixelsPerMetre,0,0,(float)-map.PixelsPerMetre,(float)(map.Width/2.0-map.CenterX*map.PixelsPerMetre),(float)(map.Height/2.0+map.CenterZ*map.PixelsPerMetre))){
                    g.Transform=transform;
                    foreach(Shape shape in shapes)if(shape.Bounds.IntersectsWith(view))g.FillPath(shape.Brush,shape.Path);
                }
            }finally{g.Restore(state);}
        }
        public void Dispose(){foreach(Shape shape in shapes)shape.Dispose();shapes.Clear();}
    }
}
