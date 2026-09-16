# -*- coding: utf-8 -*-
import sys, json, re, textwrap
sys.stdout.reconfigure(encoding='utf-8')
TR = {u['number']: u for u in json.load(open(r'E:\web_ielts\tmp\lptd4_transcripts.json', encoding='utf-8'))}
for n in [int(a) for a in sys.argv[1:]]:
    spec = open(r'E:\web_ielts\tmp\lptd4_specs\unit%02d.txt' % n, encoding='utf-8').read()
    head = spec.split('\nE ')[0]
    head = re.sub(r'\nC\n.*?\n\n', '\n', head, flags=re.S)
    print('=' * 20, 'UNIT', n, TR[n]['title'])
    print(head.strip())
    print('--- transcript')
    for t in TR[n]['turns']:
        print(textwrap.fill(((t['speaker'] + ': ') if t['speaker'] else '') + t['text'], 130, subsequent_indent='  '))
    print()
