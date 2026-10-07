#!/usr/bin/env python3
"""Build a source offer and a credential-free directory for Railway uploads."""
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
SOURCE = PUBLIC / 'licenses/tweetboy-source.zip'
RELEASE = ROOT / 'work/release'


def build():
    subprocess.run(['npm', 'run', 'build'], cwd=ROOT, check=True)
    files = [ROOT / name for name in (
        'README.md', 'LICENSE', 'package.json', 'package-lock.json', 'tsconfig.json', 'server.py', 'Dockerfile',
        '.gitignore', '.gitattributes', '.dockerignore', '.railwayignore',
    )]
    for pattern in ('*.html', '*.js', '*.css', '*.svg', 'preview.png'):
        files.extend(PUBLIC.glob(pattern))
    files.extend((PUBLIC / 'assets/delta').glob('*'))
    files.extend((ROOT / 'tools/delta-skin').glob('*'))
    files.extend((ROOT / 'tools').glob('*.py'))
    files.extend((ROOT / 'tests').glob('*.py'))
    files.extend((ROOT / 'src').glob('*.ts'))
    files.append(PUBLIC / 'licenses/delta.txt')
    with zipfile.ZipFile(SOURCE, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(set(files)):
            if path.is_file():
                archive.write(path, str(path.relative_to(ROOT)))

    RELEASE.mkdir(parents=True, exist_ok=True)
    for name in ('Dockerfile', 'server.py', '.dockerignore', '.railwayignore'):
        shutil.copy2(ROOT / name, RELEASE / name)
    if (RELEASE / 'public').exists():
        shutil.rmtree(RELEASE / 'public')
    shutil.copytree(PUBLIC, RELEASE / 'public', ignore=shutil.ignore_patterns(
        '.env*', '*.pem', '*.key', '*.gb', '*.gbc', '*.gba', '__pycache__',
    ))
    print('Release ready in work/release. ROMs and credential files are excluded.')


if __name__ == '__main__':
    build()
