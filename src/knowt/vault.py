"""Cofre mínimo: secret refs → env (sem devolver valores em APIs públicas)."""
from __future__ import annotations

import os
import re
from typing import Optional

_REF_RE = re.compile(r"^[A-Z][A-Z0-9_]{1,120}$")


class VaultError(ValueError):
    pass


def normalize_ref(ref: str) -> str:
    name = (ref or "").strip().upper()
    if name.startswith("ENV:"):
        name = name[4:].strip()
    if not _REF_RE.match(name):
        raise VaultError(f"secret ref inválida: {ref!r}")
    return name


def resolve_secret(ref: str, *, required: bool = True) -> Optional[str]:
    """Resolve ref (nome de env ou ENV:NOME). Nunca logar o valor."""
    key = normalize_ref(ref)
    val = os.getenv(key)
    if val is None or not str(val).strip():
        if required:
            raise VaultError(f"segredo ausente: {key}")
        return None
    return str(val)


def has_secret(ref: str) -> bool:
    try:
        return bool(resolve_secret(ref, required=False))
    except VaultError:
        return False


def public_ref_status(ref: str) -> dict:
    """Metadados seguros para API/chat (sem valor)."""
    try:
        key = normalize_ref(ref)
    except VaultError as exc:
        return {"ref": ref, "ok": False, "error": str(exc)}
    present = has_secret(key)
    return {"ref": key, "ok": present, "present": present}
