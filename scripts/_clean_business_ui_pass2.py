"""Second pass: placeholder, DomainPageShell Home, prioridades hrefs."""
from __future__ import annotations

from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "frontend" / "src"


def rewrite_placeholder() -> None:
    path = SRC / "pages" / "InsightsPlaceholderPage.tsx"
    text = path.read_text(encoding="utf-8")
    repls = [
        (
            "isso fica no Business).",
            "isso fica para as vistas detalhadas).",
        ),
        (
            "A Home Business já mostra um pedaço; aqui é o painel completo.",
            "A Home Insights já mostra um pedaço; aqui é o painel completo.",
        ),
        (
            "Pedidos/Vendas do Business).",
            "Pedidos/Vendas operacionais).",
        ),
        (
            "os mesmos números do Business.",
            "os mesmos números do knowt.",
        ),
        (
            "Modo <strong>Insights</strong> — fase {meta.fase}. O Business continua a ser o operacional\n"
            "            padrão; esta aba recebe narrativa, alertas e recomendações.",
            "Modo <strong>Insights</strong> — fase {meta.fase}. No piloto knowt toda a navegação fica\n"
            "            nesta lane (Insights + Agenda).",
        ),
        (
            '            <Button component={RouterLink} to="/" variant="outlined" sx={{ textTransform: \'none\' }}>\n'
            "              Ir ao Business\n"
            "            </Button>",
            '            <Button component={RouterLink} to="/insights/agenda" variant="outlined" sx={{ textTransform: \'none\' }}>\n'
            "              Abrir Agenda\n"
            "            </Button>",
        ),
    ]
    for old, new in repls:
        if old not in text:
            print("MISS placeholder:", old[:70].replace("\n", "\\n"))
        else:
            text = text.replace(old, new)
            print("OK placeholder:", old[:50].replace("\n", "\\n"))
    path.write_text(text, encoding="utf-8", newline="\n")
    print("Business left in placeholder:", text.count("Business"))


def rewrite_shell() -> None:
    path = SRC / "components" / "DomainPageShell.tsx"
    text = path.read_text(encoding="utf-8")
    text = text.replace('to="/"', 'to="/insights"')
    text = text.replace(
        "  'Agenda & Tarefas': [],",
        "  'Agenda & Tarefas': [{ to: '/insights', label: 'Insights' }],",
    )
    text = text.replace(
        "const related = RELATED[title] || [{ to: '/', label: 'Home' }]",
        "const related = RELATED[title] || [{ to: '/insights', label: 'Insights' }]",
    )
    path.write_text(text, encoding="utf-8", newline="\n")
    print("shell to=/ leftovers:", text.count('to="/"'), "to=/insights:", text.count('to="/insights"'))


def rewrite_prioridades() -> None:
    path = SRC / "pages" / "InsightsPrioridadesPage.tsx"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "href: area === 'Fiscal' ? '/fiscal' : area === 'Margem' ? '/margens' : '/operacoes'",
        "href: area === 'Fiscal' ? '/insights/financeiro' : area === 'Margem' ? '/insights/financeiro' : '/insights/prioridades'",
    )
    text = text.replace("href: '/fiscal'", "href: '/insights/financeiro'")
    text = text.replace("href: '/margens'", "href: '/insights/financeiro'")
    path.write_text(text, encoding="utf-8", newline="\n")
    print(
        "prioridades leftover fiscal/margens/operacoes:",
        any(x in text for x in ["'/fiscal'", "'/margens'", "'/operacoes'"]),
    )


def scan_business() -> None:
    for path in sorted((SRC / "pages").glob("Insights*.tsx")):
        lines = [
            (i, line.strip())
            for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1)
            if "Business" in line
        ]
        if lines:
            print(path.name, lines)
    agenda = SRC / "pages" / "AgendaPage.tsx"
    lines = [
        (i, line.strip())
        for i, line in enumerate(agenda.read_text(encoding="utf-8").splitlines(), 1)
        if "Business" in line or 'ctaTo="' in line
    ]
    print("AgendaPage", lines)


def main() -> None:
    rewrite_placeholder()
    rewrite_shell()
    rewrite_prioridades()
    scan_business()


if __name__ == "__main__":
    main()
