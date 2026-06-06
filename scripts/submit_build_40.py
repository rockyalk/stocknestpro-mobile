import subprocess
import sys
import os
import json
import time

def run_command(cmd, env=None):
    print(f"Running command: {cmd}")
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env, cwd="/home/ubuntu/stocknestpro-mobile")
    output = []
    while True:
        line = process.stdout.readline()
        if not line and process.poll() is not None:
            break
        if line:
            sys.stdout.write(line)
            sys.stdout.flush()
            output.append(line)
    rc = process.poll()
    return rc, "".join(output)

def main():
    token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL"
    env = os.environ.copy()
    env["EXPO_TOKEN"] = token
    
    print("Step 1: Triggering EAS build 40 for iOS production...")
    cmd = "npx eas-cli build --platform ios --profile production --non-interactive --json"
    rc, output = run_command(cmd, env)
    
    if rc != 0:
        print("Error triggering build!")
        sys.exit(1)
        
    try:
        # Find JSON start
        lines = output.split("\n")
        json_str = ""
        for line in lines:
            if line.strip().startswith("[") or line.strip().startswith("{"):
                json_str += line + "\n"
        build_data = json.loads(json_str.strip())
        if isinstance(build_data, list):
            build_data = build_data[0]
        build_id = build_data["id"]
        print(f"\nBuild successfully triggered! Build ID: {build_id}")
        
        # Step 2: Start background monitoring
        print("Step 2: Launching background monitor process...")
        log_file = "/home/ubuntu/stocknestpro-mobile/monitor_40.log"
        os.system(f"nohup python3 -u /home/ubuntu/stocknestpro-mobile/scripts/monitor_and_submit_40.py {build_id} > {log_file} 2>&1 &")
        print(f"Background monitor launched successfully! Logs are being written to {log_file}")
        
    except Exception as e:
        print(f"Error parsing build output: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
