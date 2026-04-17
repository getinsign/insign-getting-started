package com.example.insign;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Receives inSign webhook callbacks (serverside callbacks).
 * Uses Jackson ObjectMapper for JSON parsing - works with both implementations.
 */
@RestController
public class WebhookController {

    private final ObjectMapper mapper = new ObjectMapper();
    private final SessionStatusTracker tracker;

    public WebhookController(SessionStatusTracker tracker) {
        this.tracker = tracker;
    }

    @PostMapping(value = "/webhook", consumes = "application/json")
    public ResponseEntity<String> receiveWebhookJson(@RequestBody String body) {
        try {
            Map<String, Object> event = mapper.readValue(body,
                    new TypeReference<Map<String, Object>>() {});
            String sessionId = (String) event.get("sessionid");
            String eventId = (String) event.getOrDefault("eventid", "UNKNOWN");

            WebhookEventLogger.logWebhook(sessionId, eventId, event);

            if (sessionId != null) {
                tracker.onWebhookReceived(sessionId, event);
            }
        } catch (Exception e) {
            System.out.println("[Webhook] Failed to parse JSON body: " + e.getMessage());
        }
        return ResponseEntity.ok("OK");
    }

    @RequestMapping(value = "/webhook", method = {RequestMethod.GET})
    public ResponseEntity<String> receiveWebhookParams(
            @RequestParam(value = "sessionid", required = false) String sessionId,
            @RequestParam(value = "eventid", required = false) String eventId,
            @RequestParam(value = "data", required = false) String data,
            @RequestParam(value = "issued", required = false) String issued,
            @RequestParam(value = "docid", required = false) String docId,
            @RequestParam(value = "externtoken", required = false) String externToken,
            @RequestParam(value = "type", required = false) String type) {

        Map<String, Object> event = new LinkedHashMap<>();
        if (sessionId != null) event.put("sessionid", sessionId);
        event.put("eventid", eventId != null ? eventId : "UNKNOWN");
        if (data != null) event.put("data", data);
        if (issued != null) event.put("issued", issued);
        if (docId != null) event.put("docid", docId);
        if (externToken != null) event.put("externtoken", externToken);
        if (type != null) event.put("type", type);

        WebhookEventLogger.logWebhook(sessionId, eventId, event);

        if (sessionId != null) {
            tracker.onWebhookReceived(sessionId, event);
        }

        return ResponseEntity.ok("OK");
    }
}
