import os
import glob

def fix_string(s):
    try:
        # Try to encode as cp1252 (Windows-1252) and then decode as utf-8
        return s.encode('cp1252').decode('utf-8')
    except Exception as e:
        return s

s = "ðŸ“š HistÃ³rias DinÃ¢micas âœ¨ nÃ­vel"
print("Original:", s)
print("Fixed:", fix_string(s))
