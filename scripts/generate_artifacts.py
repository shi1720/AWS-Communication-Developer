"""Create SecondCrate's original architecture SVG and print PDFs.

Uses the bundled reportlab runtime. Run from the repository root after reviewing
the deployment status and the source narration in docs/VIDEO_SCRIPT.md.
"""
from pathlib import Path
from xml.sax.saxutils import escape
import re
import os
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT

ROOT = Path.cwd()
OUT = ROOT / 'deliverables'
OUT.mkdir(exist_ok=True)
ASSETS = ROOT / 'docs/assets'
ASSETS.mkdir(parents=True, exist_ok=True)
RUNTIME = Path(os.environ.get('CODEX_ARTIFACT_RUNTIME', str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies')))
FONTS = RUNTIME / 'node/node_modules/pdfjs-dist/standard_fonts'
pdfmetrics.registerFont(TTFont('SecondCrate', str(FONTS / 'LiberationSans-Regular.ttf')))
pdfmetrics.registerFont(TTFont('SecondCrateBold', str(FONTS / 'LiberationSans-Bold.ttf')))
pdfmetrics.registerFontFamily('SecondCrate', normal='SecondCrate', bold='SecondCrateBold')
G, L, C, A, I, M, D = '#244c3a', '#d4e9a8', '#f7f8f5', '#df865b', '#183729', '#617065', '#d8ded5'
PW, PH = 595.276, 841.89

def norm(text):
    return text.replace('\u2014', '-').replace('\u2013', '-').replace('\u2011', '-')

def paragraph(c, text, x, top, width, size=11, color=I, bold=False, leading=None):
    style = ParagraphStyle('p', fontName='SecondCrateBold' if bold else 'SecondCrate', fontSize=size, leading=leading or size*1.34, textColor=HexColor(color), alignment=TA_LEFT, spaceAfter=0)
    p=Paragraph(norm(text), style)
    _, h=p.wrap(width, 2000)
    p.drawOn(c,x,PH-top-h)
    return h

def rule(c, top, x=44, width=507, color=D):
    c.setStrokeColor(HexColor(color));c.setLineWidth(.7);c.line(x,PH-top,x+width,PH-top)

def base(c, title, page, subtitle=''):
    c.setFillColor(HexColor(C));c.rect(0,0,PW,PH,fill=1,stroke=0)
    paragraph(c,'SECONDCRATE',44,29,300,10,G,True)
    paragraph(c,title,44,57,510,31,G,True,35)
    if subtitle: paragraph(c,subtitle,44,108,507,11,M)
    rule(c,789)
    paragraph(c,'Shivam Gupta  /  SecondCrate',44,802,350,9,M)
    paragraph(c,f'{page:02d}',525,802,40,9,M)

# Shared editable diagram model. Shape coordinates are also used in the SVG.
NODES = [
 ('Browser', 'Authenticated operator',40,145,220,93,C),
 ('CloudFront', 'HTTPS application entry',40,306,220,93,C),
 ('Private S3', 'Web application assets',40,473,220,93,C),
 ('HTTP API', 'API Gateway',450,145,270,93,C),
 ('Lambda', 'Validated order service',450,306,270,93,G),
 ('DynamoDB', 'Snapshot chunks + CAS head',450,473,270,93,L),
 ('Bedrock', 'Constrained intent proposal',880,145,280,93,C),
 ('AWS CDS', 'SES / WhatsApp / SMS',880,306,280,93,L),
 ('SNS', 'Topic',880,473,116,93,C),
 ('SQS', 'Queue',1044,473,116,93,C),
 ('DLQ', 'Review',1044,637,116,82,C),
]
PATHS = [
 [(150,238),(150,306)],
 [(260,352),(350,352),(350,191),(450,191)],
 [(150,399),(150,473)],
 [(585,238),(585,306)],
 [(720,339),(806,339),(806,191),(880,191)],
 [(720,367),(880,367)],
 [(585,399),(585,473)],
 [(938,399),(938,473)],
 [(996,519),(1044,519)],
 [(1102,566),(1102,602),(800,602),(800,399),(720,399)],
 [(1102,566),(1102,637)],
]

def architecture_svg():
    chunks=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 780" role="img" aria-labelledby="title desc">',
      '<title id="title">SecondCrate deployable AWS architecture</title>',
      '<desc id="desc">CloudFront serves private S3 assets and connects the browser to API Gateway and Lambda. Lambda uses Bedrock, a versioned DynamoDB workspace, and SES or End User Messaging. Inbound events pass through SNS and SQS with a dead-letter queue. Cloud validation is pending.</desc>',
      f'<rect width="1200" height="780" fill="{C}"/>',
      f'<style>text{{font-family:Liberation Sans,Arial,sans-serif;fill:{G}}}.title{{font-size:32px;font-weight:700}}.body{{font-size:19px}}.label{{font-size:26px;font-weight:700}}.sub{{font-size:18px}}</style>',
      f'<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="{M}"/></marker></defs>',
      '<text x="40" y="53" class="title">SecondCrate deployable AWS architecture</text>',
      '<text x="40" y="89" class="body">Cloud validation pending. Provider events currently route to one configured live workspace.</text>']
    for points in PATHS:
      chunks.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in points)}" fill="none" stroke="{M}" stroke-width="2.8" marker-end="url(#a)"/>')
    for title,sub,x,y,w,h,fill in NODES:
      color='#ffffff' if fill==G else G
      chunks.extend([f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{fill}" stroke="{D}"/>',f'<text x="{x+17}" y="{y+36}" class="label" style="fill:{color}">{escape(title)}</text>',f'<text x="{x+17}" y="{y+68}" class="sub" style="fill:{color}">{escape(sub)}</text>'])
    chunks.extend(['<text x="40" y="640" class="label">Operational controls</text>',
      '<text x="40" y="678" class="body">Secrets Manager: CloudFront origin secret. CloudWatch: logs and alarms.</text>',
      '<text x="40" y="710" class="body">EventBridge retries queued outbox sends. Unknown outcomes require review.</text>',
      '<text x="40" y="756" class="sub">SES inbound MIME uses private S3. DynamoDB workspace limit: 2 MB. Source: infra/stack.ts and src/server/lambda.ts.</text>', '</svg>'])
    (ASSETS/'architecture.svg').write_text('\n'.join(chunks))

def architecture_pdf(c, x, top, width):
    scale=width/1200
    def tx(text,xx,yy,size,bold=False,color=G):
      c.setFont('SecondCrateBold' if bold else 'SecondCrate',size*scale);c.setFillColor(HexColor(color));c.drawString(x+xx*scale,PH-top-yy*scale,norm(text))
    c.setLineWidth(2.8*scale);c.setStrokeColor(HexColor(M))
    for pts in PATHS:
      p=c.beginPath();p.moveTo(x+pts[0][0]*scale,PH-top-pts[0][1]*scale)
      for xx,yy in pts[1:]:p.lineTo(x+xx*scale,PH-top-yy*scale)
      c.drawPath(p)
      a,b=pts[-2:];xx,yy=b;dx=xx-a[0];dy=yy-a[1]
      import math
      theta=math.atan2(dy,dx);l=9;off=.5
      p=c.beginPath();p.moveTo(x+xx*scale,PH-top-yy*scale)
      p.lineTo(x+(xx-l*math.cos(theta-off))*scale,PH-top-(yy-l*math.sin(theta-off))*scale)
      p.lineTo(x+(xx-l*math.cos(theta+off))*scale,PH-top-(yy-l*math.sin(theta+off))*scale);p.close()
      c.setFillColor(HexColor(M));c.drawPath(p,fill=1,stroke=0)
    for title,sub,xx,yy,w,h,fill in NODES:
      c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(D));c.roundRect(x+xx*scale,PH-top-(yy+h)*scale,w*scale,h*scale,3*scale,fill=1,stroke=1)
      color='#ffffff' if fill==G else G
      tx(title,xx+17,yy+36,26,True,color);tx(sub,xx+17,yy+68,18,False,color)
    tx('Secrets Manager: CloudFront origin secret. CloudWatch: logs and alarms.',40,649,20)
    tx('EventBridge retries queued sends. Unknown provider outcomes need review.',40,687,20)
    tx('SES inbound MIME uses private S3. Provider routing: one live workspace.',40,726,20)

def make_brief():
    c=canvas.Canvas(str(OUT/'SecondCrate-Product-Technical-Brief.pdf'),pagesize=(PW,PH))
    c.setTitle('SecondCrate - Product and technical brief');c.setAuthor('Shivam Gupta')
    base(c,'Every good lot deserves a buyer',1,'A product brief for regional produce distributors')
    paragraph(c,'A cancelled order can become a useful conversation.',44,151,504,21,G,True)
    paragraph(c,'SecondCrate helps a depot offer released stock to existing buyers, interpret conditional replies and confirm only orders that fit its price, inventory and delivery rules. Customers can stay in their connected messaging channel.',44,213,507,12,leading=16)
    rule(c,284)
    paragraph(c,'The recovery workflow',44,308,251,18,G,True)
    steps=[('01','Release a known lot','The operator reviews the cancellation and confirms the stock is available.'),('02','Find eligible buyers','Check consent, preferences, capacity and the delivery window.'),('03','Interpret the reply','AI proposes quantity, price and timing. Application rules authorise the order.'),('04','Commit and reconcile','A conditional update protects stock. Orders, messages and audit events stay linked.')]
    y=351
    for number,title,body in steps:
      paragraph(c,number,44,y,34,17,A,True)
      paragraph(c,title,86,y,202,12,G,True)
      h=paragraph(c,body,86,y+23,202,10.5,M,leading=14)
      y+=max(72,h+37)
    c.setFillColor(HexColor(L));c.rect(321,PH-618,230,310,fill=1,stroke=0)
    paragraph(c,'ILLUSTRATIVE ORDER',339,327,195,9,G,True)
    paragraph(c,'£708',337,351,195,47,G,True)
    paragraph(c,'booked sales',341,411,190,13,G)
    rule(c,452,340,191,G)
    paragraph(c,'£480',340,468,92,22,G,True);paragraph(c,'book cost',440,475,95,11,G)
    paragraph(c,'£228',340,513,92,22,G,True);paragraph(c,'spread',440,520,95,11,G)
    paragraph(c,'40 crates / 200 kg allocated<br/>Before handling, transport and software',340,564,190,10,G,leading=14)
    rule(c,657)
    paragraph(c,'The proposed commercial offer',44,677,507,17,G,True)
    paragraph(c,'£299 per depot per month. At £5 contribution per additional crate, 60 additional crates cover the subscription. A paid pilot must establish incremental results against the current process.',44,708,507,11,M,leading=14)
    paragraph(c,'Synthetic Northstar Produce scenario. No customer traction, collected revenue or measured avoided waste is claimed.',44,762,507,8.5,M)
    c.showPage()
    base(c,'Transaction integrity on AWS',2,'Deployable architecture. Cloud validation pending.')
    paragraph(c,'Authenticated workspaces separate operators. A constrained Bedrock result proposes an intent, then deterministic checks decide whether the request can commit stock. The model cannot override those checks.',44,147,507,11.5,leading=15)
    architecture_pdf(c,27,168,541)
    rule(c,526)
    paragraph(c,'Integrity under real messaging conditions',44,547,507,18,G,True)
    paragraph(c,'Price and capacity rules run before an order commits. DynamoDB snapshot chunks and a transactional compare-and-swap head preserve shared inventory. Event IDs protect against inbound replay. Failed and unknown delivery outcomes remain visible.',44,581,507,11,leading=15)
    paragraph(c,'Operational limits',44,664,245,13,G,True)
    paragraph(c,'One configured live workspace receives provider events. Workspace snapshots have a 2 MB limit. Human stock release does not certify food safety.',44,690,245,10,M,leading=13)
    paragraph(c,'Next validation',316,664,235,13,G,True)
    paragraph(c,'Deploy to AWS, verify Bedrock and SES, connect additional approved channels, then run paid depot pilots with measured baselines.',316,690,235,10,M,leading=13)
    paragraph(c,'Sources: repository infra/stack.ts and src/server/lambda.ts; docs/BUSINESS_CASE.md. Research: WRAP, UK surplus redistribution (2023 data), wrap.ngo. AWS pricing: aws.amazon.com/end-user-messaging/pricing and aws.amazon.com/ses/pricing. Checked 22 September 2026.',44,755,507,8,M,leading=10)
    c.showPage();c.save()

def make_script():
    source=(ROOT/'docs/VIDEO_SCRIPT.md').read_text()
    body=source.split('## Verbatim script',1)[1].split('## Action storyboard',1)[0]
    parts=re.findall(r'### ([^\n]+)\n\n(.*?)(?=\n\n### |\Z)',body.strip(),re.S)
    assert len(parts)==8,len(parts)
    spoken=' '.join(text.strip() for _,text in parts)
    assert len(spoken.split())==344
    c=canvas.Canvas(str(OUT/'SecondCrate-Video-Script.pdf'),pagesize=(PW,PH))
    c.setTitle('SecondCrate - Exact three-minute narration');c.setAuthor('Shivam Gupta')
    for p in range(2):
      base(c,'Three-minute narration',p+1,'Shivam Gupta / 344 spoken words / Read the body paragraphs only')
      if p==0:
        paragraph(c,'This release script requires verified live Bedrock and SES evidence. The development-preview replacement is in docs/VIDEO_SCRIPT.md.',44,146,507,10,A,True,14)
      else:
        paragraph(c,'The financial figures describe the synthetic demonstration. Keep the actual runtime and channel status visible in the recording.',44,146,507,10,A,True,14)
      y=199
      for timestamp,text in parts[p*4:p*4+4]:
        paragraph(c,norm(timestamp),44,y,98,11,G,True)
        h=paragraph(c,escape(text.strip()),148,y-2,403,13,I,leading=18)
        y+=max(h+30,92)
      assert y<780,('Script page overflow',p,y)
      c.showPage()
    c.save()

architecture_svg()
make_brief()
make_script()
print('Created architecture.svg and two PDF documents.')
