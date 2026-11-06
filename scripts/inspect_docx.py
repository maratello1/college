import zipfile
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

files = [
    (r'C:\Users\maratello\.gemini\antigravity\brain\1fb69a3d-c033-41a3-bac7-d42d8d7d5dbe\.user_uploaded\media_1793909641385_85253919.docx', 'Zanyatie_1'),
    (r'C:\Users\maratello\.gemini\antigravity\brain\1fb69a3d-c033-41a3-bac7-d42d8d7d5dbe\.user_uploaded\media_1793909641385_35545d2b.docx', 'Zanyatie_2'),
    (r'C:\Users\maratello\.gemini\antigravity\brain\1fb69a3d-c033-41a3-bac7-d42d8d7d5dbe\.user_uploaded\media_1793909641385_3b3690a0.docx', 'Zanyatiya_3_22')
]

for path, label in files:
    print('==============================')
    print(f'FILE: {label}')
    print('==============================')
    with zipfile.ZipFile(path) as z:
        for fname in z.namelist():
            if fname.endswith('.xml'):
                xml_data = z.read(fname).decode('utf-8', errors='ignore')
                text = re.sub(r'<[^>]+>', ' ', xml_data)
                # condense whitespace
                text = re.sub(r'\s+', ' ', text)
                # find mentions of Макс
                matches = re.finditer(r'([^.?!]{0,100}(?:макс|lms|max|система)[^.?!]{0,100})', text, re.IGNORECASE)
                for m in matches:
                    print(f'[{fname}] -> {m.group(1).strip()}')
