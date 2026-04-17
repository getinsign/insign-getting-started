// Rust — add to Cargo.toml: reqwest = { version = "0.12", features = ["blocking", "json"] }
//                            serde_json = "1"
use std::collections::HashMap;
use std::fs;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let base = "{{BASE_URL}}";
    let client = reqwest::blocking::Client::new();
    let auth = ("{{USERNAME}}", "{{PASSWORD}}");

{{#if HAS_BODY}}
    let body: serde_json::Value = serde_json::json!({{BODY_BUILD}});
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
    // 1) {{METHOD}} {{PATH}}
    let res = client
        .{{METHOD_LOWER}}(format!("{base}{{PATH}}"))
        .basic_auth(auth.0, Some(auth.1))
{{#if HAS_BODY}}
        .header("Content-Type", "{{CONTENT_TYPE}}")
        .json(&body)
{{/if}}
        .send()?;
    let status_code = res.status().as_u16();
    let text = res.text()?;
    println!("HTTP {status_code}");
    println!("{text}");
    if status_code != 200 {
        eprintln!("FAILED: expected 200, got {status_code}");
        std::process::exit(1);
    }
    let data: serde_json::Value = serde_json::from_str(&text)?;

    // 2) Get status (sessionid in JSON body)
    if let Some(sid) = data["sessionid"].as_str() {
        let res2 = client
            .post(format!("{base}/get/status"))
            .basic_auth(auth.0, Some(auth.1))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({"sessionid": sid}))
            .send()?;
        let code2 = res2.status().as_u16();
        let text2 = res2.text()?;
        println!("\n=== Status (HTTP {code2}) ===");
        println!("{text2}");
        if code2 != 200 {
            eprintln!("FAILED: get/status returned HTTP {code2}");
            std::process::exit(1);
        }
        let status: serde_json::Value = serde_json::from_str(&text2)?;

        // Print detailed status info
        println!("=== Session Status ===");
        println!("Completed: {}", status["sucessfullyCompleted"]);
        println!("Signatures: {}", status["numberOfSignatures"]);
        println!("Signature Fields:");
        for f in status["signaturFieldsStatusList"].as_array().unwrap() {
            let extern_role = f["externRole"].as_str().unwrap_or("null");
            println!("  {} | {} | {} | signed={} | mandatory={} | externRole={}",
                f["fieldID"].as_str().unwrap(),
                f["role"].as_str().unwrap(),
                f["displayname"].as_str().unwrap(),
                f["signed"],
                f["mandatory"],
                extern_role);
        }

        // 3) Invite signers via /extern/beginmulti
        let mut roles: HashMap<String, String> = HashMap::new();
        let fields = status["signaturFieldsStatusList"].as_array().unwrap();
        for f in fields {
            let signed = f["signed"].as_bool().unwrap();
            let role = f["role"].as_str().unwrap();
            if !signed && !role.is_empty() && !roles.contains_key(role) {
                let name = f["displayname"].as_str().unwrap();
                roles.insert(role.to_string(), name.to_string());
            }
        }
        let extern_users: Vec<serde_json::Value> = roles
            .iter()
            .map(|(role, name)| {
                let email = format!("{}@example.test", role.to_lowercase().replace(' ', "-"));
                serde_json::json!({
                    "recipient": email,
                    "realName": name,
                    "roles": [role],
                    "singleSignOnEnabled": true,
                    "sendEmails": false
                })
            })
            .collect();

        let begin_body = serde_json::json!({
            "sessionid": sid,
            "externUsers": extern_users,
            "inOrder": false
        });
        let res4 = client
            .post(format!("{base}/extern/beginmulti"))
            .basic_auth(auth.0, Some(auth.1))
            .header("Content-Type", "application/json")
            .json(&begin_body)
            .send()?;
        let code4 = res4.status().as_u16();
        println!("\n=== Invite Signers (HTTP {code4}) ===");
        if code4 == 200 {
            let invite_data: serde_json::Value = serde_json::from_str(&res4.text()?)?;
            let resp_users = invite_data["externUsers"].as_array().unwrap();
            println!("=== Signing Links ===");
            for (i, ru) in resp_users.iter().enumerate() {
                let name = extern_users[i]["realName"].as_str().unwrap();
                let role = extern_users[i]["roles"][0].as_str().unwrap();
                let url = ru["externAccessLink"].as_str().unwrap();
                println!("  {name} ({role}) -> {url}");
            }
        } else {
            eprintln!("Invite failed: {}", res4.text()?);
            std::process::exit(1);
        }

        // 4) Download document (first doc — URL params)
        let doc_id = status["documentData"][0]["docid"]
            .as_str()
            .unwrap_or("0");
        let res3 = client
            .post(format!("{base}/get/document?sessionid={sid}&docid={doc_id}"))
            .basic_auth(auth.0, Some(auth.1))
            .send()?;
        let code3 = res3.status().as_u16();
        println!("\n=== Download (HTTP {code3}) ===");
        if code3 == 200 {
            let pdf = res3.bytes()?;
            fs::write("document.pdf", &pdf)?;
            println!("Saved document.pdf ({} bytes)", pdf.len());
        } else {
            eprintln!("Download failed: {}", res3.text()?);
            std::process::exit(1);
        }

        // 5) Purge session
        let res5 = client
            .post(format!("{base}/persistence/purge"))
            .basic_auth(auth.0, Some(auth.1))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({"sessionid": sid}))
            .send()?;
        if res5.status().as_u16() == 200 {
            println!("\nSession purged");
        } else {
            eprintln!("Purge failed: {}", res5.text()?);
            std::process::exit(1);
        }
    }
    Ok(())
}
