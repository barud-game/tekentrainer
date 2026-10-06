"""Voegt index.html, hulp.js en alle oefeningen samen tot één bestand: dist/tekentrainer.html.
Oefeningen die (nog) niet bestaan worden overgeslagen."""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()


def inline(m):
    path = os.path.join(ROOT, m.group(1))
    if not os.path.exists(path):
        print("overgeslagen:", m.group(1))
        return ""
    code = open(path, encoding="utf-8").read().replace("</script", "<\\/script")
    return "<script>\n/* " + m.group(1) + " */\n" + code + "\n</script>"


out = re.sub(r'<script src="([^"]+)"></script>', inline, src)
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
dest = os.path.join(ROOT, "dist", "tekentrainer.html")
open(dest, "w", encoding="utf-8").write(out)
print("geschreven:", dest, len(out) // 1024, "KB")
