"""ONE clean rebuild of citywide_corp.json — idempotent. Produces the final map data:
APN (photos), zoning, DU count, assessment class, correct operator attribution, residential filter.
Run anytime; always yields the same correct output."""
import json, csv, re
from collections import Counter, defaultdict
csv.field_size_limit(2**31-1)
FR='/Users/nataliebaldacci/Master_Data/Nashville/who-owns-nashville/web/frontend'
MASTER='/Users/nataliebaldacci/Master_Data/Nashville/00_ORGANIZED/08_Reference_Library/Favorite_Data_Sets/Parcels_Enriched/MASTER_Current_Parcels_FINAL_2026-05-28.csv'
def pk(x):
    try: return str(int(float(x)))
    except: return str(x).strip()
def apn_fmt(a):
    a=str(a).strip(); return a.zfill(11) if a.isdigit() else a

cls=json.load(open('/tmp/parid_class.json'))
look={}
for row in csv.DictReader(open(MASTER)):
    k=pk(row.get('ParID'))
    if k: look[k]=(apn_fmt(row.get('APN','')), row.get('StructureType_1','').strip(),
                   row.get('LUDesc','').strip(), (row.get('Zoning') or '').strip(), row.get('DUCount','').strip())

COL={'Progress Residential':'#ff7f0e','American Homes 4 Rent':'#1f77b4','Amherst Residential':'#8dcaf0',
 'Starwood Capital Group':'#17becf','Tricon Residential':'#2ca02c','Invitation Homes':'#e377c2',
 'VineBrook Homes':'#9467bd','FirstKey Homes':'#008080','Rithm Capital':'#d62728','Brookfield':'#bcbd22',
 'Opendoor (iBuyer)':'#7570b3','Regent Homes':'#c49c48','Other corporate':'#c9ced6'}
LANDLORDS=set(k for k in COL if k not in ('Other corporate','Opendoor (iBuyer)','Regent Homes'))
# owner-name -> operator (first match wins)
RULES=[
 (re.compile(r'LEGACY SOUTH'),'Other corporate'),
 (re.compile(r'HOME PARTNERS|\bHPA\b'),'Tricon Residential'),
 (re.compile(r'\bSFR JV\b|TRICON SFR|C O TRICON|TAH HOLDING'),'Tricon Residential'),
 (re.compile(r'\bBAF\b|\bALTO\b|MESA VERDE|ARVM|VM MASTER|VM PRONTO|MUPR|\bSAFARI\b|ARMM|\bEPH\b|LAMCO|RH PARTNERS|AMHERST|\bCBAR\b|SRMZ|\bAMNL\b|MAIN STREET RENEWAL'),'Amherst Residential'),
 (re.compile(r'RESIDENTIAL HOME BUYER'),'Brookfield'),   # Brookfield (per user 2026-07-01) — NOT Progress
 (re.compile(r'SFR XII|YAMASA|\bPROGRESS\b|\bPR BORROWER\b|SFR INVESTMENTS V|FREO PROGRESS|PRETIUM|RESIDENTIAL HOME (OWNER|NASHVILLE)|\bFYR\b'),'Progress Residential'),
 (re.compile(r'\bAMH\b|AH4R|AMERICAN HOMES 4 RENT'),'American Homes 4 Rent'),
 (re.compile(r'STAR \d{4}.*SFR|STARWOOD'),'Starwood Capital Group'),
 (re.compile(r'INVITATION|RESICAP TENN'),'Invitation Homes'),
 (re.compile(r'VINEBROOK|VB TAH'),'VineBrook Homes'),
 (re.compile(r'FKH SFR|FIRSTKEY'),'FirstKey Homes'),
 (re.compile(r'RITHM|NEW RESIDENTIAL BORROWER'),'Rithm Capital'),
 (re.compile(r'MAYMONT|CONREX'),'Brookfield'),
 (re.compile(r'OPENDOOR|OFFERPAD'),'Opendoor (iBuyer)'),
 (re.compile(r'REGENT HOMES|\bREGENT\b'),'Regent Homes'),
]
BUILDER_BRANDS={'Regent Homes'}  # operators we add as builders (not landlords)
RES=re.compile(r'SINGLE FAMILY|CONDO|DUPLEX|ZERO LOT|TOWNH|APARTMENT|MOBILE|MANUFACTURED|RESIDENT|TRIPLEX|QUAD|DORMITOR')
COM=re.compile(r'OFFICE|RETAIL|STORE|HOTEL|MOTEL|WAREHOUSE|PARKING|BUSINESS|INDUSTRIAL|DISTRIBUTION|TERMINAL|RESTAURANT|SHOPPING|\bBANK\b|COMMERCIAL|\bGAS\b|\bAUTO|MEDICAL|THEATER|CHURCH|SCHOOL|CLUB')

base=json.load(open(f'{FR}/data/citywide_corp.beforeR.bak'))
C=base['cols'][:]
for c in ('zoning','du_count','assess_class'):
    if c not in C: C.append(c)
I={c:i for i,c in enumerate(C)}
apI,siI,liI,ziI,uiI,aiI,biI,ciI,oiI,piI = I['apn'],I['structure_type'],I['land_use'],I['zoning'],I['du_count'],I['assess_class'],I['brand'],I['color'],I['owner'],I['parid']

new=[]
for row in base['rows']:
    while len(row)<len(C): row.append('')
    k=pk(row[piI]); e=look.get(k); ac=cls.get(k,'')
    apn=st=lu=zon=du=''
    if e: apn,st,lu,zon,du=e
    row[apI]=apn; row[siI]=st; row[liI]=lu; row[ziI]=zon; row[uiI]=du; row[aiI]=ac
    # brand: owner-rule wins; else if currently a landlord but unmatched -> contamination -> Other; else keep
    o=(row[oiI] or '').upper(); assigned=None
    for rx,b in RULES:
        if rx.search(o): assigned=b; break
    if assigned is None and row[biI] in LANDLORDS: assigned='Other corporate'
    if assigned is not None: row[biI]=assigned
    row[ciI]=COL.get(row[biI], row[ciI])
    # residential filter
    is_res=bool(RES.search(lu.upper()) or RES.search(st.upper()))
    remove=bool(COM.search(lu.upper())) or (ac not in ('R','F','') and not is_res)
    if not remove: new.append(row)
base['cols']=C; base['rows']=new

lc=Counter(r[biI] for r in new)
order=['Progress Residential','American Homes 4 Rent','Amherst Residential','Starwood Capital Group','Tricon Residential','Invitation Homes','VineBrook Homes','FirstKey Homes','Rithm Capital','Brookfield']
builders=[L for L in base['legend'] if L.get('type')=='Builder']
if lc.get('Regent Homes') and not any(L['brand']=='Regent Homes' for L in builders):
    builders.append({'brand':'Regent Homes','color':COL['Regent Homes'],'n':0,'type':'Builder'})
ib=[{'brand':'Opendoor (iBuyer)','color':COL['Opendoor (iBuyer)'],'n':lc.get('Opendoor (iBuyer)',0),'type':'iBuyer'}] if lc.get('Opendoor (iBuyer)',0) else []
base['legend']=[{'brand':b,'color':COL[b],'n':lc.get(b,0),'type':'Landlord'} for b in order if lc.get(b,0)] \
             + [dict(L,n=lc.get(L['brand'],0)) for L in builders] \
             + ib \
             + [{'brand':'Other corporate','color':COL['Other corporate'],'n':lc.get('Other corporate',0),'type':'Other'}]
json.dump(base,open(f'{FR}/data/citywide_corp.json','w'),separators=(',',':'))
print('rebuilt:',len(new),'parcels |',len(C),'cols | APN on',sum(1 for r in new if r[apI]))
print('landlords:')
for b in order:
    if lc.get(b): print('  %-26s %s'%(b,format(lc[b],',')))
