#!/usr/bin/env python3
"""
Server-side Java game runner using Xvfb + FFmpeg
Runs Java in virtual display, captures frames, serves to browser
"""
import asyncio
importwebsockets
import subprocess
import threading
import time
import os
import json
import base64

PORT = 3001
GAMES_DIR = "/var/www/games"

async def handle_client(websocket, path):
    project_id = path.strip('/')
    if not project_id:
        await websocket.send(json.dumps({"error": "No project ID"}))
        return
    
    game_dir = os.path.join(GAMES_DIR, project_id)
    src_dir = os.path.join(game_dir, "src")
    
    # Find java file
    java_files = [f for f in os.listdir(src_dir) if f.endswith('.java')]
    if not java_files:
        await websocket.send(json.dumps({"error": "No java file"}))
        return
    
    main_class = java_files[0][:-5]
    print(f"Running {main_class} for project {project_id}")
    
    try:
        # Start Xvfb
        xvfb = subprocess.Popen(
            ["Xvfb", ":99", "-screen", "0", "1024x768x24"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        
        # Set display and run java
        env = os.environ.copy()
        env["DISPLAY"] = ":99"
        
        java_proc = subprocess.Popen(
            ["java", "-cp", game_dir, main_class],
            cwd=game_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        time.sleep(3)
        
        # Start FFmpeg capture
        ffmpeg = subprocess.Popen(
            ["ffmpeg", "-f", "x11grab", "-s", "800x600", "-i", ":99.0",
            "-c:v", "libx264", "-preset", "ultrafast",
            "-tune", "zerolatency", "-crf", "23",
            "-f", "mp4", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        
        # Stream frames
        frame_data = b""
        while java_proc.poll() is None:
            data = ffmpeg.stdout.read(4096)
            if data:
                await websocket.send(base64.b64encode(data).decode())
        
        await websocket.send(json.dumps({"done": True}))
        
    except Exception as e:
        await websocket.send(json.dumps({"error": str(e)}))
    finally:
        try:
            xvfb.kill()
            java_proc.kill()
            ffmpeg.kill()
        except:
            pass

async def main():
    async with websockets.serve(handle_client, "0.0.0.0", PORT):
        print(f"Game runner on ws://{PORT}")

if __name__ == "__main__":
    asyncio.run(main())