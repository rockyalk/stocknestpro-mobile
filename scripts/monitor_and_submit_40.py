import subprocess
import sys
import time
import json
import os

def run_cmd(cmd):
    token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL"
    env = os.environ.copy()
    env["EXPO_TOKEN"] = token
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd="/home/ubuntu/stocknestpro-mobile", env=env)
    return result.returncode, result.stdout.strip(), result.stderr.strip()

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 monitor_and_submit_40.py <build_id>")
        sys.exit(1)
        
    build_id = sys.argv[1]
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Monitoring EAS Build {build_id}...")
    
    # 1. Wait for EAS Build to complete
    while True:
        code, out, err = run_cmd(f"npx eas-cli build:view {build_id} --json")
        if code != 0:
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Error checking build status: {err}")
            time.sleep(30)
            continue
            
        try:
            build_data = json.loads(out)
            status = build_data.get("status")
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Current Build Status: {status}")
            
            if status == "finished":
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] EAS Build 40 completed successfully!")
                break
            elif status == "failed":
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] EAS Build 40 failed!")
                sys.exit(1)
            elif status == "canceled":
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] EAS Build 40 was canceled!")
                sys.exit(1)
        except Exception as e:
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Error parsing JSON status: {e}")
            
        time.sleep(30)
        
    # 2. Submit the iOS build to Apple TestFlight
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Submitting iOS build {build_id} to Apple App Store Connect...")
    code, out, err = run_cmd(f"npx eas-cli submit --platform ios --id {build_id} --non-interactive")
    
    if code != 0:
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Submission failed:")
        print(err)
        sys.exit(1)
        
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Submission to Apple TestFlight completed successfully!")
    print(out)
    
    # 3. Write success report
    report_path = "/home/ubuntu/stocknestpro-mobile/submission_report_v40_success.md"
    with open(report_path, "w") as f:
        f.write(f"# EAS Build 40 Submission Success Report\n\n")
        f.write(f"- **Build ID:** `{build_id}`\n")
        f.write(f"- **Build Number:** `40`\n")
        f.write(f"- **Version Code:** `40`\n")
        f.write(f"- **Platform:** iOS\n")
        f.write(f"- **Status:** Submitted successfully to Apple App Store Connect / TestFlight\n")
        f.write(f"- **Timestamp:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"## Command Output:\n```\n{out}\n```\n")
        
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Success report written to {report_path}")

if __name__ == "__main__":
    main()
