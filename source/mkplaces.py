"""Builds the place search files in places/ from GeoNames data (CC BY 4.0, https://www.geonames.org).

Sources (download once, outside the repository):
  1. Cities of the world with 1000+ inhabitants, with time zones: the npm package i18n-cities
     (npm pack i18n-cities; the file dist/cities-1000-*.js).
  2. GeoNames postal codes, allCountries.zip (https://download.geonames.org/export/zip/allCountries.zip,
     mirror: https://github.com/Aareon/GeoNamesMirror/releases/latest/download/allCountries.zip).
     From it: every settlement in Bulgaria (Cyrillic names), Moldova and Odesa oblast.

Run:  python3 mkplaces.py path/to/cities-1000.js path/to/allCountries.zip

Output: places/<key>.json, one file per first two letters of a name (key: hex code points joined by -).
A large file is only {"split":3}; its places are in <key>-<third letter>.json, and two-letter names in <key>-0.json. Each file: {"z": [time zones], "r": [records]},
record = [id, name, other name, region, country, lat, lon, zone index, rank]. The page loads only the file for
what is typed, so the search costs no server function.
"""
import ast, json, re, sys, zipfile, unicodedata, math, pathlib, shutil

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / 'places'
SPLIT = 1500  # records in one file before it is split by the third letter

UKR = str.maketrans({'і': 'и', 'ї': 'и', 'є': 'е', 'ґ': 'г', 'ё': 'е', 'ы': 'и', 'э': 'е', 'ı': 'i', 'ł': 'l', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'đ': 'd', 'ð': 'd', 'þ': 'th'})


def norm(s):
    """Same as normPlace() in app.js: lower case, no diacritics, letters, digits and single spaces."""
    s = unicodedata.normalize('NFD', s.lower()).translate(UKR)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^0-9a-zа-я]+", ' ', s).strip()
    return s


def key(n):
    letters = n.replace(' ', '')
    return '-'.join('%x' % ord(c) for c in letters[:2])


def km(a, b):
    dy = (a[0] - b[0]) * 111.0
    dx = (a[1] - b[1]) * 111.0 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def load_world(path):
    s = pathlib.Path(path).read_text(encoding='utf-8')
    # JavaScript literals with single and double quotes: read as Python literals, nothing is executed
    grab = lambda var: ast.literal_eval(re.search(r'var %s = (.*?);\n' % var, s, re.S).group(1))
    regions = grab('regions')
    cities = grab('cities')
    return cities, regions


def main(world_js, postal_zip):
    cities, regions = load_world(world_js)
    recs = []
    # 1) world, except Bulgaria (taken with Cyrillic names from the postal file)
    for gid, name, lat, lon, cc, a1, pop, tz in cities:
        if cc == 'BG':
            continue
        region = regions.get('%s.%s' % (cc, a1), '')
        recs.append(['g%d' % gid, name, '', region if region != name else '', cc, round(lat, 3), round(lon, 3), tz, pop])

    # 2) settlements from the postal file
    groups = {}
    with zipfile.ZipFile(postal_zip) as z, z.open('allCountries.txt') as f:
        for line in f:
            p = line.decode('utf-8').rstrip('\n').split('\t')
            cc = p[0]
            if re.search(r'\d', p[2]):
                continue  # postal sectors such as "Taraclia 1"
            if cc not in ('BG', 'MD') and not (cc == 'UA' and p[3] == 'Odeska'):
                continue
            try:
                lat, lon = float(p[9]), float(p[10])
            except ValueError:
                continue
            groups.setdefault((cc, p[2], p[3]), []).append((lat, lon, p[1]))
    tzof = {'BG': 'Europe/Sofia', 'MD': 'Europe/Chisinau', 'UA': 'Europe/Kyiv'}
    world_md = [r for r in recs if r[4] == 'MD']
    n = 0
    for (cc, raw, reg), pts in sorted(groups.items()):
        # the same name in the same region: one place if within 6 km, otherwise separate villages
        clusters = []
        for pt in pts:
            for c in clusters:
                if km(c[0], pt) < 6:
                    c.append(pt); break
            else:
                clusters.append([pt])
        for c in clusters:
            lat = sum(x[0] for x in c) / len(c)
            lon = sum(x[1] for x in c) / len(c)
            if cc == 'BG':
                name, alt = (raw.split(' / ') + [''])[:2]
                region = reg.split(' / ')[0].replace('София (столица)', 'София-град')
                if region == name:
                    region = ''
            else:
                name, alt, region = raw, '', reg if reg != raw else ''
                if cc == 'MD' and any(norm(r[1]) == norm(name) and km((r[5], r[6]), (lat, lon)) < 8 for r in world_md):
                    continue  # already in the world list, with proper spelling
            n += 1
            recs.append(['%s%d' % (cc.lower(), n), name, alt, region, cc, round(lat, 3), round(lon, 3), tzof[cc], -1])

    # 3) shards by the first two letters of every name; a large one is split again by the third letter
    def keyn(nm, k):
        return '-'.join('%x' % ord(c) for c in nm.replace(' ', '')[:k])
    shards = {}
    for r in recs:
        names = {norm(r[1])} | ({norm(r[2])} if r[2] else set())
        for nm in names:
            if nm.replace(' ', ''):
                shards.setdefault(keyn(nm, 2), {}).setdefault(r[0], (r, nm))
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    zones_all, total, files = set(), 0, 0

    def write(k, items):
        nonlocal total, files
        rows = sorted(items, key=lambda r: -r[8])
        zones = sorted({r[7] for r in rows})
        zi = {z: i for i, z in enumerate(zones)}
        zones_all.update(zones)
        out = {'z': zones, 'r': [[r[0], r[1], r[2], r[3], r[4], r[5], r[6], zi[r[7]], r[8]] for r in rows]}
        f = OUT / (k + '.json')
        f.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        total += f.stat().st_size; files += 1

    for k, rs in shards.items():
        if len(rs) <= SPLIT:
            write(k, [r for r, nm in rs.values()])
            continue
        (OUT / (k + '.json')).write_text('{"split":3}', encoding='utf-8')
        sub = {}
        for r, nm in rs.values():
            short = len(nm.replace(' ', '')) < 3  # a two-letter name, e.g. Bo: file <key>-0
            sub.setdefault(k + '-0' if short else keyn(nm, 3), []).append(r)
        for k3, rows in sub.items():
            write(k3, rows)
    (OUT / 'zones.json').write_text(json.dumps(sorted(zones_all)), encoding='utf-8')
    print('places', len(recs), '| BG/MD/UA settlements', n, '| files', files, '| MB %.1f' % (total / 1e6))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
