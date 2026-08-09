"""Discovery UI (Playwright) — evidência observável Tiny, sem publish.

Piloto: login interactivo → storage_state; probe da aba Custos de um produto.
Não auto-preenche `sales_summary_gates.cost_field` (decisão humana).
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
) -> Path:
    """Abre Chromium headed; humano faz login; grava storage_state."""
    from playwright.sync_api import sync_playwright

    path = storage_state_path(data_dir, source_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    url = (base_url or DEFAULT_BASE_URL).strip()

    print(f"[knowt-ui] Abrindo {url}")
    print("[knowt-ui] Faça login até VER o ERP (menus Vendas/Cadastros…).")
    print("[knowt-ui] Depois volte ao terminal e pressione Enter.")
    print(f"[knowt-ui] Estado → {path}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(locale="pt-BR")
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        while True:
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


def _extract_cost_pairs_from_page(page) -> List[Tuple[str, str]]:
    """Lê tabela da aba custos: cabeçalhos × última linha com valores."""
    return page.evaluate(
        """() => {
          const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
          const tables = Array.from(document.querySelectorAll('table'));
          const pairs = [];
          for (const table of tables) {
            const headers = Array.from(table.querySelectorAll('thead th, tr th'))
              .map((el) => norm(el.innerText))
              .filter(Boolean);
            if (!headers.length) continue
            const joined = headers.join(' ').toLowerCase();
            if (!joined.includes('custo') && !joined.includes('preço') && !joined.includes('preco')) {
              continue;
            }
            const rows = Array.from(table.querySelectorAll('tbody tr'));
            let best = null;
            for (const row of rows) {
              const cells = Array.from(row.querySelectorAll('td')).map((el) => norm(el.innerText));
              if (!cells.length) continue;
              const hasNum = cells.some((c) => /\\d/.test(c));
              if (hasNum) best = cells;
            }
            if (!best) continue;
            const n = Math.min(headers.length, best.length);
            for (let i = 0; i < n; i++) {
              pairs.push([headers[i], best[i]]);
            }
            if (pairs.length) break;
          }
          // fallback: labels próximos a inputs com "custo"
          if (!pairs.length) {
            const labels = Array.from(document.querySelectorAll('label, th, dt, .label, [class*="label"]'));
            for (const el of labels) {
              const text = norm(el.innerText);
              if (!/custo/i.test(text)) continue;
              let val = '';
              const forId = el.getAttribute('for');
              if (forId) {
                const inp = document.getElementById(forId);
                if (inp) val = norm(inp.value || inp.innerText);
              }
              if (!val) {
                const sib = el.nextElementSibling;
                if (sib) val = norm(sib.value || sib.innerText);
              }
              if (text && val) pairs.push([text, val]);
            }
          }
          return pairs;
        }"""
    )


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
        return _persist_evidence(data_dir, out)

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
                return _persist_evidence(data_dir, out)

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
                    return _persist_evidence(data_dir, out)

            page.wait_for_timeout(1200)
            pairs = _extract_cost_pairs_from_page(page) or []
            # pairs may come as list of lists from JS
            typed: List[Tuple[str, str]] = []
            for item in pairs:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    typed.append((str(item[0]), str(item[1])))
            out["fields"] = fields_from_header_value_pairs(typed)
            out["ok"] = any(f.get("found") for f in out["fields"])
            if not out["ok"]:
                out["error"] = "cost_fields_not_found"
                try:
                    out["page"]["body_preview"] = page.locator("body").inner_text(
                        timeout=3000
                    )[:400]
                except Exception:
                    pass

            browser.close()
    except Exception as exc:  # noqa: BLE001 — evidência de falha
        out["error"] = f"probe_exception:{type(exc).__name__}:{exc}"
        out["hint"] = "Verificar Playwright chromium e storage_state"

    return _persist_evidence(data_dir, out)


def _persist_evidence(data_dir: Path, evidence: Dict[str, Any]) -> Dict[str, Any]:
    stamp = datetime.now(TZ).strftime("%Y%m%dT%H%M%S")
    folder = evidence_dir(data_dir)
    path = folder / f"ui_tiny_product_cost_{stamp}.json"
    latest = folder / "ui_tiny_product_cost_latest.json"
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
