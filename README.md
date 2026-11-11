# Katalog figur ČSTS / ČSTS Figure Catalog

Statická webová aplikace (React + Vite + TypeScript) pro vyhledávání figur z
Katalogu figur ČSTS, zobrazení rytmizace, legality podle třídy a skládání sestav.
UI je česky i anglicky.

## Spuštění

```bash
npm install
npm run dev        # vývojový server
npm run build      # produkční build do dist/ (statické soubory)
npm run preview    # náhled buildu
```

`dist/` lze nahrát na libovolný statický hosting; cesty jsou relativní (`base: "./"`).
Na GitHub Pages se aplikace nasazuje automaticky při každém pushi do `main`
(`.github/workflows/deploy.yml`).

## Data

| Zdroj | Soubor | Co z něj bereme |
|---|---|---|
| ČSTS SC02 Katalog figur (2026-07-01) | `data/raw/SC02_260701_Katalog figur.pdf` | čísla, CZ/EN názvy, literatura, třídy E/D/C |
| WDSF Syllabus | `data/raw/WDSF_Syllabus.pdf` | začátek, konec, rytmizace, poznámky |
| YouTube vyhledávání | `data/videos.json` | ukázková videa (automaticky, max. 3 na figuru) |
| dancecentral.info (technika ISTD) | `data/alignment.json` | grafy kroků: směrování, otočení, návaznosti – pro plánek na parketu |
| ručně | `data/dances.json` | metadata tanců (takt, tempo, hodnoty S/Q) a poznámky katalogu |
| ručně | `data/aliases.json` | jiné běžné názvy figur (CZ/EN); doplňují se k názvům ze syllabu a dancecentral.info |

Zdrojová PDF a surová stažená data **nejsou v repozitáři** (autorská práva) –
aplikace potřebuje jen vygenerovaný `src/data/figures.json`, který v repozitáři je.
Pro přegenerování dat je stáhni do `data/raw/`:

- Katalog figur ČSTS (SC02): https://www.csts.cz/cs/Files/GetFile/6816 → `data/raw/SC02_260701_Katalog figur.pdf`
- WDSF Syllabus: https://www.worlddancesport.org/Rule/Competition/General/Syllabus → `data/raw/WDSF_Syllabus.pdf`

Pipeline (vyžaduje `pdftotext` z poppleru a Python 3):

```bash
npm run data     # PDF -> data/build/*.json -> src/data/figures.json
npm run videos   # stáhne/aktualizuje videa (pokračuje, kde skončilo) a přegeneruje data
```

- `scripts/parse_catalog.py` – parser tabulek katalogu (ruční opravy v `OVERRIDES`)
- `scripts/parse_syllabus.py` – parser WDSF Syllabu
- `scripts/build_data.py` – spojení podle názvu figury (ruční páry v `MANUAL_MATCH`)
- `scripts/scrape_videos.py` – vyhledání videí na YouTube
- `scripts/scrape_alignment.py` – grafy kroků z dancecentral.info (`python3 -I scripts/scrape_alignment.py`, pak `npm run data`)

Při nové verzi katalogu stačí nahradit PDF v `data/raw/`, upravit cestu ve
skriptu `data` v `package.json` a spustit `npm run data`.

## Poznámky

- Sestavy a vlastní figury se ukládají do `localStorage` prohlížeče; export/import je JSON
  (`{ routines, customFigures }`, starší export jako pole sestav se načte také).
- Vlastní figury nejsou v katalogu ČSTS – aplikace je bere jako povolené jen ve třídách B, A, M.
- Varianty figur (povolené části, alternativní začátek a konec) se strojově
  vytahují z poznámek WDSF Syllabu v `scripts/build_data.py` (`extract_variants`).
  Vlastní rozsah kroků je možný, ale aplikace ho označí jako nepovolený.
- Kontrola navazování (noha a postavení) je odhad z popisu začátku/konce figur (kroky M)
  a nezohledňuje alternativy z poznámek.
- Závazné je vždy znění katalogu ČSTS a technických příruček WDSF.
