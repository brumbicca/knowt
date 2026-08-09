"""Retarget Business routes → Insights and soften user-visible Business copy."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src"

ROUTE_MAP = [
    ('to="/vendas"', 'to="/insights/comercial"'),
    ("to='/vendas'", "to='/insights/comercial'"),
    ("to: '/vendas'", "to: '/insights/comercial'"),
    ("href: '/vendas'", "href: '/insights/comercial'"),
    ('to="/pedidos"', 'to="/insights/comercial"'),
    ("to='/pedidos'", "to='/insights/comercial'"),
    ("to: '/pedidos'", "to: '/insights/comercial'"),
    ("href: '/pedidos'", "href: '/insights/comercial'"),
    ('to="/margens"', 'to="/insights/financeiro"'),
    ("to='/margens'", "to='/insights/financeiro'"),
    ("to: '/margens'", "to: '/insights/financeiro'"),
    ("href: '/margens'", "href: '/insights/financeiro'"),
    ('to="/fiscal"', 'to="/insights/financeiro"'),
    ("to='/fiscal'", "to='/insights/financeiro'"),
    ("to: '/fiscal'", "to: '/insights/financeiro'"),
    ("href: '/fiscal'", "href: '/insights/financeiro'"),
    ('to="/operacoes"', 'to="/insights/prioridades"'),
    ("to='/operacoes'", "to='/insights/prioridades'"),
    ("to: '/operacoes'", "to: '/insights/prioridades'"),
    ("href: '/operacoes'", "href: '/insights/prioridades'"),
    ('to="/agenda"', 'to="/insights/agenda"'),
    ("to='/agenda'", "to='/insights/agenda'"),
    ('ctaTo="/agenda"', 'ctaTo="/insights/agenda"'),
]

COPY_MAP = [
    ("aprofundar no Insights ou Business", "aprofundar nos Insights"),
    ("no Insights ou Business", "nos Insights"),
    ("mesma fonte do Business", "mesma fonte do knowt"),
    ("mesma verdade do Business", "mesmo motor do knowt"),
    ("Abrir Vendas no Business para drill-down completo.", "Abrir Comercial nos Insights para drill-down."),
    ("Cruzar UF/tipo com campanhas de reativação no Business.", "Cruzar UF/tipo com campanhas de reativação nos Insights."),
    ("Revisar categorias de despesa no Business.", "Revisar categorias de despesa nos Insights."),
    ("Cruzar pagamentos e status de pedidos no Business.", "Cruzar pagamentos e status de pedidos nos Insights."),
    ("Home Business", "Home Insights"),
    ("no Business.", "nos Insights."),
    ("no Business", "nos Insights"),
    ("do Business.", "do knowt."),
    ("do Business", "do knowt"),
]


def main() -> None:
    files: list[Path] = list((ROOT / "pages").glob("Insights*.tsx"))
    files += [
        ROOT / "pages" / "AgendaPage.tsx",
        ROOT / "pages" / "InsightsPlaceholderPage.tsx",
        ROOT / "components" / "DomainPageShell.tsx",
        ROOT / "components" / "InsightsAgendaColumn.tsx",
        ROOT / "components" / "OpsAlertsCard.tsx",
    ]
    changed: list[str] = []
    for path in files:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        orig = text
        for old, new in ROUTE_MAP + COPY_MAP:
            text = text.replace(old, new)
        if text != orig:
            path.write_text(text, encoding="utf-8", newline="\n")
            changed.append(str(path.relative_to(ROOT)))
    print(f"changed {len(changed)}")
    for item in changed:
        print(item)


if __name__ == "__main__":
    main()
