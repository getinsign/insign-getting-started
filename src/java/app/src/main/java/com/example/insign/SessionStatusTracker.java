package com.example.insign;

import com.example.insign.model.InsignSignatureFieldStatus;
import com.example.insign.model.InsignStatusResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks session status changes and broadcasts them to connected SSE clients.
 * Uses the common {@link InsignStatusResult} POJO - works with both implementations.
 */
@Component
public class SessionStatusTracker {

    private final Map<String, InsignStatusResult> lastKnownStatus = new ConcurrentHashMap<>();
    private final Map<String, Boolean> webhookReceived = new ConcurrentHashMap<>();
    private final SseEmitterManager sseManager = new SseEmitterManager();
    private final ObjectMapper mapper = new ObjectMapper();

    public SseEmitter registerEmitter() {
        return sseManager.registerEmitter();
    }

    public void onWebhookReceived(String sessionId, Map<String, Object> eventData) {
        webhookReceived.put(sessionId, true);
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("event", "webhook");
        event.put("sessionId", sessionId);
        event.put("status", eventData);
        try {
            sseManager.broadcast("webhook", mapper.writeValueAsString(event));
        } catch (Exception e) {
            // serialization failure
        }
    }

    public void onPollResult(String sessionId, InsignStatusResult status) {
        InsignStatusResult previous = lastKnownStatus.get(sessionId);
        lastKnownStatus.put(sessionId, status);

        if (previous == null) {
            printStatusChange(sessionId, status, "Initial status");
            broadcastStatus("status-change", sessionId, status);
            return;
        }

        if (hasChanges(previous, status)) {
            broadcastStatus("status-change", sessionId, status);
        }

        detectChanges(sessionId, previous, status);
    }

    public boolean hasWebhookSupport(String sessionId) {
        return webhookReceived.getOrDefault(sessionId, false);
    }

    public InsignStatusResult getLastStatus(String sessionId) {
        return lastKnownStatus.get(sessionId);
    }

    private boolean hasChanges(InsignStatusResult previous, InsignStatusResult current) {
        return countSignedFields(previous) != countSignedFields(current)
                || previous.isSucessfullyCompleted() != current.isSucessfullyCompleted();
    }

    private void broadcastStatus(String eventType, String sessionId, InsignStatusResult status) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("event", eventType);
        event.put("sessionId", sessionId);
        event.put("status", status);
        try {
            sseManager.broadcast(eventType, mapper.writeValueAsString(event));
        } catch (Exception e) {
            // serialization failure
        }
    }

    private void detectChanges(String sessionId, InsignStatusResult previous, InsignStatusResult current) {
        int prevSigned = countSignedFields(previous);
        int currSigned = countSignedFields(current);
        if (currSigned != prevSigned) {
            printStatusChange(sessionId, current,
                    currSigned + " field(s) signed (was " + prevSigned + ")");
        }
        if (!previous.isSucessfullyCompleted() && current.isSucessfullyCompleted()) {
            printStatusChange(sessionId, current, "SESSION SUCCESSFULLY COMPLETED");
        }
    }

    private int countSignedFields(InsignStatusResult status) {
        int count = 0;
        List<InsignSignatureFieldStatus> fields = status.getSignaturFieldsStatusList();
        if (fields != null) {
            for (InsignSignatureFieldStatus field : fields) {
                if (field.isSigned()) count++;
            }
        }
        return count;
    }

    private void printStatusChange(String sessionId, InsignStatusResult status, String message) {
        System.out.println("\n--- [Poll] " + message + " ---");
        System.out.println("  Session: " + sessionId);
        System.out.println("  Completed: " + status.isSucessfullyCompleted());
    }
}
