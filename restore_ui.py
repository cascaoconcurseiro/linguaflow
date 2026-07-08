import json
import os

transcript_path = r'C:\Users\Wesley\.gemini\antigravity\brain\11968f37-5804-4e61-8e04-8f1324148d61\.system_generated\logs\transcript_full.jsonl'

files_to_recover = {}

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'tool_calls' in data:
                for call in data['tool_calls']:
                    if call['name'] == 'write_to_file':
                        args = call['args']
                        target_file = args.get('TargetFile', '')
                        content = args.get('CodeContent', '')
                        
                        # Only recover dashboard and popup
                        if 'dashboard' in target_file or 'popup' in target_file:
                            files_to_recover[target_file] = content
        except Exception as e:
            pass

for target_file, content in files_to_recover.items():
    print(f"Restoring {target_file}...")
    os.makedirs(os.path.dirname(target_file), exist_ok=True)
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done restoring UI files.")
