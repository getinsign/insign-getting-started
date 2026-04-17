// TypeScript — run with: npx tsx insign.ts / deno run / bun run
import * as fs from "node:fs";

const BASE: string = "{{BASE_URL}}";
const AUTH: string = "Basic " + btoa("{{USERNAME}}:{{PASSWORD}}");
const headers: Record<string, string> = { Authorization: AUTH };

{{#if HAS_BODY}}
const body: Record<string, unknown> = {{BODY_BUILD}};
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
// 1) {{METHOD}} {{PATH}}
const res: Response = await fetch(`${BASE}{{PATH}}`, {
  method: "{{METHOD}}",
  headers: { ...headers{{#if HAS_BODY}}, "Content-Type": "{{CONTENT_TYPE}}"{{/if}} },
{{#if HAS_BODY}}
  body: JSON.stringify(body),
{{/if}}
});
const text: string = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text);
if (res.status !== 200) { console.error(`FAILED: expected 200, got ${res.status}`); process.exit(1); }
const data: Record<string, unknown> = JSON.parse(text);

// 2) Get status (sessionid in JSON body)
const sid: string | undefined = data.sessionid as string;
if (sid) {
  const r2: Response = await fetch(`${BASE}/get/status`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionid: sid }),
  });
  const statusText: string = await r2.text();
  console.log(`\n=== Status (HTTP ${r2.status}) ===`);
  console.log(statusText);
  if (r2.status !== 200) { console.error("FAILED: get/status"); process.exit(1); }
  const status: Record<string, unknown> = JSON.parse(statusText);

  // Print detailed status info
  console.log("=== Session Status ===");
  console.log(`Completed: ${(status as any).sucessfullyCompleted}`);
  console.log(`Signatures: ${(status as any).numberOfSignatures}`);
  console.log("Signature Fields:");
  for (const f of (status as any).signaturFieldsStatusList) {
    console.log(`  ${f.fieldID} | ${f.role} | ${f.displayname} | signed=${f.signed} | mandatory=${f.mandatory} | externRole=${f.externRole}`);
  }

  // 3) Invite signers via /extern/beginmulti
  interface SignField { signed: boolean; role: string; displayname: string; fieldID: string; mandatory: boolean; externRole: unknown }
  const fields: SignField[] = status.signaturFieldsStatusList as SignField[];
  const roles: Record<string, string> = {};
  for (const f of fields) {
    if (!f.signed && f.role && !roles[f.role]) {
      roles[f.role] = f.displayname;
    }
  }
  const externUsers: Array<Record<string, unknown>> = Object.entries(roles).map(([role, name]) => ({
    recipient: role.toLowerCase().replace(/ /g, "-") + "@example.test",
    realName: name,
    roles: [role],
    singleSignOnEnabled: true,
    sendEmails: false,
  }));

  const r4: Response = await fetch(`${BASE}/extern/beginmulti`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionid: sid, externUsers, inOrder: false }),
  });
  console.log(`\n=== Invite Signers (HTTP ${r4.status}) ===`);
  if (r4.status === 200) {
    const inviteData: Record<string, unknown> = JSON.parse(await r4.text());
    const respUsers = inviteData.externUsers as Array<Record<string, unknown>>;
    console.log("=== Signing Links ===");
    for (let i = 0; i < respUsers.length; i++) {
      const name: string = externUsers[i].realName as string;
      const role: string = (externUsers[i].roles as string[])[0];
      const url: string = respUsers[i].externAccessLink as string;
      console.log(`  ${name} (${role}) -> ${url}`);
    }
  } else {
    console.error("Invite failed:", await r4.text());
    process.exit(1);
  }

  // 4) Download document (first doc — URL params)
  const docData = (status.documentData as Array<Record<string, unknown>>)?.[0];
  const docId: string = (docData?.docid as string) ?? "0";
  const r3: Response = await fetch(`${BASE}/get/document?sessionid=${sid}&docid=${docId}`, { method: "POST", headers });
  console.log(`\n=== Download (HTTP ${r3.status}) ===`);
  if (r3.status === 200) {
    const buf: ArrayBuffer = await r3.arrayBuffer();
    fs.writeFileSync("document.pdf", Buffer.from(buf));
    console.log(`Saved document.pdf (${buf.byteLength} bytes)`);
  } else {
    console.error("Download failed:", await r3.text());
    process.exit(1);
  }

  // 5) Purge session
  const r5: Response = await fetch(`${BASE}/persistence/purge`, {
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
