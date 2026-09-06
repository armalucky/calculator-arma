"""Prepare compact local raster layers for the native Windows map viewer."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'data/maps/bakhmut'
TILE=1024


def save_detail(image, name):
    """One source pixel per game metre, with a one-pixel interpolation border."""
    folder=FOLDER/'detail'/name
    folder.mkdir(parents=True,exist_ok=True)
    for y in range(0,10240,TILE):
        for x in range(0,10240,TILE):
            # Clamp the outer border; never resize or move source pixels.
            tile=image.crop((max(0,x-1),max(0,y-1),min(10240,x+TILE+1),min(10240,y+TILE+1)))
            padded=Image.new('RGB',(TILE+2,TILE+2))
            ox=1 if x==0 else 0; oy=1 if y==0 else 0
            padded.paste(tile,(ox,oy))
            if x==0:padded.paste(padded.crop((1,0,2,TILE+2)),(0,0))
            if y==0:padded.paste(padded.crop((0,1,TILE+2,2)),(0,0))
            if x+TILE==10240:padded.paste(padded.crop((TILE,0,TILE+1,TILE+2)),(TILE+1,0))
            if y+TILE==10240:padded.paste(padded.crop((0,TILE,TILE+2,TILE+1)),(0,TILE+1))
            padded.save(folder/f'{x//TILE}_{y//TILE}.png')


def main():
    Image.MAX_IMAGE_PIXELS=110_000_000
    image=Image.open(FOLDER/'background.jpg').convert('RGB')
    if image.size!=(10240,10240):raise ValueError('Unexpected source extent; refusing to change map registration')
    save_detail(image,'background')
    road_data=json.loads((FOLDER/'roads.json').read_text())['roads']
    colours={1:'#dbc857',2:'#dcc078',3:'#a88964',5:'#a8997b'}
    full_draw=ImageDraw.Draw(image)
    for road in road_data:
        for q in road['quads']:
            full_draw.polygon([(p[0],10240-p[1]) for p in q],fill=colours.get(road['type'],'#cab575'))
    save_detail(image,'roads')
    del full_draw,image
    image=Image.open(FOLDER/'background.jpg').convert('RGB')
    image.thumbnail((5120,5120),Image.Resampling.LANCZOS)
    image.save(FOLDER/'desktop-background.jpg',quality=94)
    factor=image.width/10240
    draw=ImageDraw.Draw(image)
    colours={1:'#dbc857',2:'#dcc078',3:'#a88964',5:'#a8997b'}
    for road in road_data:
        for q in road['quads']:
            draw.polygon([(p[0]*factor,(10240-p[1])*factor) for p in q],fill=colours.get(road['type'],'#cab575'))
    image.save(FOLDER/'desktop-roads.jpg',quality=94)
    print('Prepared overview layers and 200 lossless detail tiles (1 game metre/pixel)')


if __name__=='__main__':main()
