"""Compare decoded roads to an independent user screenshot using its grid."""
from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/maps/bakhmut'


def nearest_segment(points,segments):
    a=segments[:,0];v=segments[:,1]-a;den=np.sum(v*v,axis=1)
    result=[]
    for p in points:
        t=np.clip(np.sum((p-a)*v,axis=1)/np.maximum(den,1e-12),0,1)
        result.append(float(np.linalg.norm(p-(a+t[:,None]*v),axis=1).min()))
    return result


def main():
    screenshot=Image.open(ROOT/'references/screenshots/престрелка.jpg').convert('RGB')
    pixels=np.array(screenshot).astype(int)
    if screenshot.size!=(1920,1080): raise ValueError('Unexpected screenshot size')
    roads=json.loads((OUT/'roads.json').read_text())
    all_segments=np.array([s for r in roads['roads'] for s in r['segments']])
    # Grid anchors from the screenshot: x=6000 at pixel 692, z=9400 at y=217;
    # adjacent grid lines are 390 px / 100 game metres apart.
    samples=[]
    for x in [700,850,1200,1450,1650]:
        column=pixels[:,x]
        search_y=.837*(x-1082)+493
        mask=(column[:,0]>75)&(column[:,1]>65)&(column[:,2]<75)
        mask&=(column[:,0]-column[:,2]>35)&(column[:,1]-column[:,2]>35)
        mask&=np.abs(np.arange(1080)-search_y)<70
        ys=np.where(mask)[0]
        if not 40<=len(ys)<=100: raise ValueError('Road colour detection failed')
        y=float(np.median(ys))
        game=[6000+(x-692)/3.9,9400-(y-217)/3.9]
        residual=nearest_segment([game],all_segments)[0]
        if residual>2: raise ValueError(f'Screenshot alignment failed: {residual:.2f} m')
        samples.append({'screenshotPixel':[x,y],'gameXZ':game,'centrelineResidualMetres':residual})
    result={'schema':1,'screenshot':'references/screenshots/престрелка.jpg',
        'method':'yellow road centre detected in five columns; grid anchors independent of road geometry',
        'gridAnchors':{'pixel':[692,217],'gameXZ':[6000,9400],'pixelsPerGameMetre':3.9},
        'samples':samples,'maximumCentrelineResidualMetres':max(s['centrelineResidualMetres'] for s in samples),
        'scope':'local registration of this visible road segment only; pixel detection is not a guarantee of global or physical-road accuracy',
        'firstTest':{'startXZ':[5192.207792207792,9404.310344827587],
                     'endXZ':[6091.538461538462,9328.97435897436],
                     'distanceGameMetres':902.4805613215322,
                     'status':'approximate marker positions from prior screenshots; agrees with user ruler about 900 m'}}
    (OUT/'registration.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    overlay=screenshot.copy();draw=ImageDraw.Draw(overlay)
    def to_pixel(p): return (692+(p[0]-6000)*3.9,217-(p[1]-9400)*3.9)
    for road in roads['roads']:
        for segment in road['segments']:
            a,b=map(to_pixel,segment)
            if max(a[0],b[0])<0 or min(a[0],b[0])>1920 or max(a[1],b[1])<0 or min(a[1],b[1])>1080: continue
            draw.line((a,b),fill='#65efff',width=2)
    for s in samples:
        x,y=s['screenshotPixel'];draw.ellipse((x-6,y-6,x+6,y+6),fill='white',outline='#111111',width=2)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
    draw.rectangle((75,65,630,105),fill='#17201f')
    draw.text((88,73),'Голубая линия — ось дороги из .topo',font=font,fill='white')
    overlay.save(OUT/'road-registration-review.jpg',quality=94)
    print(f"5 independent samples checked; max residual {result['maximumCentrelineResidualMetres']:.3f} game metres")


if __name__=='__main__':main()
