#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import subprocess
import urllib.request

PORT = 3000
BUILDS_DIR = "/var/www/games"
API_URL = "https://api.codeabode.co/api/projects/{}/status"
CHEERPJ_CDN = "https://cjrtnc.leaningtech.com/4.2/loader.js"

def detect_language(code):
    code = code.strip()
    if code.startswith("import java") or code.startswith("public class"):
        return "java"
    elif code.startswith("import pygame") or code.startswith("import turtle") or "pygame.init()" in code:
        return "pygame"
    elif "def " in code and ": " in code:
        return "python"
    return "python"

def create_java_html(project_dir):
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Java Game</title>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 20px; background: #1a1a2e; color: white; margin: 0; }}
        #container {{ width: 100%; height: 100vh; }}
        canvas {{ border: 2px solid #4a4a6a; }}
        .loading {{ color: #00ff00; font-size: 24px; text-align: center; padding-top: 100px; }}
    </style>
    <script src="{CHEERPJ_CDN}"></script>
</head>
<body>
    <div id="container">
        <p class="loading">Loading CheerpJ...</p>
    </div>
    <script>
(async () => {{
            try {{
                await cheerpjInit({loaderUrl: window.location.href});
                document.querySelector('.loading').textContent = 'CheerpJ initialized!';
                cheerpjCreateDisplay(800, 600);
                document.querySelector('.loading').textContent = 'Running...';
                await cheerpjRunJar('/app/Main.jar');
                document.querySelector('.loading').textContent = 'Done!';
            }} catch (e) {{
                document.querySelector('.loading').textContent = 'Error: ' + e.message + ' ' + e.stack;
            }}
        }})();
    </script>
</body>
</html>"""
    web_dir = os.path.join(project_dir, "build", "web")
    os.makedirs(web_dir, exist_ok=True)
    with open(os.path.join(web_dir, "index.html"), "w") as f:
        f.write(html)

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
                    print("Unauthorized")
                    self.send_response(401)
                    self.end_headers()
                    self.wfile.write(b'Unauthorized')
                    return
                
                if project_id and code:
                    print(f"Project {project_id}: starting build. lang detection...")
                    project_dir = os.path.join(BUILDS_DIR, str(project_id))
                    os.makedirs(project_dir, exist_ok=True)

                    lang = detect_language(code)
                    print(f"Project {project_id}: Detected {lang}")
                    
                    if lang == "java":
                        # Decode escape sequences (JSON sends \n as \\n)
                        code = code.encode().decode('unicode_escape')
                        # Save Java source
                        java_dir = os.path.join(project_dir, "src")
                        os.makedirs(java_dir, exist_ok=True)
                        java_file = os.path.join(java_dir, "Main.java")
                        with open(java_file, 'w') as f:
                            f.write(code)
                        
                        # Compile Java to bytecode
                        compile_result = subprocess.run(
                            ["javac", "-source", "8", "-target", "8", "-d", project_dir, java_file],
                            capture_output=True, text=True, timeout=30
                        )
                        
                        if compile_result.returncode == 0:
                            print(f"Project {project_id}: Java compiled successfully")
                            
                            # Create JAR
                            jar_file = os.path.join(project_dir, "build", "web", "Main.jar")
                            os.makedirs(os.path.dirname(jar_file), exist_ok=True)
                            
                            # Find all .class files
                            class_files = []
                            for root, dirs, files in os.walk(project_dir):
                                for f in files:
                                    if f.endswith('.class'):
                                        rel = os.path.relpath(os.path.join(root, f), project_dir)
                                        class_files.append(rel)
                            
                            if class_files:
                                # Create manifest with Main-Class
                                manifest_content = "Manifest-Version: 1.0\nMain-Class: Main\n\n"
                                manifest_file = os.path.join(project_dir, "MANIFEST.MF")
                                with open(manifest_file, 'w') as f:
                                    f.write(manifest_content)
                                
                                # Create JAR with manifest
                                jar_cmd = ["jar", "cfm", jar_file, manifest_file] + class_files
                                jar_result = subprocess.run(jar_cmd, cwd=project_dir, capture_output=True, text=True)
                                print(f"Project {project_id}: JAR created with manifest")
                            
                            # Create HTML with CheerpJ
                            create_java_html(project_dir)
                            print(f"Project {project_id}: Java build complete with CheerpJ!")
                            self._update_status(project_id, 'ready')
                        else:
                            print(f"Project {project_id}: Java compile failed: {compile_result.stderr}")
                            self._update_status(project_id, 'failed')
                    else:
                        if code.strip():
                            main_file = os.path.join(project_dir, "main.py")
                            with open(main_file, 'w') as f:
                                f.write(code)
                        
                        print(f"Project {project_id}: Building with pygbag...")
                        
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
                    self.wfile.write(json.dumps({"success": True, "language": lang}).encode())
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