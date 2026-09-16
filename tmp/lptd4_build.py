# -*- coding: utf-8 -*-
"""Dung file JSON import cho "Listening Practice Through Dictation 4".

Phien ban quyen 4: spec sinh tu OCR (tmp/lptd4/gen_specs.py + apply_answers.py),
muc E ghi san TUNG TU bi khoet trong ngoac vuong ([tu]) nen khong can doi chieu
mat na nhu quyen 3 - chi kiem tra chuoi tu khop transcript.

Nguon:
  tmp/lptd3_transcripts.json  - transcript chuan, rut thang tu PDF (khong go tay)
  tmp/lptd3_specs/unitNN.txt  - "spec" go tay theo anh scan tung unit

Khac quyen 1-2: muc E (Dictation) cua quyen 3 khoet CA CUM tu tren mot gach dai,
nen spec chi can go NHUNG TU NHIN THAY, dat "_" o cho bi khoet (bao nhieu tu cung
duoc). Script doi chieu voi transcript de biet chinh xac cum nao bi khoet, roi
tach thanh MOT O TRONG CHO MOI TU - giong quyen 1 va 2 tren web.
"""
import json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(r'E:\web_ielts\tmp')
_TR = json.load(open(ROOT / 'lptd4_transcripts.json', encoding='utf-8'))
TRANS = {u['number']: u for u in _TR}
TITLE_FIX = {}

SECTION_META = {
    'A': ('A  New Words', 'Fill in the blanks.'),
    'B': ('B  Understanding the Context', 'Listen and answer the questions.'),
    'C': ('C  Focus on Details', 'Listen and write the missing words.'),
    'E': ('E  Dictation', 'Listen and complete the dialog.'),
}
D_META = {
    'truefalse': ('D  True or False', 'Listen and mark the sentences as T (True) or F (False).'),
    'summary': ('D  Summary', 'Listen and order the sentences from 1-5.'),
    'mc': ('D  Multiple Choice', 'Listen and answer the questions.'),
}


# ---------------------------------------------------------------- doc spec
def parse_spec(path):
    spec = {'box': [], 'A': [], 'B': [], 'C': [], 'D': [], 'E': [], 'dkind': None,
            'einstr': None}
    cur = None
    # Ngoac kep cong (OCR) -> ngoac thang cho dong nhat
    for raw in path.read_text(encoding='utf-8').replace('“', '"').replace('”', '"').split('\n'):
        s = raw.strip()
        if not s or s.startswith('#'):
            continue
        m = re.match(r'^UNIT\s+(\d+)$', s)
        if m:
            spec['unit'] = int(m.group(1))
            continue
        if s.startswith('BOX '):
            spec['box'] = [w.strip() for w in s[4:].split('|') if w.strip()]
            continue
        m = re.match(r'^D\s+(truefalse|summary|mc)$', s)
        if m:
            cur, spec['dkind'] = 'D', m.group(1)
            continue
        m = re.match(r'^E\s+(passage|dialog)$', s)
        if m:
            cur, spec['einstr'] = 'E', m.group(1)
            continue
        if s in ('A', 'B', 'C', 'E'):
            cur = s
            continue
        if cur is None:
            raise SystemExit(f'{path.name}: dong nam ngoai muc -> {s!r}')
        spec[cur].append(s)
    if 'unit' not in spec:
        raise SystemExit(f'{path.name}: thieu dong "UNIT n"')
    return spec


# ------------------------------------------------- tach tu: dau cau / loi tu
WORD_RE = re.compile(r'^(?P<lead>[^\w]*)(?P<core>.*?)(?P<trail>[^\w]*)$', re.S)


def split_word(w):
    m = WORD_RE.match(w)
    return m.group('lead'), m.group('core'), m.group('trail')


def norm(w):
    w = unicodedata.normalize('NFKD', w).lower()
    return re.sub(r"[^a-z0-9']", '', w)


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
        line = ' '.join(pieces)
        # Doan van/luot thoai qua dai (> 20 o) thi tach moi cau mot dong de che do
        # lam tung buoc cat duoc thanh buoc ngan (buoc khong bao gio cat giua dong).
        if line.count('[[') > 20:
            sents = re.split(r'(?<=[.!?])\s+(?=\S)|(?<=[.!?]")\s+(?=\S)', line)
            for k, sent in enumerate(sents):
                out_lines.append((prefix if k == 0 else '') + sent)
        else:
            out_lines.append(prefix + line)
    if i != len(stream):
        raise SystemExit(f'Unit {unit_no}: spec E THIEU {len(stream) - i} tu cuoi')
    return '\n'.join(out_lines), answers


# ------------------------------------------------------------- cac muc khac
GAP_RE = re.compile(r'\[([^\[\]]+)\]')


def build_gap_sentences(lines, start_order, where):
    body, answers = [], []
    order = start_order
    for ln in lines:
        if not GAP_RE.search(ln):
            raise SystemExit(f'{where}: cau khong co [dap an] -> {ln!r}')

        def sub(m):
            nonlocal order
            answers.append((order, m.group(1).strip()))
            order += 1
            return f'[[{order - 1}]]'

        body.append(f'{len(body) + 1}. ' + GAP_RE.sub(sub, ln))
    return '\n'.join(body), answers


def build_mc(lines, start_order, where):
    items, cur = [], None
    for ln in lines:
        if ln.startswith('Q '):
            cur = {'q': ln[2:].strip(), 'opts': [], 'ans': None}
            items.append(cur)
        elif ln[:1] in '+-':
            if cur is None:
                raise SystemExit(f'{where}: lua chon dung truoc cau hoi -> {ln!r}')
            text = ln[1:].strip()
            letter = 'ABCD'[len(cur['opts'])]
            cur['opts'].append(f'{letter}. {text}')
            if ln[0] == '+':
                if cur['ans'] is not None:
                    raise SystemExit(f'{where}: cau "{cur["q"][:40]}" co 2 dap an dung')
                cur['ans'] = f'{letter}. {text}'
        else:
            raise SystemExit(f'{where}: dong la -> {ln!r}')
    out = []
    for k, it in enumerate(items):
        if it['ans'] is None:
            raise SystemExit(f'{where}: cau "{it["q"][:40]}" chua danh dau dap an (+)')
        out.append({'order': start_order + k, 'questionType': 'multiple_choice',
                    'prompt': it['q'], 'options': it['opts'], 'answer': it['ans'], 'points': 1})
    return out


def build_d(lines, kind, start_order, where):
    qs = []
    for k, ln in enumerate(lines):
        o = start_order + k
        if kind == 'truefalse':
            m = re.match(r'^([TF])\s+(.*)$', ln)
            if not m:
                raise SystemExit(f'{where}: dong T/F sai dinh dang -> {ln!r}')
            qs.append({'order': o, 'questionType': 'true_false_not_given',
                       'prompt': m.group(2).strip(), 'options': ['TRUE', 'FALSE'],
                       'answer': 'TRUE' if m.group(1) == 'T' else 'FALSE', 'points': 1})
        else:
            m = re.match(r'^([1-9])\s+(.*)$', ln)
            if not m:
                raise SystemExit(f'{where}: dong Summary sai dinh dang -> {ln!r}')
            qs.append({'order': o, 'questionType': 'multiple_choice',
                       'prompt': m.group(2).strip(), 'options': ['1', '2', '3', '4', '5'],
                       'answer': m.group(1), 'points': 1})
    if kind == 'summary':
        got = sorted(q['answer'] for q in qs)
        if got != [str(i) for i in range(1, len(qs) + 1)]:
            raise SystemExit(f'{where}: thu tu 1..{len(qs)} bi trung/thieu -> {got}')
    return qs


# ------------------------------------------------------------------ mot unit
def build_unit(spec, audio_url=None):
    n = spec['unit']
    tr = TRANS[n]
    where = f'Unit {n}'
    questions, note_parts, gtitles, ginstr = [], [], {}, {}

    def note_q(pairs):
        for o, a in pairs:
            # Tu co dau (fiancée, résumé...) chap nhan ca ban khong dau cho de go.
            plain = unicodedata.normalize('NFKD', a).encode('ascii', 'ignore').decode()
            ans = [a, plain] if plain and plain != a else a
            questions.append({'order': o, 'questionType': 'note_completion',
                              'prompt': f'Câu {o}', 'answer': ans, 'points': 1})

    order = 1
    body, pairs = build_gap_sentences(spec['A'], order, f'{where}/A')
    title, instr = SECTION_META['A']
    gtitles[str(order)] = title
    box = '\n' + '\n'.join([':::box', ' | '.join(spec['box']), ':::']) if spec['box'] else ''
    ginstr[str(order)] = instr + box
    note_parts.append(body)
    note_q(pairs)
    order += len(pairs)

    mcs = build_mc(spec['B'], order, f'{where}/B')
    title, instr = SECTION_META['B']
    gtitles[str(order)], ginstr[str(order)] = title, instr
    questions.extend(mcs)
    order += len(mcs)

    body, pairs = build_gap_sentences(spec['C'], order, f'{where}/C')
    title, instr = SECTION_META['C']
    gtitles[str(order)], ginstr[str(order)] = title, instr
    note_parts.append(body)
    note_q(pairs)
    order += len(pairs)

    kind = spec['dkind']
    ds = build_mc(spec['D'], order, f'{where}/D') if kind == 'mc' \
        else build_d(spec['D'], kind, order, f'{where}/D')
    title, instr = D_META[kind]
    gtitles[str(order)], ginstr[str(order)] = title, instr
    questions.extend(ds)
    order += len(ds)

    body, pairs = build_dictation(n, spec['E'], order)
    title, instr = SECTION_META['E']
    if spec['einstr'] == 'passage':
        instr = 'Listen and complete the passage.'
    gtitles[str(order)], ginstr[str(order)] = title, instr
    note_parts.append(body)
    note_q(pairs)
    order += len(pairs)

    transcript = '\n'.join(
        (f"{t['speaker']}: " if t['speaker'] else '') + t['text'] for t in tr['turns'])
    title_text = TITLE_FIX.get(n, tr['title'])

    return {
        'unitType': 'listening_part',
        'unitNumber': n,
        'title': f"Unit {n}  {title_text}",
        'instructions': 'Nghe audio rồi làm lần lượt các phần A–E. Mỗi chỗ trống điền đúng một từ.',
        'content': 'Nghe audio ở đầu trang rồi làm lần lượt các phần bài tập bên dưới.',
        'defaultTimeLimitMinutes': 20,
        'audioUrl': audio_url,
        'transcript': transcript,
        'metadata': {
            'noteBody': '\n:::break\n'.join(note_parts),
            'groupTitles': gtitles,
            'groupInstructions': ginstr,
            # Man lam bai hien tung buoc (A -> B -> C -> D -> E chia doan) thay vi
            # ca buc tuong ~150 o trong. Xem lib/dictation-steps.ts.
            'stepMode': True,
        },
        'questions': questions,
    }


# ------------------------------------------------------------------- kiem tra
def validate(unit):
    errs = []
    where = unit['title']
    orders = [q['order'] for q in unit['questions']]
    if sorted(orders) != list(range(1, len(orders) + 1)):
        errs.append(f'{where}: order khong lien tuc 1..{len(orders)}')
    blanks = {int(x) for x in re.findall(r'\[\[(\d+)\]\]', unit['metadata']['noteBody'])}
    for q in unit['questions']:
        if q['questionType'] == 'note_completion' and q['order'] not in blanks:
            errs.append(f'{where}: cau {q["order"]} thieu [[{q["order"]}]] trong noteBody')
        ans = q.get('answer')
        if ans in (None, '', []):
            errs.append(f'{where}: cau {q["order"]} thieu answer')
        if q.get('options'):
            opts = [o.strip().lower() for o in q['options']]
            for a in (ans if isinstance(ans, list) else [ans]):
                if str(a).strip().lower() not in opts:
                    errs.append(f'{where}: cau {q["order"]} dap an {a!r} khong co trong options')
        if q['questionType'] == 'note_completion' and isinstance(ans, str) \
                and re.search(r"[^\w'.: $%&-]", ans):
            errs.append(f'{where}: cau {q["order"]} dap an con dau cau -> {ans!r}')
    for b in sorted(blanks - set(orders)):
        errs.append(f'{where}: co [[{b}]] nhung khong co cau {b}')
    return errs


# ------------------------------------------------------------------------ main
def main():
    audio = {}
    amap = ROOT / 'lptd4_audio_urls.json'
    if amap.exists():
        audio = {int(k): v for k, v in json.load(open(amap, encoding='utf-8')).items()}

    specs = sorted((ROOT / 'lptd4_specs_final').glob('unit*.txt'))
    if not specs:
        raise SystemExit('Chua co file spec nao trong tmp/lptd4_specs_final/')

    units, all_errs = [], []
    for p in specs:
        n = int(re.search(r'(\d+)', p.stem).group(1))
        u = build_unit(parse_spec(p), audio.get(n))
        all_errs += validate(u)
        units.append(u)
        nb = sum(1 for q in u['questions'] if q['questionType'] == 'note_completion')
        print(f"  {u['title'][:34]:36s} cau={len(u['questions']):3d} (dien={nb:3d})"
              f" audio={'co' if u['audioUrl'] else 'CHUA'}")

    if all_errs:
        print('\nLOI:')
        for e in all_errs:
            print(' -', e)
        sys.exit(1)

    material = {
        'title': 'Listening Practice Through Dictation 4',
        'skill': 'listening',
        'sourceLabel': 'Listening Practice Through Dictation 4 (Compass Publishing)',
        'description': f'{len(units)} unit luyện nghe chép chính tả, mỗi unit gồm 5 phần A–E '
                       'và có audio riêng.',
        'units': units,
    }
    out = ROOT / 'lptd4_listening.json'
    text = json.dumps(material, ensure_ascii=False, indent=1)
    out.write_text(text, encoding='utf-8')
    print(f'\nOK {len(units)} unit, {sum(len(u["questions"]) for u in units)} cau -> {out}')


if __name__ == '__main__':
    main()
