# -*- coding: utf-8 -*-
"""Dung lai tung dong cua PDF de: chu + o trong (<n> = gach ngang, n = do rong pt)."""
import pdfplumber, sys
from collections import defaultdict

SRC = r'E:\Listening Practice Through Dictation 3\Listening Practice Through Dictation 3.pdf'


def group_tokens(cs):
    """cs: chars da sap theo x -> danh sach token (text, x0, x1, is_blank)."""
    toks, buf, prev = [], None, None
    for c in cs:
        blank = c['text'] == '_'
        if prev is not None:
            gap = c['x0'] - prev['x1']
            if gap > 1.4 or (prev['text'] == '_') != blank:
                toks.append(buf); buf = None
        if buf is None:
            buf = {'text': c['text'], 'x0': c['x0'], 'x1': c['x1'], 'blank': blank}
        else:
            buf['text'] += c['text']; buf['x1'] = c['x1']
        prev = c
    if buf: toks.append(buf)
    return toks


def build_lines(pg, ytol=3.0):
    chars = [c for c in pg.chars if c['text'].strip()]
    rows = defaultdict(list)
    for c in chars:
        rows[round(c['top'] / ytol)].append(c)
    keys = sorted(rows)
    merged, cur = [], None
    for k in keys:
        if cur is not None and k - cur[-1] <= 1:
            cur.append(k)
        else:
            if cur: merged.append(cur)
            cur = [k]
    if cur: merged.append(cur)

    raw = []
    for grp in merged:
        cs = sorted([c for k in grp for c in rows[k]], key=lambda c: c['x0'])
        raw.append({'top': min(c['top'] for c in cs),
                    'bot': max(c['bottom'] for c in cs),
                    'toks': group_tokens(cs)})

    # hang chi gom gach ngang -> gan vao hang chu gan nhat ben tren/duoi
    out = []
    for r in raw:
        if all(t['blank'] for t in r['toks']):
            host = None
            best = 99
            for o in out[-2:] + []:
                d = abs(r['top'] - o['top'])
                if d < best and d < 12 and not all(t['blank'] for t in o['toks']):
                    host, best = o, d
            if host is not None:
                host['toks'] = sorted(host['toks'] + r['toks'], key=lambda t: t['x0'])
                continue
        out.append(r)

    res = []
    for r in out:
        parts = []
        for t in r['toks']:
            parts.append('<%d>' % round(t['x1'] - t['x0']) if t['blank'] else t['text'])
        res.append((round(r['top'], 1), ' '.join(parts)))
    return res


if __name__ == '__main__':
    pages = [int(x) for x in sys.argv[1:]] or [1]
    with pdfplumber.open(SRC) as pdf:
        for p in pages:
            print('\n========== PAGE %d ==========' % p)
            for top, line in build_lines(pdf.pages[p - 1]):
                print('%7.1f | %s' % (top, line))
