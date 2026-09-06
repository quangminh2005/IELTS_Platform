# -*- coding: utf-8 -*-
"""In transcript cua unit (de doi chieu khi go mat na muc E) va ghep anh Dictation."""
import sys, json, subprocess, textwrap

n = int(sys.argv[1])
TR = {u['number']: u for u in json.load(
    open(r'E:\web_ielts\tmp\lptd3_transcripts.json', encoding='utf-8'))}
u = TR[n]
sys.stdout.reconfigure(encoding='utf-8')
print('UNIT %d  %s' % (n, u['title']))
for t in u['turns']:
    head = (t['speaker'] + ': ') if t['speaker'] else ''
    print(textwrap.fill(head + t['text'], 100, subsequent_indent='   '))
print()
subprocess.run([sys.executable, r'E:\web_ielts\tmp\lptd3\stitch.py', str(n)])
