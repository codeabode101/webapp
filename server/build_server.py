#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import subprocess
import urllib.request

PORT = 3000
BUILDS_DIR = "/var/www/games"
API_URL = "https://api.codeabode.co/api/projects/{}/status"

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{format % args}]")

    def do_POST(self):
        if self.path == "/build":
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            print(f"Received build request: {length} bytes")
            try:
                data = json.loads(body)
                project_id = data.get('project_id')
                code = data.get('code', '')
                build_key = self.headers.get('X-Build-Key')
                
                print(f"Project {project_id}: key={build_key[:20] if build_key else 'None'}..., code_len={len(code) if code else 0}")
                
                if build_key != 'codeabode-build-secret-2026':
                    self.send_response(401)
                    self.end_headers()
                    self.wfile.write(b'Unauthorized')
                    return
                
                if project_id and code:
                    project_dir = os.path.join(BUILDS_DIR, str(project_id))
                    os.makedirs(project_dir, exist_ok=True)
                    
                    main_file = os.path.join(project_dir, "main.py")
                    with open(main_file, 'w') as f:
                        f.write(code)
                    
                    print(f"Project {project_id}: Created main.py, building...")
                    
                    result = subprocess.run(
                        ["python3", "-m", "pygbag", "--build", project_dir],
                        capture_output=True, text=True,
                        cwd=project_dir
                    )
                    
                    if result.returncode == 0:
                        print(f"Project {project_id}: Build successful!")
                        self._update_status(project_id, 'ready')
                    else:
                        print(f"Project {project_id}: Build failed - {result.stderr}")
                        self._update_status(project_id, 'failed')
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": True}).encode())
                    return
            except Exception as e:
                print(f"Error: {e}")
        
        self.send_response(404)
        self.end_headers()

    def _update_status(self, project_id, status):
        try:
            url = API_URL.format(project_id)
            data = json.dumps({"status": status}).encode()
            req = urllib.request.Request(
                url,
                data=data,
                method='PATCH',
                headers={
                    "Content-Type": "application/json",
                    "Origin": "https://iloveuvania.omraheja.me",
                    "User-Agent": "Mozilla/5.0"
                }
            )
            urllib.request.urlopen(req)
            print(f"Project {project_id}: Status updated to {status}")
        except Exception as e:
            print(f"Failed to update status: {e}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Build-Key')
        self.end_headers()

print(f"Build service running on port {PORT}")
HTTPServer(("", PORT), Handler).serve_forever()