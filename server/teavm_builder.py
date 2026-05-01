#!/usr/bin/env python3
"""
TeaVM Builder - Compiles Java to JavaScript for browser execution
Uses TeaVM to transpile Java bytecode to JavaScript
"""
import os
import subprocess
import shutil
import tempfile
import re

TEAVM_VERSION = "0.10.2"

def setup_teavm(build_dir):
    """Download and setup TeaVM"""
    teavm_dir = os.path.expanduser("~/.teavm")
    jar_file = os.path.join(teavm_dir, f"teavm-cli-{TEAVM_VERSION}.jar")
    
    if not os.path.exists(jar_file):
        os.makedirs(teavm_dir, exist_ok=True)
        print(f"Downloading TeaVM {TEAVM_VERSION}...")
        url = f"https://repo1.maven.org/maven2/org/teavm/teavm-cli/{TEAVM_VERSION}/teavm-cli-{TEAVM_VERSION}.jar"
        subprocess.run(["wget", "-O", jar_file, url], check=True)
    
    return jar_file, teavm_dir

def build_with_teavm(project_dir, main_class, code):
    """Build Java code using TeaVM to produce JavaScript"""
    src_dir = os.path.join(project_dir, "src")
    out_dir = os.path.join(project_dir, "build", "web")
    os.makedirs(out_dir, exist_ok=True)
    
    # Write Java source
    java_file = os.path.join(src_dir, f"{main_class}.java")
    with open(java_file, 'w') as f:
        f.write(code)
    
    # Create temp dir for compilation
    with tempfile.TemporaryDirectory() as tmpdir:
        classes_dir = os.path.join(tmpdir, "classes")
        os.makedirs(classes_dir)
        
        # Compile with javac
        compile_result = subprocess.run(
            ["javac", "-d", classes_dir, java_file],
            capture_output=True, text=True
        )
        
        if compile_result.returncode != 0:
            return False, compile_result.stderr
        
        # Setup TeaVM
        jar_file, teavm_dir = setup_teavm(tmpdir)
        
        # Run TeaVM to compile to JavaScript
        js_file = os.path.join(out_dir, "game.js")
        teavm_cmd = [
            "java", "-jar", jar_file,
            "--output", js_file,
            "--target", "javascript",
            "--minify",
            f"--main-class={main_class}",
            classes_dir
        ]
        
        result = subprocess.run(teavm_cmd, capture_output=True, text=True, cwd=tmpdir)
        
        if result.returncode != 0:
            return False, result.stderr
        
        # Create HTML that loads the JS
        create_teavm_html(out_dir, main_class)
        
    return True, "OK"

def create_teavm_html(out_dir, main_class):
    """Create HTML for TeaVM output"""
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{main_class}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        html, body {{ 
            background: #111; 
            color: #0f0; 
            font-family: monospace; 
            height: 100vh; 
            width: 100vw;
            overflow: hidden;
        }}
        #start {{ 
            margin: auto;
            padding: 20px 40px; 
            font-size: 24px; 
            cursor: pointer;
            background: #00f;
            color: #fff;
            border: none;
            border-radius: 8px;
        }}
        #start:hover {{ background: #00a; }}
    </style>
</head>
<body>
    <button id="start" onclick="startGame()">START GAME</button>
    <script src="game.js"></script>
    <script>
    function startGame() {{
        document.getElementById('start').style.display = 'none';
        try {{
            main();
        }} catch(e) {{
            console.error(e);
            alert('Error: ' + e.message);
        }}
    }}
    </script>
</body>
</html>"""
    
    with open(os.path.join(out_dir, "index.html"), "w") as f:
        f.write(html)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: teavm_builder.py <project_dir> <main_class>")
        sys.exit(1)
    
    project_dir = sys.argv[1]
    main_class = sys.argv[2]
    
    # Read code from stdin or file
    code = sys.stdin.read() if not sys.stdin.isatty() else """
public class Hello {{
    public static void main(String[] args) {{
        System.out.println("Hello from TeaVM!");
    }}
}}
""".format(main_class)
    
    success, msg = build_with_teavm(project_dir, main_class, code)
    print(msg if not success else "Built successfully!")
    sys.exit(0 if success else 1)