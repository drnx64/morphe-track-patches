import json, os
parsed = json.load(open('data/raw/parsed_bundles.json','r',encoding='utf-8'))
# Find ahmedyarub
for key, rec in parsed.items():
    if 'ahmedyarub' in key:
        apps = rec.get('apps', [])
        for app in apps:
            if app.get('app_name') == 'Instagram':
                patches = app.get('patches', [])
                print(f"Instagram has {len(patches)} patches:")
                for p in patches[:5]:
                    print(f"  - {p.get('name','?')}")
                break
        break
