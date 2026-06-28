import json
import os

transcript_path = r"C:\Users\Wesley\.gemini\antigravity\brain\6312691a-01b1-4d22-baee-8ad285ba2888\.system_generated\logs\transcript_full.jsonl"
output_path = r"C:\Users\Wesley\.gemini\config\AGENTS.md"

last_user_input = ""
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            last_user_input = data.get('content', '')

# Remove the initial part "Agora coloque essas no lugar ou elas já tem ?"
# The user's text starts with "Agora coloque essas no lugar ou elas já tem ?" and then "# System Prompts"
content_to_write = last_user_input
if "# System Prompts" in content_to_write:
    content_to_write = content_to_write[content_to_write.find("# System Prompts"):]

os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(content_to_write)
print("Rules successfully extracted and saved to", output_path)
