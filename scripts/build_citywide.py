#!/usr/bin/env python3
"""Build citywide parcel layers for the map:
  citywide_base.json  -- ALL residential parcels (packed arrays) = faint gray base
  citywide_corp.json  -- corporate/clustered parcels, colored by brand, linked to owner pages
Base geometry from Regrid (parid->lat/lon); APN/account from Comper master.
Corporate layer reconstructed from the owner cluster JSONs already built.
"""
import json, glob, os
import pandas as pd

ROOT = "/Users/nataliebaldacci/Master_Data/Nashville"
OUT  = f"{ROOT}/who-owns-nashville/web/frontend/data"
REGRID = f"{ROOT}/00_ORGANIZED/08_Reference_Library/Favorite_Data_Sets/Parcels_Enriched/Regrid_Parcels_Nashville.csv"
COMPER = f"{ROOT}/00_ORGANIZED/08_Reference_Library/Favorite_Data_Sets/Comper_Pull_AllResidential_2026-06-29/Comper_County_MASTER_Enriched_WithOwnership_2026-06-30.csv"

def pk(x):
    try: return str(int(float(x)))
    except: return ""
def apn11(a):
    a = "".join(ch for ch in str(a) if ch.isalnum())
    return a.zfill(11) if a.isdigit() else a

# --- Regrid: parid -> lat/lon (the geometry spine) ---
print("Loading Regrid geometry...")
rg = pd.read_csv(REGRID, usecols=['parid','lat','lon'], dtype=str).fillna('')
rg['k'] = rg['parid'].map(pk)
rg = rg[(rg.lat!='') & (rg.lon!='')].drop_duplicates('k')
geo = rg.set_index('k')[['lat','lon']].to_dict('index')
print(f"  {len(geo):,} parcels with coords")

# --- Comper: parid -> APN, account_number (residential universe) ---
print("Loading Comper APN/account...")
cp = pd.read_csv(COMPER, usecols=['ParID','APN','STANPAR','AccountNumber'], dtype=str).fillna('')
cp['k'] = cp['ParID'].map(pk)
cp = cp.drop_duplicates('k')
cmap = {}
for _, r in cp.iterrows():
    cmap[r['k']] = (apn11(r['APN'] or r['STANPAR']), (r['AccountNumber'] or '').strip())
print(f"  {len(cmap):,} residential parcels")

# --- Base layer: every residential parcel that has coords ---
lat=[]; lon=[]; apn=[]; parid=[]; acct=[]
for k,(a,ac) in cmap.items():
    g = geo.get(k)
    if not g: continue
    lat.append(round(float(g['lat']),6)); lon.append(round(float(g['lon']),6))
    apn.append(a); parid.append(k); acct.append(ac)
base = {"lat":lat,"lon":lon,"apn":apn,"parid":parid,"acct":acct}
json.dump(base, open(f"{OUT}/citywide_base.json","w"), separators=(',',':'))
print(f"citywide_base.json: {len(lat):,} parcels")

# --- Corporate layer from owner cluster JSONs ---
BRAND_COLOR = {
    "Pretium Partners":"#e07a33","American Homes 4 Rent (NYSE: AMH)":"#1f3a5f",
    "Amherst Group":"#4f9c9a","Invitation Homes (NYSE: INVH)":"#cf307a",
    "Tricon Residential (Blackstone)":"#5b9d43","Starwood Capital Group":"#6ba3d6",
    "VineBrook Homes (NexPoint)":"#8c510a","FirstKey Homes (Cerberus)":"#134e4e",
    "Rithm Capital":"#9b2a23","Home Partners of America (Blackstone)":"#b07aa1",
    "Brookfield/Nuveen (Conrex)":"#7f6000",
    "Beazer Homes USA (NYSE: BZH)":"#9c8a6b","Meritage Homes Corp. (NYSE: MTH)":"#b3a07a",
    "PulteGroup (NYSE: PHM)":"#8a7d5a","Lennar Corp. (NYSE: LEN)":"#a89968",
    "NVR, Inc. (NYSE: NVR)":"#c2b280","D.R. Horton (NYSE: DHI)":"#7d7355",
}
UNBRANDED = "#8f9aa6"

fs=[f for f in glob.glob(f"{OUT}/owners/*.json") if "_leaderboard" not in f]
corp=[]; brand_counts={}
for f in fs:
    d=json.load(open(f))
    cid=d.get("cluster_id"); brand=(d.get("brand") or "").strip()
    color=BRAND_COLOR.get(brand, UNBRANDED)
    owner=d.get("name","")
    for p in d["parcels"]:
        if not (p.get("lat") and p.get("lon")): continue
        corp.append([round(float(p["lat"]),6), round(float(p["lon"]),6),
                     p.get("apn",""), p.get("parcel_id",""), p.get("account_number",""),
                     color, cid, brand or "Other corporate", owner])
    b = brand if brand in BRAND_COLOR else "Other corporate"
    brand_counts[b]=brand_counts.get(b,0)+len([1 for p in d["parcels"] if p.get("lat")])
# legend: known brands (by size) then Other corporate
legend=[{"brand":b,"color":BRAND_COLOR.get(b,UNBRANDED),"n":brand_counts.get(b,0)}
        for b in sorted(BRAND_COLOR, key=lambda x:-brand_counts.get(x,0)) if brand_counts.get(b,0)]
legend.append({"brand":"Other corporate","color":UNBRANDED,"n":brand_counts.get("Other corporate",0)})
json.dump({"cols":["lat","lon","apn","parid","acct","color","cid","brand","owner"],
           "rows":corp,"legend":legend},
          open(f"{OUT}/citywide_corp.json","w"), separators=(',',':'))
print(f"citywide_corp.json: {len(corp):,} corporate parcels, {len(legend)} legend rows")
print("Base file MB:", round(os.path.getsize(f'{OUT}/citywide_base.json')/1e6,1),
      "| Corp file MB:", round(os.path.getsize(f'{OUT}/citywide_corp.json')/1e6,1))
