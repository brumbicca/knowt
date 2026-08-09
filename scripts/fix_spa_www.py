#!/usr/bin/env python3
from pathlib import Path
import shutil
import subprocess

src = Path("/root/knowt/frontend/dist")
dst = Path("/var/www/knowt")
dst.mkdir(parents=True, exist_ok=True)
for p in list(dst.iterdir()):
    if p.is_dir():
        shutil.rmtree(p)
    else:
        p.unlink()
for p in src.iterdir():
    target = dst / p.name
    if p.is_dir():
        shutil.copytree(p, target)
    else:
        shutil.copy2(p, target)
subprocess.check_call(["chown", "-R", "www-data:www-data", str(dst)])
subprocess.check_call(["chmod", "-R", "a+rX", str(dst)])
for f in (
    Path("/etc/nginx/sites-available/knowt"),
    Path("/root/knowt/deploy/nginx-knowt-spa.conf"),
):
    if f.exists():
        f.write_text(f.read_text().replace("/root/knowt/frontend/dist", "/var/www/knowt"))
print("spa_www_ok")
