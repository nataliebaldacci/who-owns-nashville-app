"""
Horizontal Holdings (Shelton & Seymour 2024) — faithful port of who-owns-atlanta's
04_ownership_network.py, run on Davidson County. Uses THEIR real utils_clustering
(normalize_street, is_builder, is_commercial_ra, ra_key, entropy/street limits,
ADDRESS_STREET_BLOCKLIST, JUNK_NAME_BLOCKLIST, COMMERCIAL_RA_SUBSTRINGS).

Steps (per the paper):
 1 Owner Matching        -> name edges (shared normalized owner name)
 2 Owner Derivatives     -> name-entropy filter (corp<=100 addrs, indiv<=5), junk blocklist
 3 Address Matching      -> address edges (shared normalized mailing address)
 4 Address Derivatives   -> normalize_street + city/zip + junk gating
 5 Owner Deriv. Matching -> connected components merge across name+address+SOS edges
 6 Corp Registration     -> SOS edges (shared registered agent / principal office, non-commercial)
"""
import sys, re, json
import pandas as pd, networkx as nx
from collections import defaultdict, Counter

SCR='/Users/nataliebaldacci/Master_Data/Nashville/who-owns-nashville/scripts'
sys.path.insert(0, SCR)
from utils_clustering import (normalize_street, is_builder, is_commercial_ra, ra_key,
    NAME_ENTROPY_LIMIT, INDIVIDUAL_NAME_ENTROPY_LIMIT, JUNK_NAME_BLOCKLIST,
    STREET_ENTITY_LIMIT, ADDRESS_STREET_BLOCKLIST)

# --- their 02_flag_corporate_owners patterns (Postgres \m\M -> \b) ---
CORP = re.compile(r'\b(l\s*l\s*c|l\s*l\s*l\s*p|l\s*l\s*p|l\s*p|inc|corp|corporation|ltd|limited|assoc|assn|association|foundation|company|co\.|system|plan|p\s*c|venture|ventures|invest|investments|investors|partners|partnership|holdings|holding|enterprises|enterprise|properties|property|realty|real\s+estate|management|mgmt|development|group)\b', re.I)
STRONG = re.compile(r'(city\s+of|county|state\s+of|united\s+states|board\s+of\s+(education|regents)|department\s+of|dept\s+of|\b(authority|housing\s+authority)\b|college|university|school\s+district|school\s+system|railway|railroad)', re.I)
MEDIUM = re.compile(r'(homeowner|homeowners|h\s*o\s*a|community\s+associat|owners\s+associat|associat|condo|condominium|townhouse|towne\s+house)', re.I)
WEAK   = re.compile(r'(\b(trust|trustee|estate\s+of)\b|\b(ministry|ministries|congregation|diocese|temple|mosque|synagogue)\b|church|salvation\s+army|habitat\s+for\s+humanity|cemetery)', re.I)
CITY_ZIP_ONLY = re.compile(r'^[A-Z]+(\s+[A-Z]+)*\s+[A-Z]{2}\s+\d{5}(-\d+)?$')
U = lambda s: re.sub(r'\s+',' ',re.sub(r'[^A-Z0-9 ]',' ',str(s).upper())).strip()

def name_norm(n):
    n=U(n)
    if ' & ' in n:  # co-owner order normalization (their SQL does this)
        n=' & '.join(sorted(p.strip() for p in n.split(' & ')))
    return n
def flags(nm):
    strong=bool(STRONG.search(nm)); corp=bool(CORP.search(nm)); med=bool(MEDIUM.search(nm)); weak=bool(WEAK.search(nm))
    is_corp = corp and not strong
    is_inst = strong or med or (weak and not corp)
    return is_corp, is_inst
def is_junk_addr(a):
    if not a: return True
    return bool(re.match(r'^[.#\s?0-9]+$', a)) and len(a.strip())<8

# ---------------- load current-holdings owners ----------------
PARQ='/Users/nataliebaldacci/Master_Data/Nashville/00_ORGANIZED/08_Reference_Library/Data_Analysis/Ownership/ownership_history_WithOperatorCrosswalk_2026-06-18.parquet'
import pyarrow.parquet as pq
df=pq.ParquetFile(PARQ).read(columns=['parcelid','owner_clean','address1','city','StateCode','PostalCode','Status','parent_company']).to_pandas().fillna('')
df=df[df['Status'].astype(str).str.upper()=='ACTIVE'].copy()
def pk(x):
    try: return str(int(float(x)))
    except: return str(x).strip()
df['parcelid']=df['parcelid'].map(pk)
df['nm']=df['owner_clean'].map(name_norm)
df=df[df['nm'].str.strip()!='']
df['addr']=(df['address1'].map(U)+' '+df['city'].map(U)+' '+df['StateCode'].map(U)+' '+df['PostalCode'].astype(str).str.replace(r'[^0-9]','',regex=True).str[:5]).str.strip()
print(f'current-holdings owner rows: {len(df):,}')

# ---------------- owner entities = distinct (name, addr) ----------------
ent={}  # (nm,addr) -> dict
for _,r in df.iterrows():
    k=(r['nm'], r['addr'])
    e=ent.get(k)
    if not e:
        ic,ii=flags(r['nm'])
        e=ent[k]={'nm':r['nm'],'addr':r['addr'],'corp':ic,'inst':ii,'pids':set(),'brand':r['parent_company']}
    e['pids'].add(r['parcelid'])
    if r['parent_company'] and not e['brand']: e['brand']=r['parent_company']
eids=list(ent.values())
for i,e in enumerate(eids): e['id']=i
print(f'distinct owner entities: {len(eids):,}')

# ---------------- graph ----------------
G=nx.Graph(); [G.add_node(e['id']) for e in eids]
name_idx=defaultdict(list); addr_idx=defaultdict(list); street_counts=Counter()
name_addrs=defaultdict(set)
for e in eids:
    name_addrs[e['nm']].add(e['addr'])
    if e['inst']: continue                       # don't bridge through institutions
    name_idx[e['nm']].append(e['id'])
    if e['addr']:
        addr_idx[e['addr']].append(e['id'])
        st=normalize_street(e['addr'])
        if st: street_counts[st]+=1
name_entropy={n:len(a) for n,a in name_addrs.items()}
byid={e['id']:e for e in eids}

# 1+2 NAME edges (entropy + blocklist)
sn=0
for nm,ids in name_idx.items():
    if nm in JUNK_NAME_BLOCKLIST or any(nm.startswith(j+' ') for j in JUNK_NAME_BLOCKLIST): continue
    is_corp_name=any(byid[i]['corp'] for i in ids)
    limit=NAME_ENTROPY_LIMIT if is_corp_name else INDIVIDUAL_NAME_ENTROPY_LIMIT
    if name_entropy.get(nm,0)>limit: sn+=1; continue
    for i in range(len(ids)):
        for j in range(i+1,len(ids)): G.add_edge(ids[i],ids[j],rel='name')
# 3+4 ADDRESS edges (city/zip, junk, blocklist, street limit, builder heuristic)
sa=0
for addr,ids in addr_idx.items():
    if CITY_ZIP_ONLY.match(addr): sa+=1; continue
    if is_junk_addr(addr): sa+=1; continue
    st=normalize_street(addr)
    if any(st.upper().startswith(b) for b in ADDRESS_STREET_BLOCKLIST): sa+=1; continue
    if street_counts.get(st,0)>STREET_ENTITY_LIMIT: sa+=1; continue
    if any(is_builder(byid[i]['nm']) for i in ids) and len(ids)>=5: sa+=1; continue
    for i in range(len(ids)):
        for j in range(i+1,len(ids)): G.add_edge(ids[i],ids[j],rel='addr')

# 6 SOS registration edges (shared registered agent / principal office, non-commercial)
TNSOS='/Users/nataliebaldacci/Master_Data/Nashville/TN_Bus_Lookup/_scraper/TNSOS_Resolved_2026-06-30.csv'
sos=pd.read_csv(TNSOS,dtype=str).fillna('')
nm2id=defaultdict(list)
for e in eids:
    if not e['inst']: nm2id[e['nm']].append(e['id'])
ra_groups=defaultdict(list); po_groups=defaultdict(list)
for _,r in sos.iterrows():
    nn=name_norm(r['input_owner'])
    if nn not in nm2id: continue
    ra=r['registered_agent_name']; po=r['principal_office_address']
    for i in nm2id[nn]:
        if ra and not is_commercial_ra(ra): ra_groups[ra_key(ra,r['registered_agent_address'])].append(i)
        if po and not is_commercial_ra(po): po_groups[U(po)].append(i)
ns=0
for grp in list(ra_groups.values())+list(po_groups.values()):
    u=list(set(grp))
    if len(u)>1 and len(u)<=STREET_ENTITY_LIMIT:
        for i in range(1,len(u)): G.add_edge(u[0],u[i],rel='sos'); ns+=1

print(f'edges: name-skip {sn}, addr-skip {sa}, sos-edges {ns} | graph {G.number_of_nodes():,} nodes / {G.number_of_edges():,} edges')

# ---------------- connected components ----------------
comp=list(nx.connected_components(G))
comp.sort(key=lambda c: sum(len(byid[i]['pids']) for i in c), reverse=True)
print(f'clusters: {len(comp):,}')

rows=[]
for cid,c in enumerate(comp,1):
    members=[byid[i] for i in c]
    pids=set(); [pids.update(m['pids']) for m in members]
    names=sorted({m['nm'] for m in members})
    brands=[m['brand'] for m in members if m['brand']]
    canon=max(members,key=lambda m:len(m['pids']))['nm']
    rows.append({'cluster_id':cid,'primary_name':canon,'n_entities':len(members),
                 'parcels':len(pids),'brand':Counter(brands).most_common(1)[0][0] if brands else '',
                 'all_names':' | '.join(names)})
out='/Users/nataliebaldacci/Master_Data/Nashville/who-owns-nashville/hh_nashville/HH_Davidson_Clusters_2026-07-01.csv'
pd.DataFrame(rows).to_csv(out,index=False)
print('wrote',out)
print('\n=== TOP 20 clusters (Horizontal Holdings method) ===')
for r in rows[:20]:
    print(f"  {r['parcels']:>5}  {r['primary_name'][:34]:34} [{r['n_entities']} ent] {r['brand']}")
