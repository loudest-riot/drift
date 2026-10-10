# DRIFT // Hines Places catalog

**Canonical data:** `public/data/hines-places.json`  
**Public directory:** `/places.html`  
**Map layer:** MAP OPTIONS → LANDMARKS  
**Compact picker:** PLACES

## Data model

Each item has a stable `id`, `name`, `kind`, `note`, `source` (when available), `area`, and a `position` status:

- `reference`: has a documented or previously curated `lat` and `lng` used for locating the *general place*. It does not certify parking, a public entry route, path access or the precise location of individual facilities.
- `awaiting_verification`: coordinates deliberately omitted. Visitors can find the name and background in the HINES PLACES directory, but there is no misleading pin or directions button.
- `sensitive: true`: cemetery or memorial, reference only. No geocache placements or intrusive access instructions.
- `featured: true`: highlighted in the public directory.

The data includes Wayne County recreation spaces, lakes, nature landmarks, existing memorial references and **Newburgh Lake Public Access** (also called **Newburgh Lake Pointe Public Access** in the visitor field report). This location must **not** be silently merged with Wayne County's **Newburgh Pointe**, **Sumac Pointe**, or the independently documented **Newburgh Lake Public Boat Launch**.

Its public listings match the address supplied by the visitor: **37507–39399 Edward N Hines Dr, Livonia, MI 48150**, a range rather than a single physical entrance. [Atly](https://www.atly.com/location/NewburghLakePublicAccess) and [Sandee](https://sandee.com/united-states/michigan/livonia/newburgh-lake-public-access) use that range. The exact access point and parking area described by the visitor still need a field-confirmed pin. Do not copy the Newburgh Pointe, boat launch or Sumac Pointe map coordinates as a substitute.

## How a visitor contributes a missing point

1. Navigate to HINES PLACES and open a `PIN TO VERIFY` entry, then choose **HELP LOCATE / SUBMIT A WAYPOINT**.
2. DRIFT opens the ordinary waypoint editor with a suggested name. The visitor picks the actual spot on the map or asks for a precise device fix **while physically at that place**.
3. They save it in the private journal and explicitly choose **SUBMIT FOR REVIEW**.
4. The submission goes to the existing D1 `landmarks` review queue. The app displays only approved community waypoints. Private journal notes are not submitted.
5. A reviewer checks public access, duplication, sensitivity and the pin. Only then may the canonical public directory be updated by editing the corresponding JSON entry from `awaiting_verification` to `reference` and adding the verified coordinates.

A community submission is **not** an automatic endorsement or upgrade of the official catalog. The public directory is curator-maintained. Reviewer guidance is in `docs/RELEASES.md`.

## Sources

- [Wayne County Hines Park directory](https://www.waynecountymi.gov/Parks-Recreation/Explore/Hines-Park)
- [Wayne County 2026–2030 Parks Plan](https://www.waynecountymi.gov/files/assets/mainsite/v/1/community-events-amp-recreation/documents/parks/2026-2030-wayne-county-parks-and-recreation-plan.pdf)
- [Wayne County-owned parks map](https://www.waynecountymi.gov/files/assets/mainsite/v/1/information-technology/maps-amp-data/documents/parks_all.pdf)
- [Newburgh Lake public boat launch](https://www.michiganwatertrails.org/location.asp?aid=5013&ait=av)

The map should always label coordinates as **reference locations** and direct visitors to posted signage and verified access details. Hines Drive may flood or close, so no coordinate in this list should be described as a guaranteed reachable destination.
