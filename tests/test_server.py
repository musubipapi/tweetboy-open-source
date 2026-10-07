"""Real HTTP checks that run without commercial ROMs or external services."""
import http.client
import os
import shutil
import tempfile
import threading
import unittest
from html.parser import HTMLParser
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

import server


class MetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.tags[attrs.get('name', attrs.get('property'))] = attrs.get('content')


class PlayerDelivery(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        root = Path(cls.temp.name)
        public = root / 'public'
        public.mkdir()
        for name in ('index.html', 'player.html', 'preview.png'):
            shutil.copy2(server.ROOT / 'public' / name, public / name)
        (public / 'roms').mkdir()
        (public / '.env').write_text('test fixture; no credential')
        (root / 'outside.txt').write_text('outside the public directory')
        (public / 'outside-link').symlink_to(root / 'outside.txt')
        cls.env = patch.dict(os.environ, {
            'PUBLIC_URL': 'https://tweetboy.example',
            'TWITTER_SITE': '@instantricecook',
        })
        cls.root = patch.object(server, 'ROOT', root)
        cls.env.start()
        cls.root.start()
        cls.instance = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        threading.Thread(target=cls.instance.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.instance.shutdown()
        cls.instance.server_close()
        cls.root.stop()
        cls.env.stop()
        cls.temp.cleanup()

    def request(self, path, method='GET'):
        conn = http.client.HTTPConnection('127.0.0.1', self.instance.server_port)
        try:
            conn.request(method, path)
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def test_share_and_player_metadata_without_javascript(self):
        for game in server.GAMES:
            for prefix in ('r', 'play'):
                with self.subTest(game=game, prefix=prefix):
                    status, headers, body = self.request(
                        f'/{prefix}/{game}?autoplay=1&auto_play=true')
                    self.assertEqual(status, 200)
                    parser = MetaParser()
                    parser.feed(body.decode())
                    self.assertEqual(parser.tags['twitter:card'], 'player')
                    self.assertEqual(parser.tags['twitter:title'],
                                     'Tweetboy - Play gameboy games right inside of X')
                    self.assertEqual(parser.tags['og:title'], parser.tags['twitter:title'])
                    self.assertEqual(parser.tags['twitter:site'], '@instantricecook')
                    self.assertEqual(parser.tags['twitter:player'],
                                     'https://tweetboy.example/play/' + game)
                    self.assertEqual(parser.tags['og:url'], 'https://tweetboy.example/r/' + game)
                    self.assertEqual(parser.tags['twitter:player:width'], '600')
                    self.assertEqual(parser.tags['twitter:player:height'], '600')
                    self.assertEqual(parser.tags['twitter:image'],
                                     'https://tweetboy.example/preview.png')
                    self.assertEqual(parser.tags['og:image'], parser.tags['twitter:image'])
                    image_status, image_headers, image_body = self.request('/preview.png')
                    self.assertEqual(image_status, 200)
                    self.assertEqual({key.lower(): value for key, value in image_headers.items()}['content-type'], 'image/png')
                    self.assertTrue(image_body.startswith(b'\x89PNG\r\n\x1a\n'))
                    self.assertIn(b'<base href="/">', body)
                    self.assertNotIn('X-Frame-Options', headers)
                    self.assertEqual(headers['Content-Security-Policy'], server.FRAME_POLICY)

    def test_homepage_works_without_owner_roms(self):
        self.assertEqual(list((server.ROOT / 'public/roms').iterdir()), [])
        status, _, body = self.request('/')
        self.assertEqual(status, 200)
        parser = MetaParser()
        parser.feed(body.decode())
        self.assertEqual(parser.tags['twitter:player'], 'https://tweetboy.example/play/library')
        self.assertEqual(parser.tags['og:url'], 'https://tweetboy.example/')
        self.assertEqual(parser.tags['twitter:image'], 'https://tweetboy.example/preview.png')

    def test_unknown_and_local_cartridges_cannot_be_shared(self):
        for path in ('/play/unknown', '/play/petris', '/r/pandoras-blocks',
                     '/play/bulletgba', '/r/local-123', '/play/a/b'):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)

    def test_head_and_nested_frame_headers(self):
        status, headers, body = self.request('/play/library', 'HEAD')
        self.assertEqual(status, 200)
        self.assertEqual(body, b'')
        self.assertGreater(int(headers['Content-Length']), 1000)
        self.assertEqual(self.request('/player.html')[1]['Content-Security-Policy'],
                         server.FRAME_POLICY)

    def test_preview_is_real_png(self):
        status, _, body = self.request('/preview.png')
        self.assertEqual(status, 200)
        self.assertTrue(body.startswith(b'\x89PNG\r\n\x1a\n'))

    def test_private_files_and_directory_listings_are_not_served(self):
        for path in ('/.env', '/%2eenv', '/outside-link', '/roms/'):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)

    def test_public_url_rejects_invalid_origins(self):
        for origin in ('http://tweetboy.example', 'https://host/path',
                       'https://user:password@host', 'https://host?query=1'):
            with self.subTest(origin=origin), patch.dict(os.environ, {'PUBLIC_URL': origin}):
                with self.assertRaises(ValueError):
                    server.public_url()
