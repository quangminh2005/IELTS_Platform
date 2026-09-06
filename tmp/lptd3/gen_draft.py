# -*- coding: utf-8 -*-
"""Dung ban nhap spec cho tung unit tu lop chu OCR + dap an + transcript.

Muc A/B/C/D duoc dien san; muc E de trong de go tay theo anh scan.
"""
import pdfplumber, re, json, sys, os
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8')

ROOT = r'E:\web_ielts\tmp'
SRC = r'E:\Listening Practice Through Dictation 3\Listening Practice Through Dictation 3.pdf'
OUTDIR = os.path.join(ROOT, 'lptd3_draft2')
KEY = {u['number']: u for u in json.load(open(os.path.join(ROOT, 'lptd3_key.json'), encoding='utf-8'))}
TR = {u['number']: u for u in json.load(open(os.path.join(ROOT, 'lptd3_transcripts.json'), encoding='utf-8'))}
GAP_MIN = 40


def group_tokens(cs):
    toks, buf, prev = [], None, None
    for c in cs:
        blank = c['text'] == '_'
        if prev is not None and (c['x0'] - prev['x1'] > 1.4 or (prev['text'] == '_') != blank):
            toks.append(buf); buf = None
        if buf is None:
            buf = {'text': c['text'], 'x0': c['x0'], 'x1': c['x1'], 'blank': blank}
        else:
            buf['text'] += c['text']; buf['x1'] = c['x1']
        prev = c
    if buf: toks.append(buf)
    return toks


def page_lines(pg):
    chars = [c for c in pg.chars if c['text'].strip()]
    rows = defaultdict(list)
    for c in chars:
        rows[round(c['top'] / 3.0)].append(c)
    merged, cur = [], None
    for k in sorted(rows):
        if cur is not None and k - cur[-1] <= 1:
            cur.append(k)
        else:
            if cur: merged.append(cur)
            cur = [k]
    if cur: merged.append(cur)
    out = []
    for grp in merged:
        cs = sorted([c for k in grp for c in rows[k]], key=lambda c: c['x0'])
        toks = group_tokens(cs)
        if not toks or all(t['blank'] for t in toks):
            continue
        parts, prev = [], None
        for t in toks:
            if t['blank']:
                parts.append('@')
            else:
                if prev is not None and t['x0'] - prev['x1'] > GAP_MIN:
                    parts.append('@')
                parts.append(t['text'])
            prev = t
        line = ' '.join(parts)
        line = re.sub(r'(@\s*)+', '@ ', line).strip()
        out.append((round(min(c['top'] for c in cs), 1), line))
    return out


SECTION_TITLE = re.compile(
    r'(New Words|Understanding the Context|Focus on Details|True or False|'
    r'Summary|Dictation|Multiple Choice)')
FOOTER = re.compile(r'^(?:\d+\s*)*(?:Unit\s*\d*\s*)?(?:\d+\s*)*$')
BLANKTOK = re.compile(r'^[_\-–—―─]+$')


def junky(t):
    """Dong trang tri / rac OCR: qua it chu cai."""
    letters = sum(1 for c in t if c.isalnum())
    return len(t) > 3 and letters / max(1, len(t)) < 0.45


def clean(t):
    for a, b in (('\u2019', "'"), ('\u2018', "'"), ('\u201c', '"'), ('\u201d', '"'),
                 ('\u2013', '-'), ('\u2014', '-')):
        t = t.replace(a, b)
    return t


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower())


def unit_lines(pdf, n):
    res = []
    for p in (3 * n - 2, 3 * n - 1, 3 * n):
        res.append(('PAGE', p))
        res += page_lines(pdf.pages[p - 1])
    return res


HEAD = [
    ('A', re.compile(r'Fill')),
    ('B', re.compile(r'Listen and answer the question')),
    ('C', re.compile(r'Listen and write the missing')),
    ('D', re.compile(r'Listen and (mark|order) the sentences')),
    ('E', re.compile(r'Listen and complete the')),
]


def split_sections(lines):
    sec, cur = defaultdict(list), None
    for item in lines:
        if item[0] == 'PAGE':
            continue
        text = clean(item[1])
        text = ' '.join('@' if BLANKTOK.match(w) else w for w in text.split())
        text = re.sub(r'(@\s*)+', '@ ', text).strip()
        hit = None
        for name, rx in HEAD:
            if rx.search(text):
                hit = name
                break
        if hit:
            cur = hit
            continue
        if not text or FOOTER.match(text) or junky(text):
            continue
        if not re.search(r'[a-z]', text) and len(text) < 22:
            continue                                    # so trang / chu trang tri
        if len(text) < 75 and (SECTION_TITLE.search(text) or re.search(r'[Tt]rack', text)):
            cur = None
            continue
        if cur:
            sec[cur].append(text)
    return sec


NUM = re.compile(r'^(\d)\s*\.\s*(.*)$')


def join_numbered(lines, want):
    """Gop cac dong thanh <want> muc danh so 1..want."""
    items, cur = {}, None
    for t in lines:
        m = NUM.match(t)
        if m and 1 <= int(m.group(1)) <= want and (int(m.group(1)) == 1 or int(m.group(1)) - 1 in items):
            cur = int(m.group(1))
            items[cur] = m.group(2).strip()
        elif cur:
            items[cur] += ' ' + t.strip()
    return [items.get(i, '') for i in range(1, want + 1)]


def put_blank(sent, answer):
    """Chen [answer] vao vi tri @ (hoac cuoi cau neu khong co)."""
    sent = re.sub(r'\s+', ' ', sent).strip()
    if '@' in sent:
        return sent.replace('@', '[%s]' % answer, 1).replace('@', '').strip()
    m = re.search(r'([.?!]"?)\s*$', sent)
    tail = '   # ?? cho trong doan o cuoi cau'
    if m:
        return (sent[:m.start()].rstrip() + ' [%s]' % answer + sent[m.start():]).strip() + tail
    return sent + ' [%s]' % answer + tail


def from_transcript(n, sent, answer):
    """Cau muc C lay tu transcript: tim cau chua tu dap an, khop voi phan nhin thay."""
    text = ' '.join(t['text'] for t in TR[n]['turns'])
    sents = re.split(r'(?<=[.!?])\s+', text)
    vis = [norm(w) for w in sent.replace('@', ' ').split() if re.search(r'[a-zA-Z]', w)]
    best, score = None, -1
    for s in sents:
        ws = [norm(w) for w in s.split()]
        if norm(answer) not in ws:
            continue
        sc = sum(1 for v in vis if v in ws)
        if sc > score:
            best, score = s, sc
    return best, score, len(vis)


def build(n, pdf):
    sec = split_sections(unit_lines(pdf, n))
    key = KEY.get(n, {}).get('sections', {})
    out = ['UNIT %d' % n]

    ka = key.get('A', {}).get('items', {})
    if ka:
        out.append('BOX ' + ' | '.join(ka[str(i)] for i in range(1, 7)))
    out.append('')
    out.append('A')
    for i, s in enumerate(join_numbered(sec['A'], 6), 1):
        out.append(put_blank(s, ka.get(str(i), '???')))

    out.append('')
    out.append('B')
    kb = key.get('B', {}).get('items', {})
    for i, q in enumerate(join_numbered(sec['B'], 2), 1):
        q = re.sub(r'\s*@\s*', ' ', q)
        parts = re.split(r'\(\s*([a-d])\s*\)', q)
        out.append('Q ' + parts[0].strip())
        letter = (kb.get(str(i), '') or '').strip('()')
        for j in range(1, len(parts) - 1, 2):
            txt = re.sub(r'\s+', ' ', parts[j + 1]).strip()
            out.append(('+' if parts[j] == letter else '-') + ' ' + txt)

    out.append('')
    out.append('C')
    kc = key.get('C', {}).get('items', {})
    for i, s in enumerate(join_numbered(sec['C'], 4), 1):
        ans = kc.get(str(i), '???')
        full, score, nvis = from_transcript(n, s, ans)
        if full and score >= max(2, int(nvis * 0.7)):
            out.append(re.sub(r'\b%s\b' % re.escape(ans), '[%s]' % ans, full, count=1))
        else:
            out.append(put_blank(s, ans) + '   # !! kiem lai')

    out.append('')
    kd = key.get('D', {}).get('items', {})
    kind = 'summary' if any(v.startswith('(') for v in kd.values()) else 'truefalse'
    if not kd:
        kind = '???'
    out.append('D ' + kind)
    for i, s in enumerate(join_numbered(sec['D'], 5), 1):
        v = kd.get(str(i), '?').strip('()')
        out.append('%s %s' % (v, re.sub(r'\s+', ' ', re.sub(r'@', ' ', s)).strip()))

    out.append('')
    out.append('E')
    for s in sec['E']:
        out.append('# ' + s)
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    os.makedirs(OUTDIR, exist_ok=True)
    nums = [int(x) for x in sys.argv[1:]] or list(range(1, 41))
    with pdfplumber.open(SRC) as pdf:
        for n in nums:
            txt = build(n, pdf)
            open(os.path.join(OUTDIR, 'unit%02d.txt' % n), 'w', encoding='utf-8').write(txt)
            print('wrote unit%02d' % n)
