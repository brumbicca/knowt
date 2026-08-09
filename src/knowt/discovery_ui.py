"""Discovery UI (Playwright) — conhecer o sistema Tiny/Olist por observação.

- login interactivo → storage_state
- probe-system → mapa de navegação + páginas-chave (dossiê)
- probe-cost → aba Custos de um produto (fatia para gates de margem)

Não publica capabilities nem preenche cost_field automaticamente.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")

DEFAULT_BASE_URL = "https://erp.olist.com/"
DEFAULT_PRODUCT_ID = "747196165"  # CCRCHP-200 — amostra reconciliada 2026-08-09

NAV_SELECTORS = (
    "nav a",
    "[role='navigation'] a",
    "aside a",
    "header a",
    ".menu a",
    ".sidebar a",
    "[class*='menu'] a",
    "[class*='Menu'] a",
)

# Mapa inicial do piloto — expandir conforme o dossiê revelar módulos.
TINY_SYSTEM_TARGETS = (
    {"key": "home", "label": "Home", "url": "https://erp.olist.com/", "domain": "inicio"},
    {
        "key": "pedidos_venda",
        "label": "Pedidos de Venda",
        "url": "https://erp.olist.com/vendas#list",
        "domain": "vendas",
    },
    {
        "key": "pedidos_ecommerce",
        "label": "Pedidos no e-commerce",
        "url": "https://erp.olist.com/lista_pedidos_ecommerce",
        "domain": "vendas",
    },
    {
        "key": "notas_fiscais",
        "label": "Notas Fiscais",
        "url": "https://erp.olist.com/notas_fiscais#list",
        "domain": "vendas",
    },
    {
        "key": "relatorios_vendas",
        "label": "Relatórios (vendas)",
        "url": "https://erp.olist.com/relatorios_sistema?id=3",
        "domain": "vendas",
    },
    {
        "key": "produtos",
        "label": "Produtos",
        "url": "https://erp.olist.com/produtos#list",
        "domain": "cadastros",
    },
    {
        "key": "clientes",
        "label": "Clientes",
        "url": "https://erp.olist.com/contatos#list",
        "domain": "cadastros",
    },
    {
        "key": "estoque",
        "label": "Estoque / depósitos",
        "url": "https://erp.olist.com/depositos#list",
        "domain": "suprimentos",
    },
    {
        "key": "financeiro_contas",
        "label": "Contas a receber",
        "url": "https://erp.olist.com/contas_receber#list",
        "domain": "financas",
    },
)

COST_LABEL_MAP = (
    ("preco_custo", ("preço custo", "preco custo", "preço de custo", "preco de custo")),
    (
        "preco_custo_medio",
        ("custo médio", "custo medio", "preço de custo médio", "preco de custo medio"),
    ),
)


def _now_iso() -> str:
    return datetime.now(TZ).isoformat()


def storage_state_path(data_dir: Path, source_id: str = "tinyerp") -> Path:
    env = (os.getenv("KNOWT_DISCOVERY_UI_STATE") or "").strip()
    if env:
        return Path(env).expanduser().resolve()
    return Path(data_dir) / "discovery" / source_id / "storage_state.json"


def has_storage_state(data_dir: Path, source_id: str = "tinyerp") -> bool:
    p = storage_state_path(data_dir, source_id)
    return p.is_file() and p.stat().st_size > 20


def evidence_dir(data_dir: Path) -> Path:
    path = Path(data_dir) / "evidence"
    path.mkdir(parents=True, exist_ok=True)
    return path


def parse_brl_number(raw: str) -> Optional[float]:
    t = (raw or "").strip()
    if not t:
        return None
    t = t.replace("R$", "").replace(" ", "").strip()
    if not t:
        return None
    if "," in t and "." in t:
        t = t.replace(".", "").replace(",", ".")
    elif "," in t:
        t = t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def normalize_label(text: str) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip().lower())
    t = (
        t.replace("á", "a")
        .replace("à", "a")
        .replace("ã", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )
    return t


def match_cost_api_key(label: str) -> Optional[str]:
    norm = normalize_label(label)
    for api_key, aliases in COST_LABEL_MAP:
        for alias in aliases:
            if normalize_label(alias) == norm or normalize_label(alias) in norm:
                return api_key
    return None


def fields_from_header_value_pairs(
    pairs: List[Tuple[str, str]],
) -> List[Dict[str, Any]]:
    """Mapeia cabeçalhos UI → chaves API; mantém raw + parsed."""
    found: Dict[str, Dict[str, Any]] = {}
    for label, value in pairs:
        api_key = match_cost_api_key(label)
        if not api_key or api_key in found:
            continue
        found[api_key] = {
            "api_key": api_key,
            "ui_label": (label or "").strip(),
            "raw_value": (value or "").strip(),
            "parsed": parse_brl_number(value),
            "found": True,
        }
    out: List[Dict[str, Any]] = []
    for api_key, _ in COST_LABEL_MAP:
        if api_key in found:
            out.append(found[api_key])
        else:
            out.append(
                {
                    "api_key": api_key,
                    "ui_label": None,
                    "raw_value": None,
                    "parsed": None,
                    "found": False,
                }
            )
    return out


def _looks_like_login(url: str, title: str, body_sample: str = "") -> bool:
    blob = f"{url} {title} {body_sample}".lower()
    return any(
        m in blob
        for m in ("login", "entrar", "sign in", "autentic", "accounts.tiny", "oauth")
    )


def _session_looks_authenticated(url: str, title: str) -> bool:
    u = (url or "").lower()
    t = (title or "").lower()
    if _looks_like_login(u, t, ""):
        return False
    if "openid-connect" in u or "/realms/" in u or "accounts.tiny.com.br" in u:
        return False
    if "/login" in u:
        return False
    if "erp.olist.com" in u or "erp.tiny.com.br" in u:
        return True
    return bool(u.startswith("https://"))


def login_interactive(
    data_dir: Path,
    *,
    source_id: str = "tinyerp",
    base_url: str = DEFAULT_BASE_URL,
    timeout_ms: int = 600_000,
    poll_auth: bool = True,
) -> Path:
    """Abre Chromium headed; humano faz login; grava storage_state.

    Se poll_auth=True, espera até a URL parecer autenticada (sem Enter).
    Se False, espera Enter no terminal (modo clássico Fiesta).
    """
    from playwright.sync_api import sync_playwright
    import time

    path = storage_state_path(data_dir, source_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    url = (base_url or DEFAULT_BASE_URL).strip()
    deadline = time.time() + (timeout_ms / 1000.0)

    print(f"[knowt-ui] Abrindo {url}")
    print("[knowt-ui] Faça login até VER o ERP (menus Vendas/Cadastros…).")
    print(f"[knowt-ui] Estado → {path}")
    if poll_auth:
        print("[knowt-ui] Vou gravar sozinho quando detectar o ERP (não precisa Enter).")
    else:
        print("[knowt-ui] Depois volte ao terminal e pressione Enter.")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(locale="pt-BR")
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        while True:
            if poll_auth:
                try:
                    cur = page.url
                    title = (page.title() or "").strip()
                except Exception:
                    cur, title = "", ""
                if _session_looks_authenticated(cur, title):
                    print(f"[knowt-ui] Sessão OK — {cur}")
                    break
                if time.time() >= deadline:
                    context.storage_state(path=str(path))
                    browser.close()
                    raise TimeoutError(
                        "Timeout à espera do login ERP. "
                        f"Última URL: {cur}"
                    )
                time.sleep(1.5)
                continue
            try:
                input()
            except EOFError:
                break
            try:
                cur = page.url
                title = (page.title() or "").strip()
            except Exception:
                cur, title = "", ""
            print(f"[knowt-ui] URL: {cur}")
            print(f"[knowt-ui] Título: {title or '(vazio)'}")
            if _session_looks_authenticated(cur, title):
                break
            print("[knowt-ui] Ainda parece login/SSO — termine e Enter de novo.")
        context.storage_state(path=str(path))
        browser.close()

    if not has_storage_state(data_dir, source_id):
        raise RuntimeError(f"storage_state vazio ou em falta: {path}")
    print(f"[knowt-ui] OK — sessão gravada ({path.stat().st_size} bytes)")
    return path


def parse_cost_pairs_from_body_text(body: str) -> List[Tuple[str, str]]:
    """Fallback: cabeçalho (tabs) + células em linhas subsequentes (UI Olist)."""
    if not body:
        return []
    lines = [ln.strip() for ln in body.splitlines()]
    header_idx = -1
    headers: List[str] = []
    for i, ln in enumerate(lines):
        if not ln:
            continue
        low = normalize_label(ln)
        if "preco custo" not in low or "custo medio" not in low:
            continue
        if "\t" in ln:
            headers = [h.strip() for h in ln.split("\t") if h.strip()]
        else:
            headers = [h.strip() for h in re.split(r"\s{2,}", ln) if h.strip()]
        if len(headers) >= 2:
            header_idx = i
            break
    if header_idx < 0 or not headers:
        return []

    rest = "\n".join(lines[header_idx + 1 :])
    tokens = [t.strip() for t in re.split(r"[\t\n\r]+", rest) if t.strip()]
    ncols = len(headers)
    if len(tokens) < ncols:
        return []
    rows: List[List[str]] = []
    for i in range(0, len(tokens) - ncols + 1, ncols):
        chunk = tokens[i : i + ncols]
        if len(chunk) == ncols:
            rows.append(chunk)
    if not rows:
        return []
    # Preferir a última linha com números nos campos de custo
    best = rows[-1]
    for chunk in reversed(rows):
        if any(re.search(r"\d", c) for c in chunk):
            best = chunk
            break
    return [(headers[j], best[j]) for j in range(ncols)]


def _extract_cost_pairs_from_page(page) -> List[Tuple[str, str]]:
    """Lê tabela da aba custos; fallback para texto do body."""
    raw = page.evaluate(
        """() => {
          const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
          const roots = Array.from(document.querySelectorAll('table, [role=table], [role=grid]'));
          const pairs = [];
          for (const table of roots) {
            const headers = Array.from(
              table.querySelectorAll('thead th, tr th, [role=columnheader]')
            )
              .map((el) => norm(el.innerText))
              .filter(Boolean);
            if (!headers.length) continue;
            const joined = headers.join(' ').toLowerCase();
            if (!joined.includes('custo') && !joined.includes('preço') && !joined.includes('preco')) {
              continue;
            }
            const rows = Array.from(table.querySelectorAll('tbody tr, tr, [role=row]'));
            let best = null;
            for (const row of rows) {
              const cells = Array.from(
                row.querySelectorAll('td, [role=gridcell]')
              ).map((el) => norm(el.innerText));
              if (!cells.length) continue;
              if (cells.some((c) => /\\d/.test(c))) best = cells;
            }
            if (!best) continue;
            const n = Math.min(headers.length, best.length);
            for (let i = 0; i < n; i++) pairs.push([headers[i], best[i]]);
            if (pairs.length) break;
          }
          return pairs;
        }"""
    )
    typed: List[Tuple[str, str]] = []
    for item in raw or []:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            typed.append((str(item[0]), str(item[1])))
    if typed:
        return typed
    try:
        body = page.locator("body").inner_text(timeout=4000)
    except Exception:
        body = ""
    return parse_cost_pairs_from_body_text(body)


def probe_product_costs(
    data_dir: Path,
    *,
    product_id: Optional[str] = None,
    source_id: str = "tinyerp",
    headless: bool = True,
    timeout_ms: int = 90_000,
) -> Dict[str, Any]:
    """Navega ao produto → aba Custos → grava evidence JSON."""
    from playwright.sync_api import sync_playwright

    pid = (
        (product_id or "").strip()
        or (os.getenv("KNOWT_DISCOVERY_PRODUCT_ID") or "").strip()
        or DEFAULT_PRODUCT_ID
    )
    state = storage_state_path(data_dir, source_id)
    out: Dict[str, Any] = {
        "version": 1,
        "kind": "ui_tiny_product_cost",
        "quality": "observation",
        "at": _now_iso(),
        "source_id": source_id,
        "ok": False,
        "login_wall": False,
        "state_path": str(state),
        "product": {"id": pid, "name": None, "url": None, "sku": None},
        "tab": {"key": "custos", "label_seen": None, "ok": False},
        "fields": fields_from_header_value_pairs([]),
        "page": {"url": None, "page_title": None, "body_preview": None},
        "error": None,
        "hint": None,
        "gates_note": (
            "Evidência UI apenas — não altera sales_summary_gates.cost_field."
        ),
    }

    if not has_storage_state(data_dir, source_id):
        out["error"] = "storage_state_missing"
        out["hint"] = (
            "Corre: python scripts/run_discovery_ui.py login "
            "(browser headed; grava sessão em discovery/tinyerp/)"
        )
        return _persist_evidence(data_dir, out, kind="ui_tiny_product_cost")

    product_url = f"https://erp.olist.com/produtos#edit/{pid}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=headless)
            context = browser.new_context(
                locale="pt-BR",
                storage_state=str(state),
            )
            page = context.new_page()
            page.goto(product_url, wait_until="domcontentloaded", timeout=timeout_ms)
            page.wait_for_timeout(1500)
            title = (page.title() or "").strip()
            cur = page.url
            body = ""
            try:
                body = page.locator("body").inner_text(timeout=3000)[:400]
            except Exception:
                body = ""
            out["page"] = {
                "url": cur,
                "page_title": title,
                "body_preview": body[:280] if body else None,
            }
            out["product"]["url"] = cur

            if _looks_like_login(cur, title, body):
                out["login_wall"] = True
                out["error"] = "login_wall"
                out["hint"] = "Renovar sessão: python scripts/run_discovery_ui.py login"
                browser.close()
                return _persist_evidence(data_dir, out, kind="ui_tiny_product_cost")

            # Nome do produto (header)
            try:
                name = page.locator("h1, h2, [class*='titulo'], [class*='title']").first
                if name.count():
                    out["product"]["name"] = re.sub(
                        r"\s+", " ", name.inner_text(timeout=2000)
                    ).strip()[:200]
            except Exception:
                pass

            # Aba custos
            tab_clicked = False
            for sel in (
                "role=tab[name=/custos/i]",
                "text=/^custos$/i",
                "a:has-text('custos')",
                "button:has-text('custos')",
                "[role='tab']:has-text('custos')",
            ):
                try:
                    loc = page.locator(sel).first
                    if loc.count() == 0:
                        continue
                    loc.click(timeout=4000)
                    tab_clicked = True
                    out["tab"]["label_seen"] = "custos"
                    out["tab"]["ok"] = True
                    break
                except Exception:
                    continue

            if not tab_clicked:
                # fallback: URL hash se a UI usar tabs por âncora
                try:
                    page.goto(
                        f"https://erp.olist.com/produtos#edit/{pid}/custos",
                        wait_until="domcontentloaded",
                        timeout=timeout_ms,
                    )
                    page.wait_for_timeout(1200)
                    out["tab"]["label_seen"] = "custos_url_fallback"
                    out["tab"]["ok"] = True
                    tab_clicked = True
                except Exception:
                    out["error"] = "cost_tab_not_found"
                    browser.close()
                    return _persist_evidence(data_dir, out, kind="ui_tiny_product_cost")

            page.wait_for_timeout(2800)
            typed = _extract_cost_pairs_from_page(page) or []
            out["fields"] = fields_from_header_value_pairs(typed)
            out["ok"] = any(f.get("found") for f in out["fields"])
            try:
                full_body = page.locator("body").inner_text(timeout=4000)
                out["page"]["body_preview"] = full_body[:600] if full_body else None
                if not out["ok"]:
                    typed = parse_cost_pairs_from_body_text(full_body)
                    out["fields"] = fields_from_header_value_pairs(typed)
                    out["ok"] = any(f.get("found") for f in out["fields"])
            except Exception:
                full_body = ""
            if not out["ok"]:
                out["error"] = "cost_fields_not_found"
            else:
                out["error"] = None
                # nome a partir do body se vazio
                if not out["product"].get("name") and full_body:
                    for ln in full_body.splitlines():
                        if "Copo" in ln or "Bello" in ln:
                            out["product"]["name"] = ln.strip()[:200]
                            break

            browser.close()
    except Exception as exc:  # noqa: BLE001 — evidência de falha
        out["error"] = f"probe_exception:{type(exc).__name__}:{exc}"
        out["hint"] = "Verificar Playwright chromium e storage_state"

    return _persist_evidence(data_dir, out, kind="ui_tiny_product_cost")


def _clean_texts(texts: List[str], *, limit: int = 80) -> List[str]:
    out: List[str] = []
    seen = set()
    for raw in texts:
        t = re.sub(r"\s+", " ", (raw or "").strip())
        if len(t) < 2 or len(t) > 80:
            continue
        key = t.lower()
        if key in seen:
            continue
        if key in {"entrar", "login", "sair", "logout", "©"}:
            continue
        seen.add(key)
        out.append(t)
        if len(out) >= limit:
            break
    return out


def _collect_nav_labels(page) -> List[str]:
    raw_labels: List[str] = []
    for sel in NAV_SELECTORS:
        try:
            locs = page.locator(sel)
            n = min(locs.count(), 80)
            for i in range(n):
                try:
                    t = locs.nth(i).inner_text(timeout=800)
                except Exception:
                    continue
                if t:
                    raw_labels.append(t)
        except Exception:
            continue
    return _clean_texts(raw_labels)


def _collect_nav_links(page, *, limit: int = 60) -> List[Dict[str, str]]:
    """Href + texto dos links laterais — inventário do sistema."""
    raw = page.evaluate(
        """(limit) => {
          const sels = ['nav a', 'aside a', '[role=navigation] a', '.sidebar a', '[class*=menu] a'];
          const seen = new Set();
          const out = [];
          for (const sel of sels) {
            for (const el of Array.from(document.querySelectorAll(sel))) {
              const href = (el.href || '').trim();
              const text = (el.innerText || '').replace(/\\s+/g, ' ').trim();
              if (!href || href.startsWith('javascript:') || text.length < 2) continue;
              const key = href + '|' + text.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              out.push({ text: text.slice(0, 80), href });
              if (out.length >= limit) return out;
            }
          }
          return out;
        }""",
        limit,
    )
    return list(raw or [])


def _collect_headings(page, *, limit: int = 20) -> List[str]:
    texts: List[str] = []
    for sel in ("h1", "h2", "h3", "[role='heading']"):
        try:
            locs = page.locator(sel)
            n = min(locs.count(), 15)
            for i in range(n):
                try:
                    t = locs.nth(i).inner_text(timeout=600)
                except Exception:
                    continue
                if t:
                    texts.append(t)
        except Exception:
            continue
    return _clean_texts(texts, limit=limit)


def _collect_table_headers(page, *, limit: int = 24) -> List[str]:
    texts: List[str] = []
    for sel in ("table thead th", "table th", "[role='columnheader']"):
        try:
            locs = page.locator(sel)
            n = min(locs.count(), 30)
            for i in range(n):
                try:
                    t = locs.nth(i).inner_text(timeout=600)
                except Exception:
                    continue
                if t:
                    texts.append(t)
        except Exception:
            continue
    return _clean_texts(texts, limit=limit)


def _collect_tabs(page, *, limit: int = 20) -> List[str]:
    texts: List[str] = []
    for sel in ("[role='tab']", ".nav-tabs a", "[class*='tab'] a", "[class*='Tab'] button"):
        try:
            locs = page.locator(sel)
            n = min(locs.count(), 25)
            for i in range(n):
                try:
                    t = locs.nth(i).inner_text(timeout=500)
                except Exception:
                    continue
                if t:
                    texts.append(t)
        except Exception:
            continue
    return _clean_texts(texts, limit=limit)


def _snapshot_page(
    page,
    *,
    key: str,
    label: str,
    domain: str = "",
) -> Dict[str, Any]:
    try:
        body = (page.inner_text("body") or "")[:400]
    except Exception:
        body = ""
    title = (page.title() or "").strip()
    url = page.url
    login = _looks_like_login(url, title, body)
    return {
        "key": key,
        "label": label,
        "domain": domain,
        "url": url,
        "page_title": title,
        "headings": _collect_headings(page),
        "table_headers": _collect_table_headers(page),
        "tabs": _collect_tabs(page),
        "login_wall": login,
        "ok": (not login) and bool(title or body),
        "body_preview": re.sub(r"\s+", " ", body).strip()[:180],
    }


def probe_system(
    data_dir: Path,
    *,
    source_id: str = "tinyerp",
    headless: bool = True,
    timeout_ms: int = 45_000,
    shallow: bool = False,
) -> Dict[str, Any]:
    """Crawl read-only do ERP → dossiê ui_system_map (conhecer o sistema)."""
    from playwright.sync_api import sync_playwright

    state = storage_state_path(data_dir, source_id)
    out: Dict[str, Any] = {
        "version": 1,
        "kind": "ui_system_map",
        "quality": "observation",
        "at": _now_iso(),
        "source_id": source_id,
        "base_url": DEFAULT_BASE_URL,
        "ok": False,
        "login_wall": False,
        "state_path": str(state),
        "nav_labels": [],
        "nav_links": [],
        "pages": [],
        "domains_seen": [],
        "hypothesis": (
            "Mapa UI é evidência de existência/estrutura — não implica capability live."
        ),
        "error": None,
        "hint": None,
    }

    if not has_storage_state(data_dir, source_id):
        out["error"] = "storage_state_missing"
        out["hint"] = "python scripts/run_discovery_ui.py login"
        return _persist_evidence(data_dir, out, kind="ui_system_map")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=headless)
            context = browser.new_context(locale="pt-BR", storage_state=str(state))
            page = context.new_page()
            page.goto(DEFAULT_BASE_URL, wait_until="domcontentloaded", timeout=timeout_ms)
            page.wait_for_timeout(1500)
            title = (page.title() or "").strip()
            cur = page.url
            body = ""
            try:
                body = page.inner_text("body")[:400]
            except Exception:
                body = ""

            if _looks_like_login(cur, title, body):
                out["login_wall"] = True
                out["error"] = "login_wall"
                out["hint"] = "Renovar: python scripts/run_discovery_ui.py login"
                browser.close()
                return _persist_evidence(data_dir, out, kind="ui_system_map")

            out["nav_labels"] = _collect_nav_labels(page)
            out["nav_links"] = _collect_nav_links(page)
            pages: List[Dict[str, Any]] = []
            domains: List[str] = []

            targets = TINY_SYSTEM_TARGETS if not shallow else TINY_SYSTEM_TARGETS[:3]
            for target in targets:
                try:
                    # Expõe submenu quando útil
                    if target["domain"] in {"vendas", "cadastros", "suprimentos", "financas"}:
                        menu_name = {
                            "vendas": "Vendas",
                            "cadastros": "Cadastros",
                            "suprimentos": "Suprimentos",
                            "financas": "Finanças",
                        }.get(target["domain"])
                        if menu_name:
                            try:
                                page.get_by_role("link", name=menu_name, exact=True).first.click(
                                    timeout=2500
                                )
                                page.wait_for_timeout(600)
                            except Exception:
                                pass
                    page.goto(
                        target["url"],
                        wait_until="domcontentloaded",
                        timeout=timeout_ms,
                    )
                    page.wait_for_timeout(1400)
                    snap = _snapshot_page(
                        page,
                        key=target["key"],
                        label=target["label"],
                        domain=target.get("domain") or "",
                    )
                    pages.append(snap)
                    if snap.get("ok") and target.get("domain"):
                        domains.append(str(target["domain"]))
                except Exception as exc:
                    pages.append(
                        {
                            "key": target["key"],
                            "label": target["label"],
                            "domain": target.get("domain"),
                            "url": target["url"],
                            "ok": False,
                            "error": f"{type(exc).__name__}: {exc}"[:180],
                        }
                    )

            browser.close()
            out["pages"] = pages
            out["domains_seen"] = sorted(set(domains))
            pages_ok = sum(1 for pg in pages if pg.get("ok"))
            out["ok"] = pages_ok >= 1 and bool(out["nav_labels"] or title)
            out["pages_ok"] = pages_ok
            out["pages_total"] = len(pages)
            if not out["ok"]:
                out["error"] = "system_probe_weak"
    except Exception as exc:  # noqa: BLE001
        out["error"] = f"probe_exception:{type(exc).__name__}:{exc}"

    return _persist_evidence(data_dir, out, kind="ui_system_map")


def _persist_evidence(
    data_dir: Path,
    evidence: Dict[str, Any],
    *,
    kind: str,
) -> Dict[str, Any]:
    stamp = datetime.now(TZ).strftime("%Y%m%dT%H%M%S")
    folder = evidence_dir(data_dir)
    path = folder / f"{kind}_{stamp}.json"
    latest = folder / f"{kind}_latest.json"
    text = json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")
    latest.write_text(text, encoding="utf-8")
    evidence["path"] = str(path)
    return evidence


def load_latest_product_cost_probe(data_dir: Path) -> Optional[Dict[str, Any]]:
    path = evidence_dir(data_dir) / "ui_tiny_product_cost_latest.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def load_latest_system_map(data_dir: Path) -> Optional[Dict[str, Any]]:
    path = evidence_dir(data_dir) / "ui_system_map_latest.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
