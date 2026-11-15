"""
DualStack Threading HTTP Server with Range (206) support for HTML5 video playback.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import socket
import sys

class RangeFileWrapper:
    def __init__(self, file_obj, length):
        self.file_obj = file_obj
        self.remaining = length

    def read(self, size=-1):
        if self.remaining <= 0:
            return b""
        to_read = min(size, self.remaining) if size > 0 else self.remaining
        chunk = self.file_obj.read(to_read)
        self.remaining -= len(chunk)
        return chunk

    def close(self):
        self.file_obj.close()


class RangeRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def translate_path(self, path):
        translated = super().translate_path(path)
        if not os.path.exists(translated):
            clean = path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
            candidate = os.path.join(os.getcwd(), "frontend", clean)
            if os.path.exists(candidate):
                return candidate
        return translated

    def send_head(self):
        if "Range" not in self.headers:
            return super().send_head()

        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        range_val = self.headers["Range"].strip()
        if not range_val.startswith("bytes="):
            return super().send_head()

        total = os.path.getsize(path)
        parts = range_val[6:].split("-")
        try:
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else total - 1
        except ValueError:
            return super().send_head()

        if start >= total or end >= total or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{total}")
            self.end_headers()
            return None

        length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
        self.send_header("Content-Length", str(length))
        self.end_headers()

        f = open(path, "rb")
        f.seek(start)
        return RangeFileWrapper(f, length)


class DualStackServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        return super().server_bind()


def run(port=8080, directory="REJI/frontend"):
    abs_dir = os.path.abspath(directory)
    os.chdir(abs_dir)
    try:
        httpd = DualStackServer(("::", port), RangeRequestHandler)
    except Exception:
        httpd = ThreadingHTTPServer(("0.0.0.0", port), RangeRequestHandler)
    print(f"Serving {abs_dir} on port {port} with DualStack + Range 206 support...")
    httpd.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    directory = sys.argv[2] if len(sys.argv) > 2 else "REJI/frontend"
    run(port, directory)
