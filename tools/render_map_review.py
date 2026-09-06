"""Render a map registration review, not a firing solution."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT/'data/maps/bakhmut'


def main():
    Image.MAX_IMAGE_PIXELS = 110_000_000
    image = Image.open(FOLDER/'background.jpg')
    image.thumbnail((1800,1800))
    draw = ImageDraw.Draw(image)
    factor = image.width/10240
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 19)
    small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)
    def point(x,z): return (x*factor,(10240-z)*factor)
    colors={1:'#dbc857',2:'#dcc078',3:'#a88964',5:'#a8997b'}
    for road in json.loads((FOLDER/'roads.json').read_text())['roads']:
        for quad in road['quads']:
            draw.polygon([point(*p) for p in quad],fill=colors.get(road['type'],'#cab575'))
    for value in range(0,10241,1000):
        x,y=point(value,value)
        draw.line((x,0,x,image.height), fill='#77776b',width=1)
        draw.line((0,y,image.width,y), fill='#77776b',width=1)
        draw.text((x+3,4),f'{value//100:03}',font=small,fill='white',stroke_width=1,stroke_fill='black')
        draw.text((3,y+3),f'{value//100:03}',font=small,fill='white',stroke_width=1,stroke_fill='black')
    for site in json.loads((FOLDER/'points.json').read_text(encoding='utf-8')):
        x,y=point(site['x'],site['z'])
        draw.ellipse((x-5,y-5,x+5,y+5),fill='#ef9160',outline='white')
        label=site['name']
        if label=='opytne': label+=' / Рабкор'
        draw.text((x+9,y-9),label,font=font,fill='white',stroke_width=2,stroke_fill='#222222')
    for name,coords in [('A',(5192,9404)),('B',(6092,9329))]:
        x,y=point(*coords)
        draw.ellipse((x-6,y-6,x+6,y+6),fill='#66dbe7',outline='white')
        draw.text((x+9,y-14),name,font=font,fill='white',stroke_width=2,stroke_fill='black')
    image.save(FOLDER/'map-review.jpg',quality=94)
    original=Image.open(FOLDER/'background.jpg')
    original.crop((4400,10240-9800,6300,10240-9000)).save(FOLDER/'test-area-review.jpg',quality=94)


if __name__=='__main__': main()
