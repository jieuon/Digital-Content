"""
build.py — dev.html + js/ 폴더의 모듈들을 하나로 묶어 index.html을 만듭니다.
(index.html은 더블클릭(file://)으로 열어도 작동합니다.)

코드를 수정했다면:  python tools/build.py
"""
import os, re, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRY = 'js/main.js'

IMPORT_RE = re.compile(r"^import\s+(.+?)\s+from\s+'([^']+)';\s*$", re.M)
EXPORT_RE = re.compile(r"^export\s+(?:async\s+)?(?:const|let|class|function)\s+(\w+)", re.M)

order, seen, ext_imports = [], set(), {}

def norm(base, rel):
    return os.path.normpath(os.path.join(os.path.dirname(base), rel)).replace('\\', '/')

def visit(path):
    if path in seen: return
    seen.add(path)
    src = open(os.path.join(ROOT, path), encoding='utf-8').read()
    for spec, frm in IMPORT_RE.findall(src):
        if frm.startswith('.'): visit(norm(path, frm))
    order.append(path)

visit(ENTRY)
modname = lambda p: '__m_' + re.sub(r'\W', '_', p)

parts = []
for path in order:
    src = open(os.path.join(ROOT, path), encoding='utf-8').read()
    exports = EXPORT_RE.findall(src)
    local = []
    def repl(m):
        spec, frm = m.group(1), m.group(2)
        if frm.startswith('.'):
            names = spec.strip()[1:-1].split(',')
            binds = []
            for n in names:
                n = n.strip()
                if not n: continue
                if ' as ' in n:
                    a, b = [x.strip() for x in n.split(' as ')]
                    binds.append(f'{a}: {b}')
                else: binds.append(n)
            local.append(f"const {{ {', '.join(binds)} }} = {modname(norm(path, frm))};")
            return ''
        ext_imports.setdefault(frm, set()).add(spec.strip())
        return ''
    body = IMPORT_RE.sub(repl, src)
    body = re.sub(r'^export\s+', '', body, flags=re.M)
    parts.append(f"// ---- {path}\nconst {modname(path)} = (() => {{\n" + '\n'.join(local) + '\n' + body +
                 f"\nreturn {{ {', '.join(exports)} }};\n}})();\n")

head = []
for frm, specs in ext_imports.items():
    named, star = set(), None
    for sp in specs:
        if sp.startswith('* as'): star = sp
        else: named.update(x.strip() for x in sp.strip()[1:-1].split(',') if x.strip())
    if star: head.append(f"import {star} from '{frm}';")
    if named: head.append(f"import {{ {', '.join(sorted(named))} }} from '{frm}';")

bundle = '\n'.join(head) + '\n\n' + '\n'.join(parts)
bundle = bundle.replace('</script', '<\\/script')
html = open(os.path.join(ROOT, 'dev.html'), encoding='utf-8').read()
tag = '<script type="module" src="js/main.js"></script>'
assert tag in html
html = html.replace(tag, '<script type="module">\n/* bundled by tools/build.py — source: js/ */\n' + bundle + '\n</script>')
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(html)
print('built index.html from', len(order), 'modules')
