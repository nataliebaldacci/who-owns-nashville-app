"""Load Metro Nashville / Davidson County parcels into PostGIS, then create a unified view.

Davidson port of the who-owns-atlanta loader. Single county (was Fulton + DeKalb).
Source is the Regrid-enriched Davidson parcel CSV (owner + mailing address + land use +
homestead + ParID/APN crosswalk). The CSV carries point lat/lon, not polygons; polygon
geometry can be joined later from a Davidson cadastral GeoJSON on ParID for the map/tiles.
"""

import json
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine, text
import argparse
from utils import DB_URL, create_unified_view


def _load_sources():
    root = Path(__file__).resolve().parent.parent
    return json.load(open(root / "web/frontend/data/datasources.json"))


SOURCES = _load_sources()
engine = create_engine(DB_URL)

# Regrid columns we keep (owner + mailing + use + homestead + ids + point geom)
KEEP = [
    "parid", "apn", "stanpar",
    "owner", "owner2", "owner3", "owner4", "owntype",
    "mailadd", "mail_address2", "mail_city", "mail_state2", "mail_zip", "mail_country",
    "address", "szip5",
    "usecode", "usedesc", "lbcs_ownership_desc",
    "homestead_exemption", "landval", "landassd", "last_ownership_transfer_date",
    "lat", "lon",
]


def load_davidson(engine):
    print("Loading Davidson County parcels (Regrid)...")
    path = SOURCES["davidson_parcels"]["file_path"]
    df = pd.read_csv(path, dtype=str, low_memory=False)
    df.columns = [c.lower() for c in df.columns]
    cols = [c for c in KEEP if c in df.columns]
    df = df[cols].copy()
    print(f"  {len(df):,} parcels read, {len(cols)} columns kept")

    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS davidson_parcels CASCADE;"))
    df.to_sql("davidson_parcels", engine, if_exists="replace", index=False, chunksize=10000)
    print("  Loaded into davidson_parcels")


def create_indexes(engine):
    print("Creating indexes...")
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dav_owner ON davidson_parcels (owner);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dav_parid ON davidson_parcels (parid);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dav_apn ON davidson_parcels (apn);"))
    print("  Done")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--create-view", action="store_true", help="ONLY create unified view (requires flags exist)")
    parser.add_argument("--load-only", action="store_true", help="ONLY load raw data and index (skips view)")
    parser.add_argument("--refresh-mviews", action="store_true", help="Recreate materialized views after view update")
    args = parser.parse_args()

    if args.create_view:
        create_unified_view(engine, refresh_mviews=args.refresh_mviews)
    elif args.load_only:
        load_davidson(engine)
        create_indexes(engine)
    else:
        load_davidson(engine)
        create_indexes(engine)
        create_unified_view(engine, refresh_mviews=args.refresh_mviews)
