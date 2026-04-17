package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

func main() {
	base := "{{BASE_URL}}"
	username := "{{USERNAME}}"
	password := "{{PASSWORD}}"

{{#if HAS_BODY}}
	body := {{BODY_BUILD}}
{{SAMPLES}}

{{FILE_COMMENT}}
	bodyJSON, _ := json.Marshal(body)

{{/if}}
	// 1) {{METHOD}} {{PATH}}
{{#if HAS_BODY}}
	req, _ := http.NewRequest("{{METHOD}}", base+"{{PATH}}", bytes.NewReader(bodyJSON))
	req.Header.Set("Content-Type", "{{CONTENT_TYPE}}")
{{/if}}
{{#unless HAS_BODY}}
	req, _ := http.NewRequest("{{METHOD}}", base+"{{PATH}}", nil)
{{/unless}}
	req.SetBasicAuth(username, password)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Request failed: %v\n", err)
		os.Exit(1)
	}
	defer res.Body.Close()
	text, _ := io.ReadAll(res.Body)
	fmt.Printf("HTTP %d\n", res.StatusCode)
	fmt.Println(string(text))
	if res.StatusCode != 200 {
		fmt.Fprintf(os.Stderr, "FAILED: expected 200, got %d\n", res.StatusCode)
		os.Exit(1)
	}
	var data map[string]interface{}
	json.Unmarshal(text, &data)

	// Helper for POST with JSON body
	postJSON := func(url string, payload interface{}) (*http.Response, []byte) {
		j, _ := json.Marshal(payload)
		r, _ := http.NewRequest("POST", url, bytes.NewReader(j))
		r.SetBasicAuth(username, password)
		r.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(r)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Request failed: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return resp, b
	}

	// Helper for POST without body
	postNoBody := func(url string) (*http.Response, []byte) {
		r, _ := http.NewRequest("POST", url, nil)
		r.SetBasicAuth(username, password)
		resp, err := http.DefaultClient.Do(r)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Request failed: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return resp, b
	}

	// 2) Get status (sessionid in JSON body)
	sid, _ := data["sessionid"].(string)
	if sid != "" {
		res2, text2 := postJSON(base+"/get/status", map[string]string{"sessionid": sid})
		fmt.Printf("\n=== Status (HTTP %d) ===\n", res2.StatusCode)
		fmt.Println(string(text2))
		if res2.StatusCode != 200 {
			fmt.Fprintf(os.Stderr, "FAILED: get/status returned HTTP %d\n", res2.StatusCode)
			os.Exit(1)
		}
		var status map[string]interface{}
		json.Unmarshal(text2, &status)

		// Print detailed status info
		fmt.Println("=== Session Status ===")
		fmt.Printf("Completed: %v\n", status["sucessfullyCompleted"])
		fmt.Printf("Signatures: %v\n", status["numberOfSignatures"])
		fmt.Println("Signature Fields:")
		for _, fi := range status["signaturFieldsStatusList"].([]interface{}) {
			f := fi.(map[string]interface{})
			externRole := "null"
			if f["externRole"] != nil {
				externRole = f["externRole"].(string)
			}
			fmt.Printf("  %v | %v | %v | signed=%v | mandatory=%v | externRole=%s\n",
				f["fieldID"], f["role"], f["displayname"], f["signed"], f["mandatory"], externRole)
		}

		// 3) Invite signers via /extern/beginmulti
		roles := make(map[string]string) // role -> displayname
		fields := status["signaturFieldsStatusList"].([]interface{})
		for _, fi := range fields {
			f := fi.(map[string]interface{})
			signed := f["signed"].(bool)
			role := f["role"].(string)
			if !signed && role != "" {
				if _, exists := roles[role]; !exists {
					name := f["displayname"].(string)
					roles[role] = name
				}
			}
		}
		var externUsers []map[string]interface{}
		for role, name := range roles {
			email := strings.ToLower(strings.ReplaceAll(role, " ", "-")) + "@example.test"
			externUsers = append(externUsers, map[string]interface{}{
				"recipient":            email,
				"realName":             name,
				"roles":                []string{role},
				"singleSignOnEnabled":  true,
				"sendEmails":          false,
			})
		}
		beginBody := map[string]interface{}{
			"sessionid":   sid,
			"externUsers": externUsers,
			"inOrder":     false,
		}
		res4, text4 := postJSON(base+"/extern/beginmulti", beginBody)
		fmt.Printf("\n=== Invite Signers (HTTP %d) ===\n", res4.StatusCode)
		if res4.StatusCode == 200 {
			var inviteData map[string]interface{}
			json.Unmarshal(text4, &inviteData)
			respUsers := inviteData["externUsers"].([]interface{})
			fmt.Println("=== Signing Links ===")
			for i, u := range respUsers {
				s := u.(map[string]interface{})
				reqUser := externUsers[i]
				name := reqUser["realName"].(string)
				role := reqUser["roles"].([]string)[0]
				url := s["externAccessLink"].(string)
				fmt.Printf("  %s (%s) -> %s\n", name, role, url)
			}
		} else {
			fmt.Fprintf(os.Stderr, "Invite failed: %s\n", string(text4))
			os.Exit(1)
		}

		// 4) Download document (first doc — URL params)
		docID := "0"
		if docs, ok := status["documentData"].([]interface{}); ok && len(docs) > 0 {
			if d, ok := docs[0].(map[string]interface{}); ok {
				if id, ok := d["docid"].(string); ok {
					docID = id
				}
			}
		}
		res3, pdf := postNoBody(fmt.Sprintf("%s/get/document?sessionid=%s&docid=%s", base, sid, docID))
		fmt.Printf("\n=== Download (HTTP %d) ===\n", res3.StatusCode)
		if res3.StatusCode == 200 {
			os.WriteFile("document.pdf", pdf, 0644)
			fmt.Printf("Saved document.pdf (%d bytes)\n", len(pdf))
		} else {
			fmt.Fprintf(os.Stderr, "Download failed: %s\n", string(pdf))
			os.Exit(1)
		}

		// 5) Purge session
		res5, text5 := postJSON(base+"/persistence/purge", map[string]string{"sessionid": sid})
		if res5.StatusCode == 200 {
			fmt.Println("\nSession purged")
		} else {
			fmt.Fprintf(os.Stderr, "Purge failed: %s\n", string(text5))
			os.Exit(1)
		}
	}
}
