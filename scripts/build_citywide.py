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
UNBRANDED = "#c2c8d0"
# Keyword-based canonicalization: robust to the cluster builder's shifting brand strings.
# Each rule: (keywords, canonical name, type, color). First match wins.
CANON_RULES = [
    # LANDLORDS — Security-for-Sale (McClatchy) palette + coordinated soft extensions
    (("pretium","progress"),               "Progress Residential",   "Landlord","#ffa4b1"),  # SfS soft pink
    (("american homes 4 rent","amh"),      "American Homes 4 Rent",  "Landlord","#2c719f"),  # SfS steel blue
    (("amherst","main street renewal"),    "Amherst Residential",    "Landlord","#8dcaf0"),  # SfS light blue
    (("invitation",),                      "Invitation Homes",       "Landlord","#cf307a"),  # SfS magenta
    (("tricon","tenax dpi"),               "Tricon Residential",     "Landlord","#8ce38f"),  # SfS mint
    (("firstkey","fkh"),                   "FirstKey Homes",         "Landlord","#1f8166"),  # SfS deep teal
    (("starwood","star 20","sfr jv"),      "Starwood Capital Group", "Landlord","#b39ddb"),  # soft lavender
    (("vinebrook","vb tah"),               "VineBrook Homes",        "Landlord","#f2b06a"),  # soft amber
    (("rithm","new residential","nrz"),    "Rithm Capital",          "Landlord","#d93a4c"),  # SfS accent red
    (("maymont","conrex","brookfield/nuveen"), "Maymont Homes",      "Landlord","#a3c586"),  # soft olive
    (("home partners",),                   "Home Partners of America","Landlord","#c99bc4"), # soft orchid
    (("bluerock",),                        "Bluerock Homes",         "Landlord","#e8896b"),  # soft coral
    # iBUYERS — cool
    (("homeward",),                        "Homeward",               "iBuyer","#c99bc4"),
    (("opendoor",),                        "Opendoor",               "iBuyer","#6fc3bd"),
    (("zillow",),                          "Zillow Offers",          "iBuyer","#9db8e0"),
    (("offerpad",),                        "Offerpad",               "iBuyer","#f2c078"),
    # BUILDERS — muted tan (recede vs landlords)
    (("meritage",),                        "Meritage Homes",         "Builder","#cdbb94"),
    (("pulte","centex"),                   "PulteGroup",             "Builder","#9b8a63"),
    (("horton","regent"),                  "D.R. Horton",            "Builder","#b3a67a"),
    (("beazer","zaring"),                  "Beazer Homes",           "Builder","#a8977a"),
    (("lennar",),                          "Lennar",                 "Builder","#c2ad86"),
    (("nvr","ryan homes"),                 "NVR / Ryan Homes",       "Builder","#98aec2"),
    (("ole south",),                       "Ole South",              "Builder","#c7b48f"),
]
EXCLUDE_KEYS = ("freddie","fannie","gse","federal home loan","hud","veterans","secretary of housing")
def canon(brand):
    """Return (name,type,color) or None to drop; ('Other corporate',...) for unmatched."""
    k=(brand or "").lower()
    if any(x in k for x in EXCLUDE_KEYS): return None            # GSEs / gov REO -> off map
    for keys,name,typ,color in CANON_RULES:
        if any(x in k for x in keys): return (name,typ,color)
    return ("Other corporate","Other",UNBRANDED)

fs=[f for f in glob.glob(f"{OUT}/owners/*.json") if "_leaderboard" not in f]
corp=[]; brand_counts={}; brand_meta={}
for f in fs:
    d=json.load(open(f))
    cid=d.get("cluster_id")
    c=canon((d.get("brand") or "").strip())
    if c is None: continue                                      # excluded GSE cluster
    name,typ,color=c; owner=d.get("name","")
    brand_meta[name]=(typ,color)
    for p in d["parcels"]:
        if not (p.get("lat") and p.get("lon")): continue
        corp.append([round(float(p["lat"]),6), round(float(p["lon"]),6),
                     p.get("apn",""), p.get("parcel_id",""), p.get("account_number",""),
                     color, cid, name, owner,
                     p.get("address",""), p.get("market_value"), p.get("beds"), p.get("bath"),
                     p.get("sqft"), p.get("year_built",""), p.get("structure_type",""),
                     p.get("land_use",""), p.get("sale_price"), p.get("sale_date","")])
    brand_counts[name]=brand_counts.get(name,0)+len([1 for p in d["parcels"] if p.get("lat")])
TYPE_ORDER = {"Landlord":0,"Builder":1,"iBuyer":2,"Other":3}
legend=[{"brand":b,"color":brand_meta[b][1],"n":brand_counts[b],"type":brand_meta[b][0]}
        for b in brand_counts if b!="Other corporate"]
legend.sort(key=lambda e:(TYPE_ORDER[e["type"]], -e["n"]))
if brand_counts.get("Other corporate"):
    legend.append({"brand":"Other corporate","color":UNBRANDED,"n":brand_counts["Other corporate"],"type":"Other"})
json.dump({"cols":["lat","lon","apn","parid","acct","color","cid","brand","owner",
                   "address","value","beds","bath","sqft","year_built","structure_type","land_use","sale_price","sale_date"],
           "rows":corp,"legend":legend},
          open(f"{OUT}/citywide_corp.json","w"), separators=(',',':'))
print(f"citywide_corp.json: {len(corp):,} corporate parcels, {len(legend)} legend rows")
print("Base file MB:", round(os.path.getsize(f'{OUT}/citywide_base.json')/1e6,1),
      "| Corp file MB:", round(os.path.getsize(f'{OUT}/citywide_corp.json')/1e6,1))
