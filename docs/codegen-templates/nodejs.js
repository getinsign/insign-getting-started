// Node.js 18+ (native fetch)
const fs = require("fs");

const BASE = "{{BASE_URL}}";
const AUTH = "Basic " + Buffer.from("{{USERNAME}}:{{PASSWORD}}").toString("base64");
const headers = { Authorization: AUTH };

(async () => {
{{#if HAS_BODY}}
  const body = {{BODY_BUILD}};
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
  // 1) {{METHOD}} {{PATH}}
  const res = await fetch(`${BASE}{{PATH}}`, {
    method: "{{METHOD}}",
    headers: { ...headers{{#if HAS_BODY}}, "Content-Type": "{{CONTENT_TYPE}}"{{/if}} },
{{#if HAS_BODY}}
    body: JSON.stringify(body),
{{/if}}
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(text);
  if (res.status !== 200) { console.error(`FAILED: expected 200, got ${res.status}`); process.exit(1); }
  const data = JSON.parse(text);

  // 2) Get status (sessionid in JSON body)
  const sid = data.sessionid;
  if (sid) {
    const r2 = await fetch(`${BASE}/get/status`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionid: sid }),
    });
    const statusText = await r2.text();
    console.log(`\n=== Status (HTTP ${r2.status}) ===`);
    console.log(statusText);
    if (r2.status !== 200) { console.error("FAILED: get/status"); process.exit(1); }
    const status = JSON.parse(statusText);

    // Print detailed status info
    console.log("=== Session Status ===");
    console.log(`Completed: ${status.sucessfullyCompleted}`);
    console.log(`Signatures: ${status.numberOfSignatures}`);
    console.log("Signature Fields:");
    for (const f of status.signaturFieldsStatusList) {
      console.log(`  ${f.fieldID} | ${f.role} | ${f.displayname} | signed=${f.signed} | mandatory=${f.mandatory} | externRole=${f.externRole}`);
    }

    // 3) Invite signers via /extern/beginmulti
    const fields = status.signaturFieldsStatusList;
    const roles = {};
    for (const f of fields) {
      if (!f.signed && f.role && !roles[f.role]) {
        roles[f.role] = f.displayname;
      }
    }
    const externUsers = Object.entries(roles).map(([role, name]) => ({
      recipient: role.toLowerCase().replace(/ /g, "-") + "@example.test",
      realName: name,
      roles: [role],
      singleSignOnEnabled: true,
      sendEmails: false,
    }));

    const r4 = await fetch(`${BASE}/extern/beginmulti`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionid: sid, externUsers, inOrder: false }),
    });
    console.log(`\n=== Invite Signers (HTTP ${r4.status}) ===`);
    if (r4.status === 200) {
      const inviteData = JSON.parse(await r4.text());
      const respUsers = inviteData.externUsers;
      console.log("=== Signing Links ===");
      for (let i = 0; i < respUsers.length; i++) {
        const name = externUsers[i].realName;
        const role = externUsers[i].roles[0];
        const url = respUsers[i].externAccessLink;
        console.log(`  ${name} (${role}) -> ${url}`);
      }
    } else {
      console.error("Invite failed:", await r4.text());
      process.exit(1);
    }

    // 4) Download document (first doc — URL params)
    const docId = status.documentData?.[0]?.docid ?? "0";
    const r3 = await fetch(`${BASE}/get/document?sessionid=${sid}&docid=${docId}`, { method: "POST", headers });
    console.log(`\n=== Download (HTTP ${r3.status}) ===`);
    if (r3.status === 200) {
      fs.writeFileSync("document.pdf", Buffer.from(await r3.arrayBuffer()));
      console.log("Saved document.pdf");
    } else {
      console.error("Download failed:", await r3.text());
      process.exit(1);
    }

    // 5) Purge session
    const r5 = await fetch(`${BASE}/persistence/purge`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionid: sid }),
    });
    if (r5.status === 200) {
      console.log("\nSession purged");
    } else {
      console.error("Purge failed:", await r5.text());
      process.exit(1);
    }
  }
})();
