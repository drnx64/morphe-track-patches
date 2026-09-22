import json
d = json.load(open('data/state/daily_buffer.json','r',encoding='utf-8'))
entries = d.get('affected_bundles', {})
print(f"Total bundles: {len(entries)}")
for badge in ['NEW BUNDLE', 'UPDATED', 'REMOVED BUNDLE']:
    count = sum(1 for v in entries.values() if v.get('badge_type') == badge)
    print(f"  {badge}: {count}")
total_apps = sum(len(v.get('apps',[])) for v in entries.values())
print(f"Total apps across all bundles: {total_apps}")
