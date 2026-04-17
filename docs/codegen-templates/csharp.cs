using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes("{{USERNAME}}:{{PASSWORD}}"));
var http = new HttpClient { BaseAddress = new Uri("{{BASE_URL}}") };
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

{{#if HAS_BODY}}
// Build request body
{{BODY_BUILD}}
{{SAMPLES}}

var content = new StringContent(body.ToJsonString(), Encoding.UTF8, "{{CONTENT_TYPE}}");

{{FILE_COMMENT}}
{{/if}}
// 1) {{METHOD}} {{PATH}}
{{CSHARP_CALL}}
var text = await response.Content.ReadAsStringAsync();
Console.WriteLine($"HTTP {(int)response.StatusCode}");
Console.WriteLine(text);
if (!response.IsSuccessStatusCode)
{
    Console.Error.WriteLine($"FAILED: expected HTTP 200, got {(int)response.StatusCode}");
    return;
}

// 2) Get status (sessionid in JSON body)
var sessionId = JsonNode.Parse(text)?["sessionid"]?.ToString();
if (sessionId != null)
{
    var statusBody = new StringContent(
        JsonSerializer.Serialize(new { sessionid = sessionId }),
        Encoding.UTF8, "application/json");
    var r2 = await http.PostAsync("/get/status", statusBody);
    var statusText = await r2.Content.ReadAsStringAsync();
    Console.WriteLine($"\n=== Status (HTTP {(int)r2.StatusCode}) ===");
    Console.WriteLine(statusText);
    if (!r2.IsSuccessStatusCode)
    {
        Console.Error.WriteLine($"FAILED: get/status returned HTTP {(int)r2.StatusCode}");
        return;
    }
    var status = JsonNode.Parse(statusText);

    // Print detailed status info
    Console.WriteLine("=== Session Status ===");
    Console.WriteLine($"Completed: {status["sucessfullyCompleted"]}");
    Console.WriteLine($"Signatures: {status["numberOfSignatures"]}");
    Console.WriteLine("Signature Fields:");
    foreach (var f in status["signaturFieldsStatusList"].AsArray())
    {
        var externRole = f["externRole"]?.ToString();
        Console.WriteLine($"  {f["fieldID"]} | {f["role"]} | {f["displayname"]} | signed={f["signed"]} | mandatory={f["mandatory"]} | externRole={externRole}");
    }

    // 3) Invite signers via /extern/beginmulti
    var fields = status["signaturFieldsStatusList"].AsArray();
    var roles = new Dictionary<string, string>();
    foreach (var f in fields)
    {
        var signed = f["signed"].GetValue<bool>();
        var role = f["role"].ToString();
        if (!signed && role != null && !roles.ContainsKey(role))
        {
            roles[role] = f["displayname"].ToString();
        }
    }
    var externUsers = new JsonArray();
    foreach (var (role, name) in roles)
    {
        var email = role.ToLower().Replace(" ", "-") + "@example.test";
        var user = new JsonObject
        {
            ["recipient"] = email,
            ["realName"] = name,
            ["roles"] = new JsonArray(role),
            ["singleSignOnEnabled"] = true,
            ["sendEmails"] = false,
        };
        externUsers.Add(user);
    }
    var beginBody = new JsonObject
    {
        ["sessionid"] = sessionId,
        ["externUsers"] = externUsers,
        ["inOrder"] = false,
    };
    var r4 = await http.PostAsync("/extern/beginmulti",
        new StringContent(beginBody.ToJsonString(), Encoding.UTF8, "application/json"));
    Console.WriteLine($"\n=== Invite Signers (HTTP {(int)r4.StatusCode}) ===");
    if (r4.IsSuccessStatusCode)
    {
        var inviteData = JsonNode.Parse(await r4.Content.ReadAsStringAsync());
        var respUsers = inviteData["externUsers"].AsArray();
        Console.WriteLine("=== Signing Links ===");
        for (int i = 0; i < respUsers.Count; i++)
        {
            var name = externUsers[i]["realName"].ToString();
            var role = externUsers[i]["roles"].AsArray()[0].ToString();
            var url = respUsers[i]["externAccessLink"].ToString();
            Console.WriteLine($"  {name} ({role}) -> {url}");
        }
    }
    else
    {
        Console.Error.WriteLine($"Invite failed: {await r4.Content.ReadAsStringAsync()}");
    }

    // 4) Download document (first doc — URL params)
    var docId = status?["documentData"]?[0]?["docid"]?.ToString() ?? "0";
    var r3 = await http.PostAsync($"/get/document?sessionid={sessionId}&docid={docId}", null);
    Console.WriteLine($"\n=== Download (HTTP {(int)r3.StatusCode}) ===");
    if (r3.IsSuccessStatusCode)
    {
        var doc = await r3.Content.ReadAsByteArrayAsync();
        await File.WriteAllBytesAsync("document.pdf", doc);
        Console.WriteLine($"Saved document.pdf ({doc.Length} bytes)");
    }
    else
    {
        var err = await r3.Content.ReadAsStringAsync();
        Console.Error.WriteLine($"Download failed: {err}");
    }

    // 5) Purge session
    var purgeBody = new StringContent(
        JsonSerializer.Serialize(new { sessionid = sessionId }),
        Encoding.UTF8, "application/json");
    var r5 = await http.PostAsync("/persistence/purge", purgeBody);
    if (r5.IsSuccessStatusCode)
    {
        Console.WriteLine("\nSession purged");
    }
    else
    {
        Console.Error.WriteLine($"Purge failed: {await r5.Content.ReadAsStringAsync()}");
    }
}
