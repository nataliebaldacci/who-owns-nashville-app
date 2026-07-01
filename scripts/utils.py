from sqlalchemy import create_engine, text
import subprocess

DB_URL = "postgresql://woa:woa@localhost:5434/who_owns_nashville"


def create_unified_view(engine, refresh_mviews=False):
    """Create a unified parcels view for Davidson County (single-county port).

    Maps the Regrid Davidson parcel columns to the canonical field names the rest of
    the pipeline (02 flag, 03 normalize, 04 cluster) expects. Residential filter uses
    Regrid `usedesc` (Davidson has no Fulton/DeKalb class codes).

    Owner-occupancy proxy: Davidson has homestead via `homestead_exemption`; where absent,
    the OwnZip != PropZip heuristic (mail_zip vs szip5) also flags non-owner-occupied.
    """
    print("Creating unified parcels view (Davidson, residential focus)...")
    with engine.begin() as conn:
        # Ensure owner_addr_norm exists so the view doesn't fail if normalization hasn't run
        conn.execute(text("ALTER TABLE davidson_parcels ADD COLUMN IF NOT EXISTS owner_addr_norm TEXT;"))
        conn.execute(text("ALTER TABLE davidson_parcels ADD COLUMN IF NOT EXISTS is_corporate BOOLEAN;"))
        conn.execute(text("ALTER TABLE davidson_parcels ADD COLUMN IF NOT EXISTS is_institutional BOOLEAN;"))

        conn.execute(text("DROP VIEW IF EXISTS parcels_unified CASCADE;"))
        conn.execute(text("""
            CREATE VIEW parcels_unified AS
            SELECT
                'davidson' AS county,
                parid AS parcel_id,
                owner AS owner_name,
                owner2 AS owner_name2,
                address AS site_address,
                mailadd AS owner_address,
                TRIM(BOTH ', ' FROM CONCAT_WS(', ', mail_city,
                     CONCAT_WS(' ', mail_state2, mail_zip))) AS owner_city_state_zip,
                owner_addr_norm,
                usecode AS property_class,
                usedesc AS land_use,
                NULL::int AS living_units,
                NULL::numeric AS land_acres,
                NULLIF(landassd, '')::numeric AS appraised_value,
                NULL AS tax_district,
                NULL AS neighborhood_code,
                NULL AS subdivision,
                is_corporate,
                is_institutional,
                (usedesc ILIKE '%%CONDO%%')::int AS is_condo_potential,
                CASE
                    WHEN usedesc ILIKE '%%SINGLE FAMILY%%' OR usedesc ILIKE '%%SINGLE-FAMILY%%' THEN 'Single-Family'
                    WHEN usedesc ILIKE '%%DUPLEX%%' OR usedesc ILIKE '%%ZERO LOT%%' THEN 'Single-Family'
                    WHEN usedesc ILIKE '%%CONDO%%' OR usedesc ILIKE '%%TOWNHOUSE%%' OR usedesc ILIKE '%%APARTMENT%%'
                         OR usedesc ILIKE '%%MULTI%%' OR usedesc ILIKE '%%TRIPLEX%%' OR usedesc ILIKE '%%QUAD%%' THEN 'Multi-Family / Condo'
                    ELSE 'Other'
                END AS home_type,
                NULL AS city_neighborhood,
                NULL AS city_npu,
                NULL AS city_council,
                NULL AS city_zoning,
                (homestead_exemption IS NOT NULL AND homestead_exemption <> ''
                 AND (mail_zip IS NULL OR szip5 IS NULL OR mail_zip = szip5)) AS has_homestead,
                lat, lon
            FROM davidson_parcels
            -- Residential filter uses the official Davidson use codes (Metro ParcelViewer
            -- GetUseCodes). Regrid stores them without leading zeros, so match on int form.
            -- 10 vacant-res, 11/81 single-family, 12/82 duplex, 13 triplex, 15/86 condo,
            -- 16 zero-lot, 17 dorm, 18/88 mobile home, 19 res-combo, 30 vacant-multi,
            -- 37/38/39 apartment, 62 mobile-home-park.
            WHERE NULLIF(usecode, '')::int IN
                (10, 11, 12, 13, 15, 16, 17, 18, 19, 30, 37, 38, 39, 62, 81, 82, 86, 88)
        """))
    print("  Created parcels_unified view")

    if refresh_mviews:
        print("\nRefreshing materialized views (required after view cascade)...")
        try:
            import os
            cmd = [
                "psql", "-h", "localhost", "-p", "5434", "-U", "woa", "-d", "who_owns_nashville",
                "-f", "scripts/sql/04_create_materialized_views.sql",
            ]
            env = os.environ.copy()
            env["PGPASSWORD"] = "woa"
            subprocess.run(cmd, env=env, check=True)
            print("  Materialized views refreshed.")
        except Exception as e:
            print(f"  Error refreshing materialized views: {e}")
