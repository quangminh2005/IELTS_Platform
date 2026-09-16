# ------------------------------------------------------- ghep mat na Dictation
LABEL_RE = re.compile(r'^([MWBG]\d?)\s*:\s*(.*)$')
BR_RE = re.compile(r'^([^\w\[]*)\[([^\]]+)\]([^\w]*)$', re.S)


def build_dictation(unit_no, mask_lines, start_order):
    """Spec E cua quyen 4: moi dong = luot thoai/doan van, tu bi khoet ghi [tu].
    Tra ve (noteBody, [(order, answer)]); kiem tra chuoi tu khop transcript."""
    turns = TRANS[unit_no]['turns']
    stream = [w for t in turns for w in t['text'].split()]
    i, order = 0, start_order
    out_lines, answers = [], []
    for ln in mask_lines:
        s = ln.strip()
        m = LABEL_RE.match(s)
        prefix = ''
        if m:
            prefix, s = m.group(1) + ': ', m.group(2)
        pieces = []
        for tok in s.split():
            b = BR_RE.match(tok)
            if b:
                lead, core, trail = b.groups()
                word = lead + core + trail
                pieces.append(f'{lead}[[{order}]]{trail}')
                answers.append((order, core))
                order += 1
            else:
                word = tok
                pieces.append(tok)
            if i >= len(stream) or norm(stream[i]) != norm(word):
                ctx = ' '.join(stream[max(0, i - 5):i + 6])
                got = stream[i] if i < len(stream) else '<het>'
                raise SystemExit(f'Unit {unit_no}: lech tu #{i} - spec {word!r} / transcript '
                                 f'{got!r}\n  ...{ctx}...')
            i += 1
        out_lines.append(prefix + ' '.join(pieces))
    if i != len(stream):
        raise SystemExit(f'Unit {unit_no}: spec E THIEU {len(stream) - i} tu cuoi')
    return '\n'.join(out_lines), answers


