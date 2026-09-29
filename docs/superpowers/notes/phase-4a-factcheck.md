# Phase 4a fact check (2026-09-28)

Sources fetched with WebFetch (plus curl for S1/S3/S4 raw HTML). S3 returned 403 to both.

| Claim | Source | Verdict | Evidence | Suggested fix |
|---|---|---|---|---|
| Sand camino real before 20th c. | S3 | unverified (source blocked) | 403 on WebFetch and curl. | Keep M/inferred; re-check by hand or cite research §9 only. |
| PR-187 numbered 1953 | S30 | supported | Infobox says existed 1953-present; cites the 1953 renumbering. No surface info. | none; note it gives no surface, so gravel/asphalt stay L. |
| Gravel 1935 / asphalt 1959 inferred | (none) | supported (labelled inferred) | No source claims it; correctly L. | none |
| Landing "street end on riverbank" | S9 | not supported | Page only gives the address (Calle Carlos Escobar #13); nothing on street end or riverbank. | Drop S9 from landing sources or cite only S26/geometry; keep L. |
| Landing "street end on riverbank" | S26 | partly | OSM way 204521442 is the PR-187 bridge, not the street end at the landing. Street-end fact would come from way 22182236 (geo data), not this way. | Cite S26 only for the bridge; for landing cite the geo data way 22182236 / mark purely inferred. Spec confidence M is too high; use L. |
| Cortijos ran the ancón from about 1920 | S1 | supported | Says the family took over in 1920 (grandfather bought it from the Iturregui). | none ("about" is fine). |
| Concrete house built in 1960s | S4 | partly | Says the house was built in the 1960s (foundation photo, "recién construida"). Concrete is not stated. | Say "house built in the 1960s"; concrete inferred. Confidence H -> M. |
| Concrete house built in 1960s | S6 | not supported | Post does not mention 1960s or concrete; mentions 1920s land purchase and slabs from expansions. | Remove S6 from STATION.concrete (or keep only as context). |
| Bar Restaurante El Ancón with river terrace | S4 | supported | Caption cites view from the terrace of the Bar Restaurante El Ancón. | none |
| Bar Restaurante El Ancón with river terrace | S1 | partly | Caption names the Bar Restaurante on the station, but with a balcony (balcón), not a terrace. | Word as "balcony/terrace"; cite S4 for terrace. |
| Bar terrace shown from 1975 | (inferred) | supported (labelled inferred) | Sources give no start date. | none |
| House beside the landing demolished for the bridge | S4 | supported | Caption: metal barge in early 1980s, behind it a house demolished by bridge construction. | none for the fact. The 1984 "gone" state is H in code; timing of demolition is not dated, so use M. |
| House existed from 1935 | (inferred) | supported (labelled inferred) | No source. | none |
| Bridge built early-mid 1980s | S4 | supported | Photo of bridge under construction at the start of the 1980s; barge closed 1986. | none |
| Bridge concrete, flags in period photos | S4 | not supported | Not found on the S4 page. Concrete reinforced structure with flags is in S1 (a 2025 photo), not a period photo. | Cite S1 for concrete; flags are from the modern photo. Reword "flags in period photos". |
| Bridge inaugurated 1985 | S1 | not supported | S1 says the bridge was built in 1986 and shows construction photos dated 1985. No inauguration year given. | Change to "opened by 1986; under construction 1985"; H -> M. |
| Bridge inaugurated 1985 | S3 | unverified (source blocked) | 403. | Re-check by hand. |
| Bridge name: Puente de la Restauración | S27 | partly | Article does not give the name; it dedicates the PR-187 bridge to the town's restorers (2019). Name is in S1 and S4. | Cite S1/S4 for the name. |
| PR-187 bridge over Río Grande de Loíza | S27 | supported | Article places the bridge on PR-187. | none |
| Bridge alignment from OSM way 204521442 | S26 | supported | Way is PR-187 with a bridge over the Río Grande de Loíza. | none; the pier/deck values remain L. |
| Bridge state 'none' in eras 1840-1975 (NO_BRIDGE H) | S1, S4 | partly | Sources describe the ferry as the only crossing until the bridge; no era-by-era statement. | Fine as H for the fact; cite S1 alone. |
| Era table summary 1986: "opened in 1985. Regular ancón service ends in 1986" | S1, S4, S27 | not supported (1985) | Same as inauguration row. S1/S4 do say service closed in 1986. | "The Puente de la Restauración replaces the ancón; service ends in 1986." |
| Wood house on zocos, zinc roofs from 1930s | research §7 | unverified (not checked; not in the assigned sources) | Not one of the assigned sources. | none |

## Counts
- supported: 10
- partly: 5
- not supported: 5
- unverified: 3 (two S3 claims blocked by 403; one research-only claim outside assigned sources)
