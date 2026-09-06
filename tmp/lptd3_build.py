# -*- coding: utf-8 -*-
"""Dung file JSON import cho "Listening Practice Through Dictation 3".

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
_TR = json.load(open(ROOT / 'lptd3_transcripts.json', encoding='utf-8'))
TRANS = {u['number']: u for u in _TR}
TITLE_FIX = {25: 'The Project'}

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
    for raw in path.read_text(encoding='utf-8').split('\n'):
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
def build_dictation(unit_no, mask_lines, start_order):
    """Doi chieu mat na voi transcript -> (noteBody, [(order, answer)]).

    Token trong spec:
      _            - cho bi khoet (dai bao nhieu tu cung duoc; hai "_" lien nhau
                     coi nhu mot)
      tu           - tu nhin thay trong sach (dau cau go hay khong deu duoc)
      dau cau roi  - moc neo: cum khoet ket thuc o tu mang dau cau do
    """
    turns = TRANS[unit_no]['turns']
    stream = []
    for ti, t in enumerate(turns):
        for w in t['text'].split():
            stream.append((ti, w))

    i, order = 0, start_order
    out_lines, answers = [], []
    pending = False
    blank_line = 0

    def flush(a, b):
        """Bien stream[a..b] thanh o trong, gan vao dong noi cho khoet bat dau."""
        nonlocal order
        for k in range(a, b + 1):
            lead, core, trail = split_word(stream[k][1])
            out_lines[blank_line]['pieces'].append(f'{lead}[[{order}]]{trail}')
            answers.append((order, core))
            order += 1

    for ln in mask_lines:
        s, prefix = ln.strip(), ''
        m = re.match(r'^([MWBG])\s*:\s*(.*)$', s)
        if m:
            spk, s = m.group(1), m.group(2)
            prefix = f'{spk}: '
            # Sang luot thoai moi: cho khoet dang do chi an het luot dang dang.
            if pending and i < len(stream):
                j, t0 = i, stream[i][0]
                while j < len(stream) and stream[j][0] == t0:
                    j += 1
                flush(i, j - 1)
                i, pending = j, False
            if i < len(stream):
                exp = turns[stream[i][0]]['speaker']
                if exp and exp != spk:
                    raise SystemExit(
                        f'Unit {unit_no}: nguoi noi lech - spec "{spk}" / transcript "{exp}"')
        out_lines.append({'prefix': prefix, 'pieces': []})
        cur_line = len(out_lines) - 1
        # Gom token thanh cac "cum nhin thay" (bo dau cau don le, "_" la cho khoet).
        runs = []
        for tok in s.split():
            if re.fullmatch(r'_+', tok):
                runs.append(None)
            elif re.search(r'[A-Za-z0-9]', tok):
                if runs and isinstance(runs[-1], list):
                    runs[-1].append(tok)
                else:
                    runs.append([tok])
            else:
                runs.append(tok[0])                       # moc neo dau cau

        for run in runs:
            if run is None:
                if not pending:
                    pending, blank_line = True, cur_line
                continue
            if isinstance(run, str):                      # dau cau: chot cuoi cum khoet
                if not pending:
                    continue
                j = i
                while j < len(stream) and run not in stream[j][1]:
                    j += 1
                if j >= len(stream):
                    ctx = ' '.join(x[1] for x in stream[i:i + 14])
                    raise SystemExit(
                        f'Unit {unit_no}: khong tim thay dau {run!r} sau tu #{i}\n  ...{ctx}...')
                flush(i, j)
                i, pending = j + 1, False
                continue
            cores = [norm(t) for t in run]
            k = len(cores)
            if pending:
                # Khop CA CUM (nhieu tu lien nhau) de khong bat nham tu trung lap.
                j = i
                while j + k <= len(stream) and \
                        [norm(stream[x][1]) for x in range(j, j + k)] != cores:
                    j += 1
                if j + k > len(stream):
                    ctx = ' '.join(x[1] for x in stream[i:i + 14])
                    raise SystemExit(
                        f'Unit {unit_no}: khong tim thay cum {" ".join(run)!r} sau tu #{i}'
                        f'\n  ...{ctx}...')
                if j > i:
                    flush(i, j - 1)
                i, pending = j, False
            if i + k > len(stream):
                raise SystemExit(f'Unit {unit_no}: mat na DAI hon transcript tai {run!r}')
            got = [norm(stream[x][1]) for x in range(i, i + k)]
            if got != cores:
                ctx = ' '.join(x[1] for x in stream[max(0, i - 6):i + 8])
                raise SystemExit(
                    f'Unit {unit_no}: lech tu #{i} - spec {" ".join(run)!r} / transcript'
                    f' {" ".join(stream[x][1] for x in range(i, min(len(stream), i + k)))!r}'
                    f'\n  ...{ctx}...')
            for x in range(i, i + k):
                out_lines[cur_line]['pieces'].append(stream[x][1])
            i += k

    if pending and i < len(stream):
        flush(i, len(stream) - 1)
        i = len(stream)
        pending = False
    if i != len(stream):
        left = ' '.join(x[1] for x in stream[i:])
        raise SystemExit(f'Unit {unit_no}: mat na THIEU {len(stream) - i} tu cuoi -> {left[:90]!r}')

    body = '\n'.join(l['prefix'] + ' '.join(l['pieces']) for l in out_lines)
    return body, answers


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
    amap = ROOT / 'lptd3_audio_urls.json'
    if amap.exists():
        audio = {int(k): v for k, v in json.load(open(amap, encoding='utf-8')).items()}

    specs = sorted((ROOT / 'lptd3_specs').glob('unit*.txt'))
    if not specs:
        raise SystemExit('Chua co file spec nao trong tmp/lptd3_specs/')

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
        'title': 'Listening Practice Through Dictation 3',
        'skill': 'listening',
        'sourceLabel': 'Listening Practice Through Dictation 3 (Compass Publishing)',
        'description': f'{len(units)} unit luyện nghe chép chính tả, mỗi unit gồm 5 phần A–E '
                       'và có audio riêng.',
        'units': units,
    }
    out = ROOT / 'lptd3_listening.json'
    out.write_text(json.dumps(material, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'\nOK {len(units)} unit, {sum(len(u["questions"]) for u in units)} cau -> {out}')


if __name__ == '__main__':
    main()
