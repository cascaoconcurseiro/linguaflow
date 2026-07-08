import json
transcript_path = r'C:\Users\Wesley\.gemini\antigravity\brain\11968f37-5804-4e61-8e04-8f1324148d61\.system_generated\logs\transcript_full.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'tool_calls' in data:
                for call in data['tool_calls']:
                    if call['name'] in ['write_to_file', 'replace_file_content', 'multi_replace_file_content']:
                        tgt = call['args'].get('TargetFile', '')
                        if 'app.js' in tgt:
                            print(f"{call['name']} targeting {tgt}")
                        if 'dashboard.html' in tgt:
                            print(f"{call['name']} targeting {tgt}")
        except Exception:
            pass
