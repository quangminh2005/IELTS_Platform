# -*- coding: utf-8 -*-
"""Dung ban nhap spec cho tung unit quyen 4 tu ket qua OCR (tmp/lptd4/ocr/pNNN.tsv)
+ transcript (tmp/lptd4_transcripts.json).

Khac quyen 3: khong co answer key. Nhung gi suy duoc tu transcript thi dien san:
  - C (Focus on Details): dap an = tu trong transcript nam giua phan nhin thay.
  - E (Dictation): can OCR voi transcript -> tu nao OCR khong thay = bi khoet,
    ghi thanh [tu] (moi tu mot ngoac). Doan van cua bai doc mot nguoi tach theo
    dong thut dau (indent) trong anh scan.
Con lai de dau hoi cho nguoi dien: A ([?] chon tu hop tu), B (danh dau + dap an
dung), D (T/F hoac thu tu 1-5).

Dung: python tmp/lptd4/gen_specs.py 1 2 3   (khong tham so = ca 40 unit)
"""
import sys, os, re, json, difflib
from collections import defaultdict

ROOT = r'E:\web_ielts\tmp'
OCR = os.path.join(ROOT, 'lptd4', 'ocr')
OUT = os.path.join(ROOT, 'lptd4_specs')
TR = {u['number']: u for u in json.load(open(os.path.join(ROOT, 'lptd4_transcripts.json'), encoding='utf-8'))}
sys.stdout.reconfigure(encoding='utf-8')
os.makedirs(OUT, exist_ok=True)

GAP_PX = 550          # khoang trang giua 2 manh chu tren cung dong -> cho khoet
LINE_RIGHT = 5000     # manh cuoi ket thuc truoc muc nay ma khong co dau cau -> khoet cuoi dong
ROW_TOL = 90


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower().replace('\u2019', "'").replace('\u2018', "'"))


def load_rows(pno):
    """Doc OCR mot trang -> danh sach dong; moi dong = list manh (x0, x1, text) theo x."""
    path = os.path.join(OCR, 'p%03d.tsv' % pno)
    frags = []
    for line in open(path, encoding='utf-8'):
        y0, y1, x0, x1, sc, text = line.rstrip('\n').split('\t', 5)
        y0, y1, x0, x1 = int(y0), int(y1), int(x0), int(x1)
        text = text.strip()
        if not text:
            continue
        yc = (y0 + y1) / 2
        if yc < 1100 and pno % 3 != 2:   # dau trang 2,3 cua unit: nhan "Unit" trang tri
            continue
        if yc > 8300:                     # chan trang: "8 Unit 1"
            continue
        frags.append((yc, x0, x1, text, y0, y1))
    frags.sort()
    rows, cur = [], None
    for f in frags:
        if cur is not None and abs(f[0] - cur['yc']) <= ROW_TOL:
            cur['frags'].append(f)
            cur['yc'] = (cur['yc'] * (len(cur['frags']) - 1) + f[0]) / len(cur['frags'])
        else:
            cur = {'yc': f[0], 'frags': [f]}
            rows.append(cur)
    for r in rows:
        r['frags'].sort(key=lambda f: f[1])
        r['text'] = ' '.join(f[3] for f in r['frags'])
        r['x0'] = r['frags'][0][1]
        r['x1'] = r['frags'][-1][2]
    return rows


def find_row(rows, pat, start=0):
    for i in range(start, len(rows)):
        if re.search(pat, rows[i]['text']):
            return i
    return -1


def row_with_gaps(row):
    """Ghep manh cua mot dong, chen [?] o khoang trong lon."""
    parts, prev = [], None
    for f in row['frags']:
        if prev is not None and f[1] - prev[2] > GAP_PX:
            parts.append('[?]')
        parts.append(f[3])
        prev = f
    return ' '.join(parts)


def numbered_items(rows, a, b, gap_lead=True):
    """Gom dong a..b thanh cac muc danh so "N." (dong tiep noi khong co so noi vao).
    Tra ve list (num, text) voi [?] o cho khoet (trong dong, cuoi dong, dau dong)."""
    items = []
    for i in range(a, b):
        row = rows[i]
        text = row_with_gaps(row)
        m = re.match(r'^(\d{1,2})\s*[.\uff0e]\s*(.*)$', text)
        first_is_num = re.fullmatch(r'\d{1,2}\s*[.\uff0e]?', row['frags'][0][3].strip()) is not None
        if m:
            body = m.group(2)
            # so thu tu la manh rieng, cau nam manh sau: neu cach xa -> khoet dau cau
            if first_is_num and len(row['frags']) > 1 and row['frags'][1][1] - row['frags'][0][2] > GAP_PX:
                body = '[?] ' + body.replace('[?] ', '', 1)
            items.append([int(m.group(1)), body, row])
        else:
            if not items:
                continue
            if gap_lead and row['x0'] > 1400:
                text = '[?] ' + text
            items[-1][1] += ' ' + text
            items[-1][2] = row
        # khoet cuoi dong roi moi xuong dong: dong ket thuc som (con cho trong ben
        # phai, ke ca khi co anh chiem goc phai) va khong co dau cau.
        last = items[-1][1].rstrip()
        if gap_lead and row['x1'] < 3400 and not re.search(r'[.!?,;:"]$', last) and not last.endswith('[?]'):
            items[-1][1] = last + ' [?]'
    out = []
    for num, text, _ in items:
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'\s+([,.!?;:])', r'\1', text)
        # khoet cuoi cau: OCR khong thay dau cham sau gach -> cau ket thuc khong co dau cau
        if gap_lead and not re.search(r'[.!?"\u201d)]$', text) and not text.endswith('[?]'):
            text += ' [?].'
        out.append((num, text))
    return out


def tokens_of(text):
    return [t for t in re.split(r'\s+', text) if t]


# ------------------------------------------------------------------ muc C
def solve_c(sentence, unit_no):
    """[?] trong cau lay tu transcript. Tra ve cau da thay [?] bang [dap an]."""
    stream = []
    for t in TR[unit_no]['turns']:
        stream += tokens_of(t['text'])
    snorm = [norm(w) for w in stream]
    parts = sentence.split('[?]')
    if len(parts) == 1:
        return sentence
    # tim vi tri prefix (toi da 5 tu cuoi cua phan truoc) trong transcript
    out = parts[0]
    pos = 0
    for k in range(1, len(parts)):
        pre = [norm(w) for w in tokens_of(parts[k - 1]) if norm(w)]
        post = [norm(w) for w in tokens_of(parts[k]) if norm(w)]
        pre = pre[-5:]
        post = post[:4]
        start = None
        if pre:
            for i in range(pos, len(snorm) - len(pre) + 1):
                if snorm[i:i + len(pre)] == pre:
                    start = i + len(pre)
                    break
        else:
            start = pos
        if start is None:
            out += '[?]' + parts[k]
            continue
        end = None
        if post:
            for j in range(start, min(len(snorm), start + 12) - len(post) + 1):
                if snorm[j:j + len(post)] == post:
                    end = j
                    break
        else:
            # toi cuoi cau trong transcript
            for j in range(start, len(stream)):
                if re.search(r'[.!?]$', stream[j]):
                    end = j + 1
                    break
        if end is None or end <= start:
            out += '[?]' + parts[k]
            continue
        ans = ' '.join(stream[start:end])
        ans = re.sub(r'^[^\w]+|[^\w]+$', '', ans)
        out += '[' + ans + ']' + parts[k]
        pos = end
    return out


def lcs_blocks(x, y):
    """LCS chuan giua hai day token -> list (i, j, 1) cac cap khop, theo thu tu."""
    n, m = len(x), len(y)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        xi = x[i]
        row, nxt = dp[i], dp[i + 1]
        for j in range(m - 1, -1, -1):
            if xi == y[j]:
                row[j] = nxt[j + 1] + 1
            else:
                row[j] = nxt[j] if nxt[j] >= row[j + 1] else row[j + 1]
    i = j = 0
    out = []
    while i < n and j < m:
        if x[i] == y[j]:
            out.append((i, j, 1)); i += 1; j += 1
        elif dp[i + 1][j] >= dp[i][j + 1]:
            i += 1
        else:
            j += 1
    return out


# ------------------------------------------------------------------ muc C (v2)
def sentences_of(unit_no):
    """Tach transcript thanh cau (giu nguyen chu)."""
    text = ' '.join(t['text'] for t in TR[unit_no]['turns'] if not re.fullmatch(r'Part [IVX]+', t['text']))
    parts = re.split(r"(?<=[.!?])\s+(?=[\"A-Z0-9]|'[A-Z])", text)
    return [p.strip() for p in parts if p.strip()]


def fuzzy_fill(tn, on, blocks, visible, t_of_o):
    """Lan 2 sau LCS: token OCR chua khop gan giong tu trong khoang trong -> nhin thay."""
    prev_a, prev_b = 0, 0
    for a_, b_, size in blocks + [(len(tn), len(on), 0)]:
        gap_t = list(range(prev_a, a_)); gap_o = list(range(prev_b, b_))
        for oi in gap_o:
            best, best_r = None, 0.0
            for ti in gap_t:
                if visible[ti]:
                    continue
                if re.sub(r'^1', 'i', on[oi]) == tn[ti] or (on[oi] in ('1', 'l', '|') and tn[ti] == 'i'):
                    best, best_r = ti, 1.0; break
                r = difflib.SequenceMatcher(None, tn[ti], on[oi]).ratio()
                if r > best_r:
                    best, best_r = ti, r
            if best is not None and (best_r >= 0.75 and len(tn[best]) >= 2 or best_r == 1.0):
                visible[best] = True; t_of_o[oi] = best
        prev_a, prev_b = a_ + size, b_ + size


def solve_c2(ocr_text, unit_no):
    """Cau muc C lay tu transcript: chon cau khop nhat voi chu OCR, tu khong thay = khoet."""
    on = [norm(w) for w in tokens_of(ocr_text.replace('[?]', ' ')) if norm(w)]
    sents = sentences_of(unit_no)
    cands = [(i, i) for i in range(len(sents))] + [(i, i + 1) for i in range(len(sents) - 1)]
    best, best_score = None, -1e9
    for i, j in cands:
        words = tokens_of(' '.join(sents[i:j + 1]))
        tn = [norm(w) for w in words]
        blocks = lcs_blocks(tn, on)
        matched = sum(b[2] for b in blocks)
        score = matched - 0.6 * (len(tn) - matched) - 0.3 * (len(on) - matched)
        if score > best_score:
            best, best_score = (words, tn, blocks), score
    words, tn, blocks = best
    visible = [False] * len(tn); t_of_o = {}
    for a_, b_, size in blocks:
        for k in range(size):
            visible[a_ + k] = True; t_of_o[b_ + k] = a_ + k
    fuzzy_fill(tn, on, blocks, visible, t_of_o)
    out, runs, buf, trail_buf = [], 0, [], ''
    for w, v in zip(words, visible):
        if v:
            if buf:
                out.append('[' + ' '.join(buf) + ']' + trail_buf); buf = []
            out.append(w)
        else:
            lead, core, trail = re.match(r"^([^\w]*)(.*?)([^\w]*)$", w, re.S).groups()
            if not buf:
                runs += 1
            buf.append(core); trail_buf = trail
    if buf:
        out.append('[' + ' '.join(buf) + ']' + trail_buf)
    line = ' '.join(out)
    line = re.sub(r'\s+([,.!?;:])', r'', line)
    return line, runs


# ------------------------------------------------------------------ muc E
LABEL_RE = re.compile(r'^([MWBG]\d?)\s*:\s*')


def solve_e(rows_list, unit_no, kind):
    """rows_list: cac dong OCR cua muc E (trang 2 + 3). Tra ve list dong spec."""
    turns = TR[unit_no]['turns']
    stream = []            # (turn_idx, word)
    for ti, t in enumerate(turns):
        for w in tokens_of(t['text']):
            stream.append((ti, w))
    tnorm = [norm(w) for _, w in stream]

    ocr_tokens = []        # (norm, row_idx, is_first_in_row)
    indent_rows = set()
    for ri, row in enumerate(rows_list):
        first = True
        # thut dau dong = doan van moi (bai doc mot nguoi)
        if 950 <= row['x0'] <= 1350:
            indent_rows.add(ri)
        for f in row['frags']:
            text = LABEL_RE.sub('', f[3])
            if re.fullmatch(r'Part\s+[IVX]+', text.strip()):
                continue
            for w in tokens_of(text):
                n = norm(w)
                if n:
                    ocr_tokens.append((n, ri, first))
                    first = False
    onorm = [t[0] for t in ocr_tokens]

    # LCS that (quy hoach dong) - difflib chon khoi dai nhat truoc nen hay lech
    # o cac tu ngan lap lai ("or a", "are").
    blocks = lcs_blocks(tnorm, onorm)
    visible = [False] * len(stream)
    # "Part I/II" la tieu de, luon hien ro
    for idx, (ti, w) in enumerate(stream):
        if re.fullmatch(r'Part [IVX]+', turns[ti]['text']):
            visible[idx] = True
    t_of_o = {}
    for a, b, size in blocks:
        for k in range(size):
            visible[a + k] = True
            t_of_o[b + k] = a + k
    # lan 2: token OCR chua khop, gan giong mot tu trong khoang trong tuong ung -> nhin thay
    prev_a, prev_b = 0, 0
    for a, b, size in blocks:
        gap_t = list(range(prev_a, a))
        gap_o = list(range(prev_b, b))
        for oi in gap_o:
            best, best_r = None, 0.0
            for ti in gap_t:
                if visible[ti]:
                    continue
                # OCR hay doc chu I thanh so 1 ("1'm", "1'll")
                if re.sub(r'^1', 'i', onorm[oi]) == tnorm[ti]:
                    best, best_r = ti, 1.0
                    break
                r = difflib.SequenceMatcher(None, tnorm[ti], onorm[oi]).ratio()
                if r > best_r:
                    best, best_r = ti, r
            if best is None and onorm[oi] in ('1', 'l', '|') and 'i' in [tnorm[t] for t in gap_t if not visible[t]]:
                best, best_r = next(t for t in gap_t if not visible[t] and tnorm[t] == 'i'), 1.0
            if best is not None and (best_r >= 0.75 and len(tnorm[best]) >= 2 or best_r == 1.0):
                visible[best] = True
                t_of_o[oi] = best
        prev_a, prev_b = a + size, b + size

    # ngat doan theo dong thut dau: tu dau tien cua dong do phai mo dau mot cau
    # (tu truoc no ket thuc bang dau cau) - de khong nham dong bat dau bang gach khoet.
    breaks = set()
    for oi, (n, ri, first) in enumerate(ocr_tokens):
        if first and ri in indent_rows and oi in t_of_o:
            ti = t_of_o[oi]
            if ti > 0 and re.search(r'[.!?"]$', stream[ti - 1][1].replace('”', '"')):
                breaks.add(ti)

    # dung dong spec: moi luot thoai mot dong (bai doc: khong nhan nguoi noi);
    # trong luot, ngat doan tai `breaks` (dong moi khong lap nhan).
    lines = []
    cur_ti, buf, labeled = None, [], True
    def flush(ti, with_label):
        if buf:
            spk = turns[ti]['speaker'] if (kind == 'dialog' and with_label) else ''
            lines.append(((spk + ': ') if spk else '') + ' '.join(buf))
    for idx, (ti, w) in enumerate(stream):
        if ti != cur_ti:
            if cur_ti is not None:
                flush(cur_ti, labeled)
            cur_ti, buf, labeled = ti, [], True
        elif idx in breaks and buf:
            flush(ti, labeled)
            buf, labeled = [], False
        if visible[idx]:
            buf.append(w)
        else:
            lead, core, trail = re.match(r"^([^\w]*)(.*?)([^\w]*)$", w, re.S).groups()
            buf.append(f'{lead}[{core}]{trail}')
    if cur_ti is not None:
        flush(cur_ti, labeled)
    n_blank = sum(1 for v in visible if not v)
    unmatched_ocr = [ocr_tokens[i][0] for i in range(len(ocr_tokens)) if i not in t_of_o]
    return lines, n_blank, len(stream), unmatched_ocr


# ------------------------------------------------------------------ mot unit
def gen_unit(n):
    p1, p2, p3 = 3 * n + 5, 3 * n + 6, 3 * n + 7
    r1, r2, r3 = load_rows(p1), load_rows(p2), load_rows(p3)
    notes = []
    tr = TR[n]

    # --- A: hop tu + cau
    i_unit = find_row(r1, r'^Unit\s*\d')
    i_fill = find_row(r1, r'Fill')
    i_b = find_row(r1, r'Understanding')
    i_c = find_row(r1, r'Focus on Details')
    i_cinstr = find_row(r1, r'Listen and write', i_c if i_c >= 0 else 0)
    i_binstr = find_row(r1, r'Listen and answer', i_b if i_b >= 0 else 0)
    box = []
    for row in r1[i_unit + 1:i_fill]:
        for f in row['frags']:
            if f[1] > 3600:
                for w in re.split(r'\s+', f[3].strip()):
                    if w.strip():
                        box.append(w.strip())
    if len(box) != 6:
        notes.append(f'# CHU Y: hop tu co {len(box)} tu (mong 6): {box}')
    a_items = numbered_items(r1, i_fill + 1, i_b)
    if [k for k, _ in a_items] != [1, 2, 3, 4, 5, 6]:
        notes.append(f'# CHU Y: muc A danh so {[k for k, _ in a_items]}')

    # --- B
    b_rows = r1[i_binstr + 1:i_c]
    b_lines, cur = [], None
    for row in b_rows:
        for f in row['frags']:
            text = f[3].strip()
            m = re.match(r'^(\d)\s*[.\uff0e]\s*(.*)$', text)
            if m and f[1] < 900:
                b_lines.append('Q ' + m.group(2)); cur = 'q'; continue
            m = re.match(r'^\(?([a-d])\)\s*(.*)$', text)
            if m:
                b_lines.append('- ' + m.group(2)); cur = 'o'; continue
            if b_lines:
                b_lines[-1] += ' ' + text
    # --- C
    c_items = numbered_items(r1, i_cinstr + 1, len(r1))
    if [k for k, _ in c_items] != [1, 2, 3, 4]:
        notes.append(f'# CHU Y: muc C danh so {[k for k, _ in c_items]}')
    c_lines = []
    for _, t in c_items:
        line, runs = solve_c2(t, n)
        if runs != 1:
            notes.append(f'# CHU Y: muc C co cau {runs} cho khoet -> {line[:60]}')
        c_lines.append(line)

    # --- D
    i_d = find_row(r2, r'True or False|Summary|Multiple Choice')
    dkind = 'truefalse'
    if i_d >= 0 and 'Summary' in r2[i_d]['text']:
        dkind = 'summary'
    elif i_d >= 0 and 'Multiple' in r2[i_d]['text']:
        dkind = 'mc'
    i_dinstr = find_row(r2, r'^Listen', i_d + 1 if i_d >= 0 else 0)
    i_e = find_row(r2, r'Dictation')
    d_items = numbered_items(r2, i_dinstr + 1, i_e, gap_lead=False)
    if [k for k, _ in d_items] != [1, 2, 3, 4, 5]:
        notes.append(f'# CHU Y: muc D danh so {[k for k, _ in d_items]}')
    d_lines = ['? ' + re.sub(r'\s*\[\?\]\s*', ' ', t).strip() for _, t in d_items]

    # --- E
    i_einstr = find_row(r2, r'Listen and complete', i_e)
    einstr = r2[i_einstr]['text'] if i_einstr >= 0 else ''
    e_rows = r2[i_einstr + 1:] + r3
    kind = 'dialog' if 'dialog' in einstr.lower() else 'passage'
    e_lines, n_blank, n_words, unmatched = solve_e(e_rows, n, kind)

    out = [f'UNIT {n}', f'# {tr["title"]}', f'BOX ' + ' | '.join(box), '']
    out += notes
    out += ['A'] + [t for _, t in a_items] + ['']
    out += ['B'] + b_lines + ['']
    out += ['C'] + c_lines + ['']
    out += [f'D {dkind}'] + d_lines + ['']
    out += [f'E {kind}', f'# khoet {n_blank}/{n_words} tu; OCR khong khop: {" ".join(unmatched[:30])}']
    out += e_lines
    open(os.path.join(OUT, 'unit%02d.txt' % n), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(f'unit {n:2d}: box={len(box)} A={len(a_items)} B={sum(1 for l in b_lines if l.startswith("Q"))}q '
          f'C={len(c_items)} D={dkind}/{len(d_items)} E={kind} khoet {n_blank}/{n_words} '
          f'unmatched={len(unmatched)} {"; ".join(notes)}')


if __name__ == '__main__':
    units = [int(a) for a in sys.argv[1:]] or range(1, 41)
    for n in units:
        gen_unit(n)
