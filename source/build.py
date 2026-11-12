"""Builds from src/:
   dist/index.html   demo for the Claude artifact: everything runs in the browser, with test mode
   site/             the stilovakarta repository: public pages, server functions, legal pages
"""
import pathlib, shutil, json, hashlib, datetime, subprocess

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'
SS = ROOT / 'site-src'
shell = (SRC / 'shell.html').read_text()
read = lambda f: (SRC / f).read_text()

# ---------- artifact demo ----------
art = shell.replace('<!--HEAD-->', '''<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=Prata&display=swap">''')
art = art.replace('<!--ASTRO-->', '<script src="https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js"></script>')
art = art.replace('/*__SCRIPTS__*/', '\n'.join(read(f) for f in ['engine.js', 'data.js', 'palette.js', 'scoring.js', 'figure.js', 'report.js', 'app.js']))
(ROOT / 'dist').mkdir(exist_ok=True)
(ROOT / 'dist' / 'index.html').write_text(art)

# ---------- site ----------
out = ROOT / 'site'
if out.exists():
    shutil.rmtree(out)
pub = out / 'public'
(pub / 'fonts').mkdir(parents=True)
(pub / 'icons').mkdir()

# browser data: questions, names and short texts only; palettes and rules stay on the server
pubdata = subprocess.run(['node', '-e', r'''
const D = require('./src/data.js');
const strip = k => { const cs = D.SEASONS[k].colors.filter(c => c[3] !== 'test'); return [0, 2, 8, 10, 16, 19, 20].map(i => cs[i % cs.length][1]); };
const o = {
  EL_NAME: D.EL_NAME,
  SEASONS: Object.fromEntries(Object.entries(D.SEASONS).map(([k, s]) => [k, { name: s.name, the: s.the, traits: s.traits, subtypes: s.subtypes, strip: strip(k) }])),
  LINES: Object.fromEntries(Object.entries(D.LINES).map(([k, l]) => [k, { name: l.name, fam: l.fam, essence: l.essence }])),
  LINE_KEYS: D.LINE_KEYS, LINE_PROTO: D.LINE_PROTO, LINE_Q: D.LINE_Q,
  ARCH: Object.fromEntries(Object.entries(D.ARCH).map(([k, a]) => [k, { name: a.name, traits: a.traits, essence: a.essence, m: a.m ? { name: a.m.name, traits: a.m.traits } : undefined }])),
  ARCH_KEYS: D.ARCH_KEYS, ARCH_Q: D.ARCH_Q, SEASON_Q: D.SEASON_Q, CITIES: D.CITIES, TZS: D.TZS
};
process.stdout.write('var DATA = ' + JSON.stringify(o) + ';');
'''], capture_output=True, text=True, cwd=ROOT, check=True).stdout

LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'
faces = []
fs = ROOT / 'node_modules' / '@fontsource'
for fam, pkg, weights in [('Prata', 'prata', [400]), ('Onest', 'onest', [400, 500, 600])]:
    for w in weights:
        for sub, rng in [('cyrillic', CYR), ('latin', LATIN)]:
            name = '%s-%s-%d-normal.woff2' % (pkg, sub, w)
            shutil.copy(fs / pkg / 'files' / name, pub / 'fonts' / name)
            faces.append('@font-face{font-family:"%s";font-style:normal;font-weight:%d;font-display:swap;src:url(fonts/%s) format("woff2");unicode-range:%s}' % (fam, w, name, rng))

head = '''<meta name="theme-color" content="#6E1F3B">
<meta name="description" content="Лична палитра от цветовия сезон, линията на тялото, стиловия архетип и рождената карта.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon-64.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Стилова карта">
<script>window.__PWA__=true;window.__SITE__=true</script>
<style>%s</style>''' % '\n'.join(faces)
site_html = shell.replace('<!--HEAD-->', head).replace('<!--ASTRO-->', '')
site_html = site_html.replace('/*__SCRIPTS__*/', pubdata + '\n' + read('scoring.js') + '\n' + read('app.js'))
(pub / 'index.html').write_text(site_html)

today = datetime.date.today().strftime('%d.%m.%Y')
for f in ['terms.html', 'privacy.html']:
    shutil.copy(SS / 'public-src' / f, pub / f)
for f in ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon-64.png']:
    shutil.copy(ROOT / 'assets' / f, pub / 'icons' / f)
manifest = {
    'name': 'Стилова карта', 'short_name': 'Стилова карта',
    'description': 'Лична палитра от цветовия сезон, линията на тялото, стиловия архетип и рождената карта.',
    'lang': 'bg', 'dir': 'ltr', 'id': '/', 'start_url': '/', 'scope': '/', 'display': 'standalone', 'orientation': 'portrait',
    'background_color': '#F3F1F4', 'theme_color': '#6E1F3B', 'categories': ['lifestyle', 'personalization'],
    'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
              {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
              {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]
}
(pub / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
assets = ['/', 'index.html', 'terms.html', 'privacy.html', 'manifest.webmanifest'] + \
    ['fonts/' + p.name for p in sorted((pub / 'fonts').iterdir())] + ['icons/' + p.name for p in sorted((pub / 'icons').iterdir())]
h = hashlib.sha1()
for a in assets[1:]:
    h.update((pub / a).read_bytes())
(pub / 'sw.js').write_text((SRC / 'sw.js').read_text().replace('__VERSION__', h.hexdigest()[:10]).replace('__ASSETS__', json.dumps(assets)))

(out / 'lib').mkdir()
for f in ['engine.js', 'data.js', 'palette.js', 'figure.js', 'report.js']:
    shutil.copy(SRC / f, out / 'lib' / f)
for f in ['lib/pay.js', 'lib/server.js', 'netlify/functions/report.js', 'netlify/functions/checkout.js', 'netlify.toml', 'tools/dev-server.js', 'README.md']:
    (out / f).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(SS / f, out / f)
(out / 'package.json').write_text(json.dumps({
    'name': 'stilovakarta', 'private': True, 'description': 'Стилова карта: лична палитра',
    'scripts': {'dev': 'MOCK_STRIPE=1 TEST_MODE=1 node tools/dev-server.js'},
    'engines': {'node': '>=20'},
    'dependencies': {'astronomy-engine': '2.1.19', 'stripe': '23.1.0'}
}, ensure_ascii=False, indent=2) + '\n')
(out / '.gitignore').write_text('node_modules/\n.netlify/\n')
print('artifact', len(art), '| site public index', len(site_html), '| files', sum(1 for p in out.rglob('*') if p.is_file()))
