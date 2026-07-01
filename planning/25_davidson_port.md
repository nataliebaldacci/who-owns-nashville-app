# Planning: Davidson County (Nashville) Port

**Created:** 2026-06-30
**Goal:** Adapt the who-owns-atlanta pipeline to Metro Nashville / Davidson County — a single county, TN Secretary of State (no bulk officer data; use principal-office-address as the shell-linking bridge).

## Key differences from Atlanta
- **Single county** (Davidson) — the two-county Fulton/DeKalb UNION collapses to one arm.
- **TN SOS has no bulk officer/registered-agent download.** Substitute = per-entity `principal_office_address` scraped from TNBear (`TN_Bus_Lookup/_scraper/`, passes Cloudflare via persistent Chrome profile). Commercial RAs (CT Corp/CSC) filtered by name.
- **Parcel source** = Regrid-enriched Davidson CSV (owner + mailing + usedesc + homestead + ParID/APN). Point lat/lon only — polygon geometry joined later from a cadastral GeoJSON on ParID for the map/tiles.
- **No Accela** — drop `06*`; Nashville has richer landlord-registration + ePermits + CALLR data already.

## Status

| Script | Status | Notes |
|---|---|---|
| `web/frontend/data/datasources.json` | ✅ done | Davidson parcels + TNSOS lookup entries |
| `scripts/01_load_parcels.py` | ✅ done | Single county, loads Regrid CSV → `davidson_parcels` |
| `scripts/utils.py` `create_unified_view` | ✅ done | Davidson column mapping; DB = `who_owns_nashville` |
| `scripts/02_flag_corporate_owners.py` | ▫️ TODO | Rename tables → `davidson_parcels`; swap GA land-use codes + TN institutions (Metro Nashville, TVA, NES, TN universities). Corporate regex reusable. |
| `scripts/03_normalize_addresses.py` | ▫️ TODO | Rename tables → `davidson_parcels`. Keep libpostal service. |
| `scripts/04_ownership_network.py` | ✅ likely as-is | Reads `parcels_unified` — county-agnostic. Verify homestead/entropy logic. |
| `scripts/07_load_sos.py` + `08_match_sos.py` | ▫️ TODO | Replace GA TSV loader with the TNBear CSV (`TNSOS_Resolved_2026-06-30.csv`); match owner name → SOS entity by name; add **principal-office-address** edge (in place of officer edges). |
| `scripts/10_sos_network_enrichment.py` | ▫️ adapt | Keep RA-address + principal-office edges; drop officer edges (no TN officer data). Keep false-merge guards (STREET_ENTITY_LIMIT, builder-buyer, address-hub). |
| `scripts/10b_cluster_refinement.py` | ✅ likely as-is | Fusion/fission on `owner_entities`. |
| Infra (Docker PostGIS `who_owns_nashville`, libpostal) | ▫️ TODO | Stand up before running 01. |

## Column mapping (Regrid → canonical)
parid→parcel_id · owner→owner_name · owner2→owner_name2 · address→site_address · mailadd→owner_address · mail_city/state2/zip→owner_city_state_zip · usecode→property_class · usedesc→land_use · landassd→appraised_value · homestead_exemption(+mail_zip=szip5)→has_homestead · lat/lon (no polygon yet).

## Next actions
1. Adapt `02` + `03` table names + TN institution list.
2. Stand up Docker PostGIS (`who_owns_nashville`) + libpostal.
3. Run `01` → `04`, sanity-check clusters vs the seeded HH resolver (91.8% brand agreement) and the TNSOS principal-office links.
4. Adapt `07`/`08` to the TNBear CSV once the scrape has enough operators.
