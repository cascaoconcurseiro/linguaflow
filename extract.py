import json

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
                        if target_file and content:
                            files_to_recover[target_file] = content
                    elif call['name'] == 'replace_file_content':
                        # This might be harder, but let's see if there are any
                        pass
        except:
            pass

for k in files_to_recover.keys():
    print("Found file:", k)

