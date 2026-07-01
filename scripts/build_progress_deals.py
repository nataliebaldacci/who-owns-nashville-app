#!/usr/bin/env python3
"""Progress Residential securitization timeline — the parcels actually recorded to each
deal's Deed of Trust at the time, from Borrower_Ownership_History (real DateAcquired).
Grouped by deal (vintage/borrower), in true chronological order. Feeds progress_deals.html."""
import pandas as pd, re, json
ROOT="/Users/nataliebaldacci/Master_Data/Nashville"
X=f"{ROOT}/00_ORGANIZED/04_Who_Finances/Nashville_SFR_Securitization_MASTER_DEALSHEET.xlsx"
BASE=f"{ROOT}/who-owns-nashville/web/frontend/data/citywide_base.json"
COMPER=f"{ROOT}/00_ORGANIZED/08_Reference_Library/Favorite_Data_Sets/Comper_Pull_AllResidential_2026-06-29/Comper_County_MASTER_Enriched_WithOwnership_2026-06-30.csv"
OUT=f"{ROOT}/who-owns-nashville/web/frontend/data/progress_deals.json"

def pk(x):
    try: return str(int(float(x)))
    except: return ""

# parcelid -> lat/lon and parcelid -> APN
b=json.load(open(BASE)); geo={}; apnmap={}
for i in range(len(b["parid"])):
    geo[b["parid"][i]]=(b["lat"][i],b["lon"][i]); apnmap[b["parid"][i]]=b["apn"][i]
# parcelid -> appraised value + address
_want={"ParID","MarketValue","address","Address"}
cp=pd.read_csv(COMPER,usecols=lambda c:c in _want,dtype=str)
cp["k"]=cp["ParID"].map(pk); cp=cp.drop_duplicates("k")
val={}; addr={}
for _,r in cp.iterrows():
    val[r["k"]]=r.get("MarketValue"); addr[r["k"]]=(r.get("address") or r.get("Address") or "")

boh=pd.read_excel(X,sheet_name="Borrower_Ownership_History")
prog=boh[boh["name"].str.contains("PROGRESS|PR BORROWER",case=False,na=False)].copy()
def lab(n):
    m=re.search(r"(20\d\d-\d)",str(n).upper());  # vintage e.g. 2015-2
    if m: return m.group(1)
    m=re.search(r"BORROWER[S]?\s*(\d+)",str(n).upper())
    return "Borrower "+m.group(1) if m else None
def dnum(n):
    m=re.search(r"BORROWER[S]?\s*(\d+)",str(n).upper()); return int(m.group(1)) if m else None
prog["deal"]=prog["name"].map(lab)
prog["dt"]=pd.to_datetime(prog["DateAcquired"],errors="coerce")
prog["pk"]=prog["parcelid"].map(pk)
prog=prog.dropna(subset=["deal","dt"])

# per-deal median tract profile (by borrower number) from the dealsheet
prof=pd.read_excel(X,sheet_name="Per_Deal_Profiles"); prof["dn"]=prof["borrower_norm"].map(dnum)
def pv(r,c):
    v=r.get(c); return None if pd.isna(v) else (int(round(v)) if abs(v)>=100 else round(float(v),1))
pmap={int(r["dn"]):{"med_tract_income":pv(r,"median_tract_household_income"),
     "med_tract_home_value":pv(r,"median_tract_home_value"),"pct_cost_burden":pv(r,"median_tract_pct_renter_cost_burdened"),
     "pct_renter":pv(r,"median_tract_pct_renter"),"med_year_built":pv(r,"median_year_built")}
     for _,r in prof.dropna(subset=["dn"]).iterrows()}

# loan amount / lender / trustee / Davidson collateral per DOT from Bundles_LoanAmounts
bl=pd.read_excel(X,sheet_name="Bundles_LoanAmounts")
bl=bl[bl["Grantor"].str.contains("PROGRESS|PR BORROWER",case=False,na=False)].copy()
bl["dt"]=pd.to_datetime(bl["Rec_Date"],errors="coerce")
def lender_of(grantee):
    parts=[p.strip() for p in str(grantee).replace("\\n","\n").split("\n") if p.strip()]
    lend=trust=""
    for p in parts:
        (lend:=lend or p) if "TRUSTEE" not in p.upper() else (trust:=trust or p)
    return lend, trust.replace(" TRUSTEE","").strip()
bl["dnum"]=bl["Grantor"].map(dnum)
def vint(n):
    m=re.search(r"(20\d\d)[- ](?:SFR)?\s*(\d)",str(n).upper()); return f"{m.group(1)}-{m.group(2)}" if m else None
bl["vint"]=bl["Grantor"].map(vint)
def best_loan(deal_label, first_dt):
    # candidate DOTs for this deal, pick the one recorded nearest the first acquisition date
    if deal_label.startswith("20"):
        cand=bl[bl["vint"]==deal_label]
    else:
        dn=dnum(deal_label); cand=bl[bl["dnum"]==dn]
    if cand.empty: return {}
    cand=cand.assign(gap=(cand["dt"]-first_dt).abs()).sort_values("gap")
    r=cand.iloc[0]; L,T=lender_of(r["Grantee"])
    def num(x):
        try: return int(float(x))
        except: return None
    return {"loan_amount":num(r["max_principal_indebtedness"]),
            "tn_collateral":num(r["tn_collateral_value"]),
            "total_collateral":num(r["total_collateral_value"]),
            "davidson_share":(None if pd.isna(r["davidson_share"]) else round(float(r["davidson_share"])*100,1)),
            "lender":L,"trustee":T,"deal_name":str(r["inferred_deal_name"]),
            "dot_rec_date":(r["dt"].strftime("%b %Y") if pd.notna(r["dt"]) else ""),
            "instrument":str(r["instrument"]),
            "url_kbra":(None if pd.isna(r["url_kbra"]) else str(r["url_kbra"]))}

# deal order by first recording date
order=prog.groupby("deal")["dt"].min().sort_values()
parcels=[]  # [lat,lon,deal_idx,date,value,address]
deals=[]
for di,(deal,first) in enumerate(order.items()):
    g=prog[prog["deal"]==deal]
    tot=0
    for _,r in g.iterrows():
        c=geo.get(r["pk"])
        if not c: continue
        v=val.get(r["pk"]);
        try: v=int(float(v))
        except: v=None
        if v: tot+=v
        parcels.append([round(c[0],6),round(c[1],6),di,r["dt"].strftime("%b %Y"),v,addr.get(r["pk"],""),
                        apnmap.get(r["pk"],""), str(r.get("Instrument","") or "").strip(), str(r.get("url","") or "").strip()])
    e={"idx":di,"deal":deal,"date":first.strftime("%b %Y"),
       "iso":first.strftime("%Y-%m"),"n":int(len(g)),"appraised_total":tot}
    e.update(pmap.get(dnum(deal) or -1,{}))
    e.update(best_loan(deal,first))
    deals.append(e)

json.dump({"cols":["lat","lon","deal_idx","date","value","address","apn","instrument","deed_url"],
           "parcels":parcels,"deals":deals,"total":len(parcels),"n_deals":len(deals)},
          open(OUT,"w"),separators=(",",":"))
print(f"progress_deals.json: {len(parcels)} parcels, {len(deals)} deals ({deals[0]['date']} -> {deals[-1]['date']})")
