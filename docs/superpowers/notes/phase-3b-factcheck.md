# Phase 3b — fact check (review agent, 2026-09-27)

Method: every cited URL opened with WebFetch on 2026-09-27. S3 (El Adoquín) returned HTTP 403 (also with a browser user agent); S22 (DRNA PDF) failed DNS lookup. Those rows were checked against `docs/research/ancon-research.md` instead. S9 (elancondeloiza.com) opens but is a "redesigning" placeholder with no content. Research-doc grades are given where they matter.

| era | # | verdict | quote or reason | suggested fix |
|---|---|---|---|---|
| 1840 | 0 | supported | FLAG: source unreachable (S3 403). Research doc timeline: 1824/1827 ancón de pasaje, graded (H). | Keep. Re-check S3 by hand. |
| 1840 | 1 | partly supported | FLAG: source unreachable (S3 403). Research doc: drawing is (H), but table §2.2 grades the craft's details (pole) "L for details". | Keep drawing, date, museum; soften the pole: "muestra una embarcación cruzando" / "shows a craft crossing", or verify pole in S3. |
| 1840 | 2 | partly supported | FLAG: source unreachable (S3 403). Research doc: Lombera plan exists (H); rope detail falls under "L for details" in §2.2 (timeline says H — doc is inconsistent). | Verify the rope in S3 before stating it; otherwise "incluye un dibujo del ancón". |
| 1840 | 3 | supported | FLAG: source unreachable (S3 403). Research doc: Miyares two routes (H); La Gaceta, road finished August 1853 (H). Note: the two routes are late-1700s. | Keep. |
| 1840 | 4 | supported | S14: "constructed in 1645"; "enlarged to its present size in 1729"; "used as a shelter for hurricanes, floods". | Keep. |
| 1900 | 0 | supported | S1: "Ellos eran dueños de la finca de caña"; "pudo haber sido a finales del siglo XIX". Start date graded (L) in research doc, but the fact hedges it. | Keep hedge; user to decide if an L-graded date may appear even hedged. |
| 1900 | 1 | supported | FLAG: source unreachable (S3 403). Research doc: 1900 photo in Sepúlveda, *PR Urbano*, graded (M). ES "Existe una foto del ancón de 1900" reads as a calque and is ambiguous. | ES: "Se conserva una foto del ancón tomada en 1900, publicada en…". |
| 1900 | 2 | partly supported | S23: "En 1909, el Consejo Municipal de Loíza adoptó una ordenanza para trasladar la cabecera"; "Loíza Aldea quedó como barrio." S16 says nothing about the move. 1910 not in any cited source. | "En 1909 se ordenó trasladar la sede… a Canóvanas" / "In 1909…". Drop S16 or cite a source for 1910. |
| 1900 | 3 | partly supported | S28 gives name: "named after the Casuarina, locally called Piñones"; S28 has no 1918 date. S22 unreachable (DNS) — FLAG: source unreachable; research doc grades 1918 (H) via S22. | Verify 1918 in the DRNA PDF by hand; until then drop the year or cite S22 only. |
| 1925 | 0 | supported | S1: "trabajó por muchos años para la familia Iturregui operando la barcaza hasta que la compró"; "lo adquirió en 1920". S11: "Don Pedro Cortijo, primer concesionario de El Ancón". | Keep. |
| 1925 | 1 | supported | S4: "El Ancón de madera"; S1: "Eran dos varas, una que empujaba y la otra que mantenía el curso." ("como un timón" is our gloss.) | Keep. |
| 1925 | 2 | supported | S1: "el pasaje por persona, incluyendo el modo de transporte, era de apenas 10 centavos". | Keep. |
| 1925 | 3 | partly supported | S4 caption 1: "con capacidad para un solo vehículo" (dated 1930s). Ox cart, people and horses are not in S4; the research doc attributes them to caption 1 wrongly. S6 only: "pasaje de personas, animales y vehículos". | "La plataforma llevaba un solo vehículo, además de personas y animales" and add S6; or drop ox cart/horses. |
| 1935 | 0 | supported | S1: "Cuando llegaron los carros, se comenzaron a utilizar las sogas. Eran dos sogas marinas… tensas entre una orilla y otra". | Keep. |
| 1935 | 1 | partly supported | S4: "Feliciano "Chano" Cortijo impulsando El Ancón con sogas… década del 1930." The 1930s–1970s span only follows from photos dated 1930s and 1970s; "hijo de Pedro" is implied (S11: Andrea "hermana de Chano e hija de Papa Pedro"), not stated. | Keep the photo; say "lo operó por décadas, hasta su muerte en 1978" (S11), or mark `inferred`. |
| 1935 | 2 | partly supported | S11: "administraba la familia, el hogar y El Ancón"; "recoger plantas sanadoras". "Burén" is in neither S4 nor S11 (S1 uses burén for Las Carreras kiosks, not for her). | Drop "al burén"; "llevaba la casa, el negocio y la cocina" is fine (S4 cap. 34). |
| 1935 | 3 | supported | S1: "para dos vehículos, para cuatro, para seis, y al final, para ocho vehículos." | Keep. |
| 1959 | 0 | partly supported | S15: "Construction of the dam began in 1950 and finished in 1954." The research doc's "1953–54" is wrong. | "se terminó en 1954" / "was completed in 1954". |
| 1959 | 1 | supported | S4 cap. 5: "automóvil de Florencio "Colo" Ramos, chofer público… frente al negocio familiar de El Ancón alrededor del año 1959." | Keep. |
| 1959 | 2 | partly supported | S30 only shows the infobox: "Existed 1953–present". Nothing says it was *numbered* in 1953, or that the road ran through the crossing. | "La PR-187 existe desde 1953" / "PR-187 has existed since 1953". |
| 1975 | 0 | supported | S1: "Ese era el paseo de los fines de semana"; "traían sus calderos de comida"; "volvían a cruzar por la tarde". | Keep. |
| 1975 | 1 | partly supported | Name: S4 cap. 34. S1: "vellonera… se daban su cervecita, se comían su alcapurria". S4 cap. 33 is only "Vista desde la terraza"; "over the river" is not stated. | "tenía una terraza" / "had a terrace", or "con vista al río" only if the photo is checked. |
| 1975 | 2 | partly supported | S23: "en 1970, se creó el pueblo de Canóvanas y Loíza Aldea volvió a ser la cabecera". "16 de agosto" is in neither S12 nor S23 (S12 says nothing about it). "La Restauración" as the name: S23 only "restauración del municipio". | Drop the day: "En 1970…". Keep "la Restauración" only with a source (S1 names the bridge "Puente de la Restauración"). |
| 1975 | 3 | supported | S1: "Allí estuvo, varias veces, Iris Chacón, Tony Croatto, Wilkins, Lucecita Benítez, Cheo Feliciano"; "se grabaron infinidad de comerciales, programas especiales y películas". | Keep. |
| 1975 | 4 | partly supported | S4 cap. 8: "La futura Casa Museo Cortijo recién construida en la década del 1960"; cap. 48: "junto a la estación". "En cemento" is not stated in S4 or S6. | Drop "en cemento" / "in concrete". |
| 1984 | 0 | supported | S1: "El último cambio se hizo en 1980"; S4 cap. 19: "barcaza de metal con planchas de acero con capacidad de seis a ocho vehículos". | Keep. |
| 1984 | 1 | supported | S11: "asumir en el 1978 las riendas… cuando falleció Don Chano"; "le hicieron una huelga"; "la única mujer que… administró El Ancón"; "nuestra 'Magui'". | Keep. Note S4 is narrower: "única mujer anconera de su familia". |
| 1984 | 2 | partly supported | S1: "hasta el final, que el pasaje era $2.50". It does not say this was per vehicle. S5 has no fare. | "Al final, el pasaje costaba $2.50" / "the fare was $2.50"; drop S5. |
| 1984 | 3 | supported | S4 cap. 37: "mantenimiento de El Ancón con una grúa cerca del año 1982"; cap. 38: "limpiarlo de los caracoles". | Keep. |
| 1984 | 4 | partly supported | S4 cap. 32: "Estudiantes escolares lanzando flores al agua en honor a Julia de Burgos… década del 1980"; cap. 31: "17 de febrero". The poem and "part of the identity" are in neither source (S1 only: the area "enamoró a la poetisa"). | Drop the poem sentence, or cite a source for it. |
| 1986 | 0 | partly supported | 1986: S4: "hasta el año 1986 cuando cesaron operaciones"; S1 agrees. The 1985 bridge is not on any cited page; it appears only in the Archivo Negro post "Un vínculo histórico" (not in SOURCES) and in S3 (unreachable). S27 has no year. | Add archivonegro.org/post/el-ancon-de-loiza-un-vinculo-historico as a source; drop S27. |
| 1986 | 1 | supported | S4 cap. 42: "esperando por la Paseadora… durante el 1987"; cap. 43: "fines de semana con tarifas de $2 para adultes y $1.50". S7 does not mention the Paseadora. | Drop S7. |
| 1986 | 2 | partly supported | Only the uncited post supports it: "colaboración con el municipio… atractivo turístico"; "un huracán arrastró la barcaza al mar". The S4 collection page and S6 are silent on this. | Cite the "vínculo histórico" post; drop S6 here. |
| 1986 | 3 | partly supported | S6: "En 2019, se fundó el Colectivo"; "El 26 de junio de 2024… apertura de la Casa Museo". S5 says "a new human-centered barge", not human-powered, and says members "hope to" build it; the grant is not tied to it. S9 has no content. | "El Colectivo espera construir una nueva barcaza…" / "hopes to build a new barge"; drop "con fondos de Mellon" and S9. |

## Applied fixes

- 1840 #1 — Dropped the "empujada con una vara" (pole) detail from es/en; kept the drawing, date and museum (S3 unreachable; the detail rests on an L-graded item in the research doc).
- 1840 #2 — Dropped the "con una soga desde la embarcación hasta la orilla" (rope) detail from es/en; kept the plan's existence (S3 unreachable; same L-graded-details issue).
- 1900 #0 — Removed "quizás a finales del siglo XIX" / "possibly the late 1800s" (an L-graded date) from es/en; the fact now only says the start date is uncertain.
- 1900 #1 — Rewrote es from a calque ("Existe una foto del ancón de 1900, publicada en…") to natural Spanish ("Se conserva una foto del ancón tomada en 1900, publicada en…"); updated en to match.
- 1900 #2 — Rewrote to the sourced date and action: "En 1909 el Consejo Municipal de Loíza ordenó trasladar la sede…"; dropped the unsourced "1910" and dropped source S16 (kept S23 only).
- 1925 #3 — Rewrote "una carreta de bueyes… caballos" to "personas y animales" (not in S4); added source S6, which supports "personas, animales y vehículos".
- 1935 #1 — Rewrote to drop the unstated "hijo de Pedro" and the inferred "1930s–1970s" span; now states he ran it "hasta su muerte, en 1978" (S11), keeping the 1930s photo (S4).
- 1935 #2 — Dropped "al burén" (not sourced for Tanén in S4 or S11); kept "la casa, el negocio y la cocina".
- 1959 #0 — Fixed the wrong date: "se construyó en 1953–1954" → "se terminó en 1954" (S15: built 1950, finished 1954).
- 1959 #2 — Rewrote "recibió el número PR-187 en 1953" (overstated) to "La carretera PR-187 existe desde 1953." (matches S30's infobox; fix round 1 dropped "que pasa por el ancón" / "through the crossing", which is not in S30 either).
- 1975 #1 — Dropped "sobre el río" (not stated in S4's caption) from the terrace description.
- 1975 #2 — Rewrote: dropped the unsourced "16 de agosto" date and the "«la Restauración»" label (S1 uses that name for the bridge, not the 1970 event); dropped source S12 (kept S23, confirmed by direct fetch: "en 1970, se creó el pueblo de Canóvanas y Loíza Aldea volvió a ser la cabecera").
- 1975 #4 — Dropped "en cemento" / "in concrete" (not stated in S4 or S6).
- 1984 #2 — Rewrote "cruzar con un vehículo costaba $2.50" to "el pasaje costaba $2.50" (S1 does not say per-vehicle); dropped source S5 (no fare given).
- 1984 #4 — Dropped the sentence about the poem and "identity" (not in S1 or S4); kept the sourced flower-tribute detail, citing S4 only (S1 was not relevant to this remaining sentence).
- 1986 #0 — Added new source S4b (Archivo Negro, "El Ancón de Loíza: un vínculo histórico") to `src/data/sources.ts`; fetched it directly and confirmed "la inauguración del puente del Río Grande de Loíza en 1985" and the 1986 closure. Dropped S27 (no year); kept S4 (1986 closure) plus S4b (1985 bridge year).
- 1986 #1 — Dropped source S7 (does not mention La Paseadora); kept S4 only.
- 1986 #2 — Cited S4b instead of S6, after fetching S4b and confirming both the municipal-collaboration attempt and the hurricane sentence verbatim.
- 1986 #3 — Rewrote "un plan… propone una nueva barcaza movida por personas" to "El Colectivo espera diseñar y construir una nueva barcaza para atraer visitantes al centro histórico de Loíza." (fix round 1: "movida por personas" / "human-powered" was still not in S5, which says "human-centered barge"; S6 does not mention a new barge at all); dropped "con fondos de la Fundación Mellon" and dropped source S9 (placeholder page with no content); kept S5 (new-barge sentence) and S6 (2019/2024 parts).

## Flagged for the user

- 1840 #0 — FLAG: source unreachable (S3, HTTP 403, re-checked 2026-09-27, still 403). Checked against the research doc (H). Kept as written.
- 1840 #1 — FLAG: source unreachable (S3). Softened to drop the pole detail; verify by hand if S3 ever opens.
- 1840 #2 — FLAG: source unreachable (S3). Softened to drop the rope detail; verify by hand if S3 ever opens.
- 1840 #3 — FLAG: source unreachable (S3). Checked against the research doc (H). Kept as written.
- 1900 #3 — 1918 is not in S28; S22 (DRNA PDF) is unreachable (DNS, re-checked 2026-09-27, still fails). FLAG: source unreachable. Kept as written per the research doc's own (H) grade for the date via S22; the user may want to verify the PDF by hand once it is reachable.
