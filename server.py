#!/usr/bin/env python3
"""Static game delivery with crawler-visible Player Cards. No ROM upload API."""
import html
import os
import re
from io import BytesIO
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
GAMES = {'library': 'Tweetboy'}
FRAME_POLICY = "frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com"


def public_url():
    value = os.environ.get('PUBLIC_URL', 'http://127.0.0.1:8765').rstrip('/')
    parts = urlsplit(value)
    local = parts.hostname in ('127.0.0.1', 'localhost')
    if (parts.scheme != 'https' and not (local and parts.scheme == 'http')) or not parts.netloc or parts.path or parts.query or parts.fragment or parts.username:
        raise ValueError('PUBLIC_URL must be an HTTPS origin (localhost HTTP is allowed for development).')
    return value


def player_page(game, share_path=None):
    origin = public_url()
    share_url = origin + (share_path if share_path is not None else '/r/' + game)
    title = 'Tweetboy - Play gameboy games right inside of X'
    description = 'Play a pocket Game Boy right in your feed. Touch controls, keyboard controls, and local saves.'
    image = origin + '/preview.png'
    tags = {'twitter:card': 'player', 'twitter:title': title,
            'twitter:description': description, 'twitter:image': image,
            'twitter:image:alt': GAMES[game] + ' on Tweetboy',
            'twitter:player': origin + '/play/' + game,
            'twitter:player:width': '600', 'twitter:player:height': '600',
            'og:type': 'website', 'og:title': title, 'og:description': description,
            'og:image': image, 'og:url': share_url}
    site = os.environ.get('TWITTER_SITE', '').strip()
    if site:
        tags['twitter:site'] = site
    metadata = '\n'.join('<meta ' + ('property' if key.startswith('og:') else 'name') +
                         '="' + key + '" content="' + html.escape(value, quote=True) + '">' for key, value in tags.items())
    metadata += '\n<link rel="canonical" href="' + html.escape(share_url, quote=True) + '">'
    source = (ROOT / 'public/index.html').read_text()
    return source.replace('<title>Tweetboy</title>', '<title>' + html.escape(title) + '</title>\n' + metadata).encode()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'public'), **kwargs)

    def end_headers(self):
        # Nested emulator frames also need to permit the full X ancestor chain.
        self.send_header('Content-Security-Policy', FRAME_POLICY)
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def send_head(self):
        path = urlsplit(self.path).path
        # Never expose dotfiles or follow a symlink outside the public directory.
        public = (ROOT / 'public').resolve()
        target = Path(self.translate_path(self.path)).resolve()
        if not target.is_relative_to(public) or any(part.startswith('.') for part in target.relative_to(public).parts):
            self.send_error(404)
            return None
        match = re.fullmatch(r'/(r|play)/([a-z0-9-]+)/?', path)
        if match or path in ('/', '/index.html'):
            game = match[2] if match else 'library'
            if game not in GAMES:
                self.send_error(404, 'Unknown cartridge')
                return None
            content = player_page(game, None if match else "/")
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            return BytesIO(content)
        if path.startswith(('/r/', '/play/')):
            self.send_error(404, 'Unknown cartridge')
            return None
        return super().send_head()


if __name__ == '__main__':
    public_url()  # Fail immediately on an invalid deployment origin.
    port = int(os.environ.get('PORT', '8765'))
    server = ThreadingHTTPServer((os.environ.get('BIND_HOST', '127.0.0.1'), port), Handler)
    print(f'Tweetboy → http://127.0.0.1:{port}', flush=True)
    server.serve_forever()
