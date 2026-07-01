import pandas as pd, re, json, networkx as nx, os, sys
from collections import Counter
sys.path.insert(0,'/Users/nataliebaldacci/Master_Data/Nashville/who-owns-nashville/scripts')
from utils_links import opencorporates_url

OOS="/Users/nataliebaldacci/Master_Data/Nashville/00_ORGANIZED/01_Who_Owns/Findings_Tables_Graphics/Ownership_History_Aggregation_2026-05-22/OOS_Owners_v5_ADDRESS_BASED.csv"
TNSOS="/Users/nataliebaldacci/Master_Data/Nashville/TN_Bus_Lookup/_scraper/TNSOS_Resolved_2026-06-30.csv"
REGRID="/Users/nataliebaldacci/Master_Data/Nashville/00_ORGANIZED/08_Reference_Library/Favorite_Data_Sets/Parcels_Enriched/Regrid_Parcels_Nashville.csv"
OUTD="/Users/nataliebaldacci/Master_Data/Nashville/who-owns-nashville/web/frontend/data/owners"
os.makedirs(OUTD,exist_ok=True)

U=lambda s:re.sub(r'\s+',' ',re.sub(r'[^A-Z0-9 ]',' ',str(s).upper())).strip()
def po_norm(a):
    a=str(a).upper(); a=re.sub(r'\b(STE|SUITE|UNIT|APT|FL|FLOOR|#|BLDG|DEPT)\s*[\w-]+','',a)
    return re.sub(r'\s+',' ',a).strip().strip(',')
AGENT=re.compile(r'C ?/ ?O|CORPORATION SERVICE|C T CORP|COGENCY|REGISTERED AGENT|\bCSC\b|INCORP SERV|RYAN LLC')

# --- owners (parcel-level -> per name) ---
o=pd.read_csv(OOS,dtype=str).fillna('')
o['nname']=o['name'].map(U)
ENT=re.compile(r'\b(LLC|LP|INC|CORP|LTD|TRUST|COMPANY|PARTNERSHIP|HOLDINGS|PROPERTIES|REALTY|ASSET|BORROWER|FUND|HOMES|RESIDENTIAL|CAPITAL|INVEST|GROUP|VENTURES|PROPCO)\b')
o=o[o['nname'].str.contains(ENT)]
name_parcels=o.groupby('nname')['parcelid'].apply(lambda s:sorted(set(s))).to_dict()
name_raw={r['nname']:r['name'] for _,r in o.drop_duplicates('nname').iterrows()}
name_brand={r['nname']:r['brand'] for _,r in o.drop_duplicates('nname').iterrows()}

# --- TNSOS principal offices by name ---
t=pd.read_csv(TNSOS,dtype=str).fillna('')
t['nname']=t['input_owner'].map(U)
sos={}
for _,r in t.iterrows():
    if r['nname'] in sos: continue
    sos[r['nname']]=dict(control=r['control_number'],ra=r['registered_agent_name'],ra_addr=r['registered_agent_address'],
        po=r['principal_office_address'],po_n=po_norm(r['principal_office_address']),status=r['status'],formed=r['formed_in'])

# --- graph: names as nodes; edges by shared principal office (clean, non-agent) ---
G=nx.Graph(); G.add_nodes_from(name_parcels.keys())
po_groups={}
for nm,s in sos.items():
    po=s['po_n']
    if not po or AGENT.search(s['po']) or AGENT.search(po): continue
    if nm in name_parcels: po_groups.setdefault(po,[]).append(nm)
for po,names in po_groups.items():
    for i in range(len(names)):
        for j in range(i+1,len(names)): G.add_edge(names[i],names[j])
# also exact-name derivatives already same node; connected components:
comp=list(nx.connected_components(G))
comp.sort(key=lambda c: sum(len(name_parcels.get(n,[])) for n in c), reverse=True)

# --- Regrid for property address + lat/lon by parcelid->parid ---
rg=pd.read_csv(REGRID,usecols=['parid','address','lat','lon'],dtype=str).fillna('')
rg['pk']=pd.to_numeric(rg['parid'],errors='coerce').astype('Int64').astype(str)
rgmap=rg.drop_duplicates('pk').set_index('pk')[['address','lat','lon']].to_dict('index')
def pk(x):
    try: return str(int(float(x)))
    except: return str(x)

clusters=[]; leaderboard=[]
for cid,names in enumerate(comp,1):
    names=list(names)
    pids=sorted({p for n in names for p in name_parcels.get(n,[])})
    if len(pids)<2 and len(names)<2: continue
    ras=sorted({sos[n]['ra'] for n in names if n in sos and sos[n]['ra']})
    pos=sorted({sos[n]['po'] for n in names if n in sos and sos[n]['po']})
    statuses=[sos[n]['status'] for n in names if n in sos and sos[n]['status']]
    formeds=[sos[n]['formed'] for n in names if n in sos and sos[n]['formed']]
    brands=[name_brand[n] for n in names if name_brand.get(n) and name_brand[n]!='nan']
    canon=max(names,key=lambda n:len(name_parcels.get(n,[])))
    parcels=[]
    for p in pids[:2000]:
        info=rgmap.get(pk(p),{})
        parcels.append(dict(parcel_id=p,address=info.get('address',''),lat=info.get('lat',''),lon=info.get('lon','')))
    rec=dict(cluster_id=cid, name=name_raw.get(canon,canon),
        entity_count=len(names), parcel_count=len(pids),
        owner_names=[name_raw.get(n,n) for n in sorted(names)],
        registered_agents=ras, principal_offices=pos,
        primary_sos_status=Counter(statuses).most_common(1)[0][0] if statuses else '',
        primary_foreign_state=Counter(formeds).most_common(1)[0][0] if formeds else '',
        brand=Counter(brands).most_common(1)[0][0] if brands else '',
        opencorporates=opencorporates_url(name_raw.get(canon,canon), formeds[0] if formeds else None),
        parcels=parcels)
    json.dump(rec, open(f"{OUTD}/{cid}.json","w"))
    clusters.append(rec)
    leaderboard.append({k:rec[k] for k in ['cluster_id','name','entity_count','parcel_count','primary_sos_status','primary_foreign_state','brand','principal_offices']})

leaderboard.sort(key=lambda r:r['parcel_count'],reverse=True)
json.dump(leaderboard, open(f"{OUTD}/_leaderboard.json","w"))
print("clusters emitted:",len(clusters))
print("multi-entity clusters (de-fragmented):",sum(1 for c in clusters if c['entity_count']>1))
print()
print("=== TOP 12 clusters ===")
for r in leaderboard[:12]:
    print(f"  #{r['cluster_id']:>4} {r['name'][:38]:38} | entities {r['entity_count']:>3} | parcels {r['parcel_count']:>4} | {r['principal_offices'][0][:34] if r['principal_offices'] else '(no SOS)'}")
print("OUTD ->",OUTD)
