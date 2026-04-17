import requests, json, sys

BASE = "{{BASE_URL}}"
auth = ("{{USERNAME}}", "{{PASSWORD}}")

{{#if HAS_BODY}}
payload = {{BODY_BUILD}}
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
# 1) {{METHOD}} {{PATH}}
r = requests.{{METHOD_LOWER}}(f"{BASE}{{PATH}}", auth=auth{{#if HAS_BODY}}, json=payload{{/if}})
print(f"HTTP {r.status_code}")
print(r.text)
if r.status_code != 200:
    sys.exit(f"FAILED: expected HTTP 200, got {r.status_code}")
data = r.json()

# 2) Get status
sid = data.get("sessionid")
if sid:
    r2 = requests.post(f"{BASE}/get/status", auth=auth, json={"sessionid": sid})
    print(f"\n=== Status (HTTP {r2.status_code}) ===")
    print(r2.text)
    if r2.status_code != 200:
        sys.exit(f"FAILED: get/status returned HTTP {r2.status_code}")
    status = r2.json()

    # Print detailed status info
    print("=== Session Status ===")
    print(f"Completed: {status['sucessfullyCompleted']}")
    print(f"Signatures: {status['numberOfSignatures']}")
    print("Signature Fields:")
    for f in status["signaturFieldsStatusList"]:
        print(f"  {f['fieldID']} | {f['role']} | {f['displayname']} | signed={f['signed']} | mandatory={f['mandatory']} | externRole={f['externRole']}")

    # 3) Invite signers via /extern/beginmulti
    fields = status["signaturFieldsStatusList"]
    roles = {}
    for f in fields:
        if not f["signed"]:
            role = f["role"]
            if role and role not in roles:
                roles[role] = f["displayname"]

    extern_users = []
    for role, name in roles.items():
        email = role.lower().replace(" ", "-") + "@example.test"
        extern_users.append({
            "recipient": email,
            "realName": name,
            "roles": [role],
            "singleSignOnEnabled": True,
            "sendEmails": False,
        })

    r4 = requests.post(
        f"{BASE}/extern/beginmulti",
        auth=auth,
        json={"sessionid": sid, "externUsers": extern_users, "inOrder": False},
    )
    print(f"\n=== Invite Signers (HTTP {r4.status_code}) ===")
    if r4.status_code == 200:
        resp_users = r4.json()["externUsers"]
        print("=== Signing Links ===")
        for i, ru in enumerate(resp_users):
            name = extern_users[i]["realName"]
            role = extern_users[i]["roles"][0]
            url = ru["externAccessLink"]
            print(f"  {name} ({role}) -> {url}")
    else:
        print(f"Invite failed: {r4.text}")
        sys.exit(1)

    # 4) Download document (first doc — URL params)
    doc_id = (status.get("documentData") or [{}])[0].get("docid", "0")
    r3 = requests.post(f"{BASE}/get/document?sessionid={sid}&docid={doc_id}", auth=auth)
    print(f"\n=== Download (HTTP {r3.status_code}) ===")
    if r3.status_code == 200:
        open("document.pdf", "wb").write(r3.content)
        print(f"Saved document.pdf ({len(r3.content)} bytes)")
    else:
        print(f"Download failed: {r3.text}")
        sys.exit(1)

    # 5) Purge session
    r5 = requests.post(f"{BASE}/persistence/purge", auth=auth, json={"sessionid": sid})
    if r5.status_code == 200:
        print("\nSession purged")
    else:
        print(f"Purge failed: {r5.text}")
        sys.exit(1)
