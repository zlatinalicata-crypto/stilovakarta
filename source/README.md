# Изходен код

Тук е кодът, от който се сглобява сайтът. Сайтът (папките `public`, `lib`, `netlify`) се генерира с:

    npm install astronomy-engine@2.1.19 @fontsource/prata @fontsource/onest stripe@23.1.0
    python3 build.py

`build.py` прави две неща: `site/` (този сайт) и `dist/index.html` (демото в Claude).
