"""External-registry link builders for owner names (OpenCorporates, etc.).

OpenCorporates aggregates state business registrations and often exposes officers
that Tennessee's own TNBear portal will not — a free complement to the SOS scrape.
Used in owner-profile pages and map popups.
"""
from urllib.parse import quote_plus

# map SOS "formed_in" values -> OpenCorporates US jurisdiction codes
_JURIS = {
    "TENNESSEE": "us_tn", "TN": "us_tn",
    "DELAWARE": "us_de", "DE": "us_de",
    "GEORGIA": "us_ga", "NEVADA": "us_nv", "MARYLAND": "us_md",
    "TEXAS": "us_tx", "CALIFORNIA": "us_ca", "ARIZONA": "us_az",
    "FLORIDA": "us_fl", "NEW YORK": "us_ny",
}


def opencorporates_url(name, formed_in=None):
    """Deep link to an OpenCorporates search for an owner name.

    If formed_in maps to a known US jurisdiction, scope to it (e.g. us_de for a
    Delaware LLC); otherwise search all jurisdictions.
    """
    if not name:
        return ""
    q = quote_plus(str(name).strip())
    juris = _JURIS.get(str(formed_in).strip().upper()) if formed_in else None
    if juris:
        return f"https://opencorporates.com/companies/{juris}?q={q}&utf8=%E2%9C%93"
    return f"https://opencorporates.com/companies?q={q}&utf8=%E2%9C%93"


def tnbear_search_url():
    """TNBear has no deep-link search URL (encrypted session token); return the portal."""
    return "https://tncab.tnsos.gov/portal/business-entity-search"
