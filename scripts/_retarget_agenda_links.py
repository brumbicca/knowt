from pathlib import Path

root = Path(r"c:\Apps\knowt\frontend\src")
subs = [
    ('to="/agenda"', 'to="/insights/agenda"'),
    ("to={'/agenda'}", "to={'/insights/agenda'}"),
    ("href: '/agenda'", "href: '/insights/agenda'"),
    ("path: '/agenda'", "path: '/insights/agenda'"),
    ("to=\"/agenda\"", 'to="/insights/agenda"'),
    ("Abrir Agenda no Business", "Abrir Agenda"),
    ("Ver no Business →", "Ver detalhes →"),
    ("mesma verdade do Business", "mesmo motor do knowt"),
]
for p in root.rglob("*.tsx"):
    t = p.read_text(encoding="utf-8")
    orig = t
    for a, b in subs:
        t = t.replace(a, b)
    if t != orig:
        p.write_text(t, encoding="utf-8")
        print("updated", p.relative_to(root))
