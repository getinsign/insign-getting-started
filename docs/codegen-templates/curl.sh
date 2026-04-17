{{FILE_COMMENT}}# 1) {{METHOD}} {{PATH}}
RESPONSE=$(curl -s -w "\n%{http_code}" -X {{METHOD}} \
  '{{URL}}' \
  -u '{{USERNAME}}:{{PASSWORD}}' \
{{#if HAS_BODY}}
  -H 'Content-Type: {{CONTENT_TYPE}}' \
  -d '{{BODY_JSON}}')
{{/if}}
{{#unless HAS_BODY}}
)
{{/unless}}
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
echo "HTTP $HTTP_CODE"
echo "$BODY"
[ "$HTTP_CODE" -eq 200 ] || { echo "FAILED: expected 200, got $HTTP_CODE" >&2; exit 1; }
{{SAMPLES}}

SID=$(echo "$BODY" | grep -o '"sessionid":"[^"]*"' | head -1 | cut -d'"' -f4)
AUTH="{{USERNAME}}:{{PASSWORD}}"
BASE_URL="{{BASE_URL}}"

if [ -n "$SID" ]; then
  # 2) Get status (sessionid in JSON body)
  STATUS_RESP=$(curl -sf -X POST "$BASE_URL/get/status" \
    -u "$AUTH" \
    -H "Content-Type: application/json" \
    -d "{\"sessionid\":\"$SID\"}")
  echo ""
  echo "=== Status ==="
  echo "$STATUS_RESP"

  # Print detailed status info
  echo "$STATUS_RESP" | python3 -c "
import sys, json
status = json.load(sys.stdin)
print('=== Session Status ===')
print('Completed:', status['sucessfullyCompleted'])
print('Signatures:', status['numberOfSignatures'])
print('Signature Fields:')
for f in status['signaturFieldsStatusList']:
    ext = f['externRole']
    print(f'  {f[\"fieldID\"]} | {f[\"role\"]} | {f[\"displayname\"]} | signed={f[\"signed\"]} | mandatory={f[\"mandatory\"]} | externRole={ext}')
"

  # 3) Invite signers via /extern/beginmulti
  # Parse unsigned signature fields grouped by role
  EXTERN_USERS=$(echo "$STATUS_RESP" | python3 -c "
import sys, json
status = json.load(sys.stdin)
fields = status['signaturFieldsStatusList']
roles = {}
for f in fields:
    if not f['signed']:
        role = f['role']
        if role and role not in roles:
            roles[role] = f['displayname']
users = []
for role, name in roles.items():
    email = role.lower().replace(' ', '-') + '@example.test'
    users.append({
        'recipient': email,
        'realName': name,
        'roles': [role],
        'singleSignOnEnabled': True,
        'sendEmails': False
    })
print(json.dumps(users))
")

  BEGINMULTI_BODY=$(echo "$EXTERN_USERS" | python3 -c "
import sys, json
users = json.load(sys.stdin)
print(json.dumps({'sessionid': '$SID', 'externUsers': users, 'inOrder': False}))
")

  BEGINMULTI_RESP=$(curl -sf -X POST "$BASE_URL/extern/beginmulti" \
    -u "$AUTH" \
    -H "Content-Type: application/json" \
    -d "$BEGINMULTI_BODY")
  echo ""
  echo "=== Invite Signers ==="
  echo "$BEGINMULTI_RESP"

  # Print each signer's info paired with request data
  echo "$BEGINMULTI_RESP" | python3 -c "
import sys, json
resp = json.load(sys.stdin)
req_users = json.loads('$EXTERN_USERS')
resp_users = resp['externUsers']
print('=== Signing Links ===')
for i, ru in enumerate(resp_users):
    name = req_users[i]['realName']
    role = req_users[i]['roles'][0]
    url = ru['externAccessLink']
    print(f'  {name} ({role}) -> {url}')
"

  # 4) Download document (URL params — exception)
  DOC_ID=$(echo "$STATUS_RESP" | grep -o '"docid":"[^"]*"' | head -1 | cut -d'"' -f4)
  DOC_ID="${DOC_ID:-0}"
  curl -sf -X POST "$BASE_URL/get/document?sessionid=$SID&docid=$DOC_ID" \
    -u "$AUTH" \
    -o document.pdf
  echo ""
  echo "=== Download ==="
  echo "Saved document.pdf"

  # 5) Purge session
  curl -sf -X POST "$BASE_URL/persistence/purge" \
    -u "$AUTH" \
    -H "Content-Type: application/json" \
    -d "{\"sessionid\":\"$SID\"}"
  echo ""
  echo "Session purged"
fi
