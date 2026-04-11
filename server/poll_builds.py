#!/usr/bin/env python3
import subprocess
import json
import os
import time
import urllib.request
import urllib.error

API_URL = "https://api.codeabode.co/api/projects/all"
UPDATE_URL = "https://api.codeabode.co/api/projects/{}/status"
BUILDS_DIR = "/var/www/games"

def call_api():
    result = subprocess.run(
        ["curl", "-s", "-H", "User-Agent: Mozilla/5.0", API_URL],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)

def update_status(project_id, status):
    url = UPDATE_URL.format(project_id)
    data = json.dumps({"status": status}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    )
    try:
        urllib.request.urlopen(req)
        print(f"  Updated project {project_id} status to {status}")
    except Exception as e:
        print(f"  Failed to update status: {e}")

def get_pending_projects(projects):
    return [p for p in projects if p.get("status") == "building"]

def build_project(project_id):
    project_dir = os.path.join(BUILDS_DIR, str(project_id))
    print(f"Building project {project_id} in {project_dir}")
    
    main_file = os.path.join(project_dir, "main.py")
    if not os.path.exists(main_file):
        print(f"  No main.py found, skipping")
        return False
    
    result = subprocess.run(
        ["python3", "-m", "pygbag", "--build", project_dir],
        capture_output=True, text=True,
        cwd=project_dir
    )
    
    if result.returncode == 0:
        print(f"  Build successful!")
        return True
    else:
        print(f"  Build failed: {result.stderr}")
        return False

def main():
    print("Starting poll loop...")
    while True:
        try:
            projects = call_api()
            pending = get_pending_projects(projects)
            
            if pending:
                print(f"Found {len(pending)} pending projects")
                for p in pending:
                    if build_project(p["id"]):
                        update_status(p["id"], "ready")
            else:
                print("No pending projects")
                
        except Exception as e:
            print(f"Error: {e}")
        
        time.sleep(30)

if __name__ == "__main__":
    main()