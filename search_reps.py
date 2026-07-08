import json
transcript_path = r'C:\Users\Wesley\.gemini\antigravity\brain\11968f37-5804-4e61-8e04-8f1324148d61\.system_generated\logs\transcript_full.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'tool_calls' in data:
                for call in data['tool_calls']:
                    if call['name'] in ['replace_file_content', 'multi_replace_file_content']:
                        tgt = call['args'].get('TargetFile', '')
                        if 'dashboard.html' in tgt:
                            print(f"Replaced in dashboard.html: {call['args'].get('Instruction', '')}")
                        if 'app.js' in tgt:
                            print(f"Replaced in app.js: {call['args'].get('Instruction', '')}")
        except Exception:
            pass
