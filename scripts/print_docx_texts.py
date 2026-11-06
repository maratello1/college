import docx
import sys

sys.stdout.reconfigure(encoding='utf-8')

files = [
    (r'C:\Users\maratello\.gemini\antigravity\brain\1fb69a3d-c033-41a3-bac7-d42d8d7d5dbe\.user_uploaded\media_1793909641385_85253919.docx', 'Zanyatie_1'),
    (r'C:\Users\maratello\.gemini\antigravity\brain\1fb69a3d-c033-41a3-bac7-d42d8d7d5dbe\.user_uploaded\media_1793909641385_35545d2b.docx', 'Zanyatie_2'),
    (r'C:\Users\maratello\.gemini\antigravity\brain\1fb69a3d-c033-41a3-bac7-d42d8d7d5dbe\.user_uploaded\media_1793909641385_3b3690a0.docx', 'Zanyatiya_3_22')
]

for path, label in files:
    doc = docx.Document(path)
    print(f'=== DOC: {label} ===')
    for i, p in enumerate(doc.paragraphs):
        if any(w in p.text.lower() for w in ['макс', 'lms']):
            print(f'  P[{i}]: {p.text}')
    for t_idx, table in enumerate(doc.tables):
        for r_idx, row in enumerate(table.rows):
            for c_idx, cell in enumerate(row.cells):
                for p_idx, p in enumerate(cell.paragraphs):
                    if any(w in p.text.lower() for w in ['макс', 'lms']):
                        print(f'  T[{t_idx}] R{r_idx} C{c_idx} P{p_idx}: {p.text}')
