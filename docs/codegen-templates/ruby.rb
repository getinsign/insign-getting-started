require "net/http"
require "json"
require "uri"
require "base64"

BASE = "{{BASE_URL}}"
auth = Base64.strict_encode64("{{USERNAME}}:{{PASSWORD}}")
headers = { "Authorization" => "Basic #{auth}" }

{{#if HAS_BODY}}
payload = {{BODY_BUILD}}
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
# 1) {{METHOD}} {{PATH}}
uri = URI("#{BASE}{{PATH}}")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = uri.scheme == "https"
req = Net::HTTP::{{METHOD_CAPITALIZED}}.new(uri)
req["Authorization"] = "Basic #{auth}"
{{#if HAS_BODY}}
req["Content-Type"] = "{{CONTENT_TYPE}}"
req.body = JSON.generate(payload)
{{/if}}
res = http.request(req)
puts "HTTP #{res.code}"
puts res.body
abort "FAILED: expected HTTP 200, got #{res.code}" unless res.code == "200"
data = JSON.parse(res.body)

def do_post(uri, auth, body: nil)
  req = Net::HTTP::Post.new(uri)
  req["Authorization"] = "Basic #{auth}"
  if body
    req["Content-Type"] = "application/json"
    req.body = JSON.generate(body)
  end
  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") { |h| h.request(req) }
end

# 2) Get status (sessionid in JSON body)
sid = data["sessionid"]
if sid
  uri2 = URI("#{BASE}/get/status")
  res2 = do_post(uri2, auth, body: { "sessionid" => sid })
  puts "\n=== Status (HTTP #{res2.code}) ==="
  puts res2.body
  abort "FAILED: get/status returned HTTP #{res2.code}" unless res2.code == "200"
  status = JSON.parse(res2.body)

  # Print detailed status info
  puts "=== Session Status ==="
  puts "Completed: #{status["sucessfullyCompleted"]}"
  puts "Signatures: #{status["numberOfSignatures"]}"
  puts "Signature Fields:"
  status["signaturFieldsStatusList"].each do |f|
    puts "  #{f["fieldID"]} | #{f["role"]} | #{f["displayname"]} | signed=#{f["signed"]} | mandatory=#{f["mandatory"]} | externRole=#{f["externRole"]}"
  end

  # 3) Invite signers via /extern/beginmulti
  fields = status["signaturFieldsStatusList"]
  roles = {}
  fields.each do |f|
    next if f["signed"]
    role = f["role"]
    roles[role] ||= f["displayname"] if role && !role.empty?
  end

  extern_users = roles.map do |role, name|
    email = role.downcase.gsub(" ", "-") + "@example.test"
    {
      "recipient" => email,
      "realName" => name,
      "roles" => [role],
      "singleSignOnEnabled" => true,
      "sendEmails" => false
    }
  end

  uri4 = URI("#{BASE}/extern/beginmulti")
  res4 = do_post(uri4, auth, body: {
    "sessionid" => sid,
    "externUsers" => extern_users,
    "inOrder" => false
  })
  puts "\n=== Invite Signers (HTTP #{res4.code}) ==="
  if res4.code == "200"
    invite_data = JSON.parse(res4.body)
    resp_users = invite_data["externUsers"]
    puts "=== Signing Links ==="
    resp_users.each_with_index do |ru, i|
      name = extern_users[i]["realName"]
      role = extern_users[i]["roles"][0]
      url = ru["externAccessLink"]
      puts "  #{name} (#{role}) -> #{url}"
    end
  else
    warn "Invite failed: #{res4.body}"
    exit 1
  end

  # 4) Download document (first doc — URL params)
  doc_data = (status["documentData"] || [{}])[0] || {}
  doc_id = doc_data["docid"] || "0"
  uri3 = URI("#{BASE}/get/document?sessionid=#{sid}&docid=#{doc_id}")
  res3 = do_post(uri3, auth)
  puts "\n=== Download (HTTP #{res3.code}) ==="
  if res3.code == "200"
    File.binwrite("document.pdf", res3.body)
    puts "Saved document.pdf (#{res3.body.bytesize} bytes)"
  else
    warn "Download failed: #{res3.body}"
    exit 1
  end

  # 5) Purge session
  uri5 = URI("#{BASE}/persistence/purge")
  res5 = do_post(uri5, auth, body: { "sessionid" => sid })
  if res5.code == "200"
    puts "\nSession purged"
  else
    warn "Purge failed: #{res5.body}"
    exit 1
  end
end
