<?php

$base = '{{BASE_URL}}';
$auth = '{{USERNAME}}:{{PASSWORD}}';

{{#if HAS_BODY}}
$payload = {{BODY_BUILD}};
{{SAMPLES}}

{{FILE_COMMENT}}
{{/if}}
// 1) {{METHOD}} {{PATH}}
$ch = curl_init($base . '{{PATH}}');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => '{{METHOD}}',
    CURLOPT_USERPWD        => $auth,
{{#if HAS_BODY}}
    CURLOPT_HTTPHEADER     => ['Content-Type: {{CONTENT_TYPE}}'],
    CURLOPT_POSTFIELDS     => json_encode($payload),
{{/if}}
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
unset($ch);

echo "HTTP $httpCode\n";
echo "$response\n";
if ($httpCode !== 200) {
    fwrite(STDERR, "FAILED: expected HTTP 200, got $httpCode\n");
    exit(1);
}

$data = json_decode($response, true);

// 2) Get status (sessionid in JSON body)
$sid = $data['sessionid'] ?? null;
if ($sid) {
    $ch2 = curl_init($base . '/get/status');
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode(['sessionid' => $sid]),
        CURLOPT_USERPWD        => $auth,
    ]);
    $statusResp = curl_exec($ch2);
    $statusCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    unset($ch2);

    echo "\n=== Status (HTTP $statusCode) ===\n";
    echo "$statusResp\n";
    if ($statusCode !== 200) {
        fwrite(STDERR, "FAILED: get/status returned HTTP $statusCode\n");
        exit(1);
    }
    $status = json_decode($statusResp, true);

    // Print detailed status info
    echo "=== Session Status ===\n";
    echo "Completed: " . $status['sucessfullyCompleted'] . "\n";
    echo "Signatures: " . $status['numberOfSignatures'] . "\n";
    echo "Signature Fields:\n";
    foreach ($status['signaturFieldsStatusList'] as $f) {
        echo "  " . $f['fieldID'] . " | " . $f['role'] . " | " . $f['displayname'] . " | signed=" . $f['signed'] . " | mandatory=" . $f['mandatory'] . " | externRole=" . $f['externRole'] . "\n";
    }

    // 3) Invite signers via /extern/beginmulti
    $fields = $status['signaturFieldsStatusList'];
    $roles = [];
    foreach ($fields as $f) {
        if (!$f['signed'] && !empty($f['role']) && !isset($roles[$f['role']])) {
            $roles[$f['role']] = $f['displayname'];
        }
    }
    $externUsers = [];
    foreach ($roles as $role => $name) {
        $email = strtolower(str_replace(' ', '-', $role)) . '@example.test';
        $externUsers[] = [
            'recipient' => $email,
            'realName' => $name,
            'roles' => [$role],
            'singleSignOnEnabled' => true,
            'sendEmails' => false,
        ];
    }

    $ch4 = curl_init($base . '/extern/beginmulti');
    curl_setopt_array($ch4, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode([
            'sessionid' => $sid,
            'externUsers' => $externUsers,
            'inOrder' => false,
        ]),
        CURLOPT_USERPWD        => $auth,
    ]);
    $inviteResp = curl_exec($ch4);
    $inviteCode = curl_getinfo($ch4, CURLINFO_HTTP_CODE);
    unset($ch4);

    echo "\n=== Invite Signers (HTTP $inviteCode) ===\n";
    if ($inviteCode === 200) {
        $inviteData = json_decode($inviteResp, true);
        $respUsers = $inviteData['externUsers'];
        echo "=== Signing Links ===\n";
        for ($i = 0; $i < count($respUsers); $i++) {
            $name = $externUsers[$i]['realName'];
            $role = $externUsers[$i]['roles'][0];
            $url = $respUsers[$i]['externAccessLink'];
            echo "  $name ($role) -> $url\n";
        }
    } else {
        fwrite(STDERR, "Invite failed: $inviteResp\n");
        exit(1);
    }

    // 4) Download document (first doc — URL params)
    $docId = $status['documentData'][0]['docid'] ?? '0';
    $ch3 = curl_init($base . '/get/document?sessionid=' . urlencode($sid) . '&docid=' . urlencode($docId));
    curl_setopt_array($ch3, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_USERPWD        => $auth,
    ]);
    $doc = curl_exec($ch3);
    $docCode = curl_getinfo($ch3, CURLINFO_HTTP_CODE);
    unset($ch3);

    echo "\n=== Download (HTTP $docCode) ===\n";
    if ($docCode === 200) {
        file_put_contents('document.pdf', $doc);
        echo "Saved document.pdf (" . strlen($doc) . " bytes)\n";
    } else {
        fwrite(STDERR, "Download failed: $doc\n");
        exit(1);
    }

    // 5) Purge session
    $ch5 = curl_init($base . '/persistence/purge');
    curl_setopt_array($ch5, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode(['sessionid' => $sid]),
        CURLOPT_USERPWD        => $auth,
    ]);
    $purgeResp = curl_exec($ch5);
    $purgeCode = curl_getinfo($ch5, CURLINFO_HTTP_CODE);
    unset($ch5);

    if ($purgeCode === 200) {
        echo "\nSession purged\n";
    } else {
        fwrite(STDERR, "Purge failed: $purgeResp\n");
        exit(1);
    }
}
