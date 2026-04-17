package com.example.insign;

import com.example.insign.model.InsignStatusResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Background scheduled task that periodically polls the inSign API for status updates.
 * Uses the common {@link InsignApiService} interface - works with both implementations.
 */
@Component
public class StatusPoller {

    private final InsignApiService apiService;
    private final SessionStatusTracker tracker;
    private final Set<String> watchedSessions = ConcurrentHashMap.newKeySet();

    @Value("${insign.polling.interval-seconds:5}")
    private int pollingIntervalSeconds;

    public StatusPoller(InsignApiService apiService, SessionStatusTracker tracker) {
        this.apiService = apiService;
        this.tracker = tracker;
    }

    public void watchSession(String sessionId) {
        watchedSessions.add(sessionId);
        System.out.println("[Poller] Now watching session: " + sessionId);
    }

    public void unwatchSession(String sessionId) {
        watchedSessions.remove(sessionId);
    }

    @Scheduled(fixedDelayString = "${insign.polling.interval-seconds:5}000")
    public void poll() {
        for (String sessionId : watchedSessions) {
            if (tracker.hasWebhookSupport(sessionId)) {
                continue;
            }
            try {
                InsignStatusResult status = apiService.checkStatus(sessionId);
                tracker.onPollResult(sessionId, status);

                String sessionStatus = status.getStatus();
                if ("COMPLETED".equalsIgnoreCase(sessionStatus)
                        || "DELETED".equalsIgnoreCase(sessionStatus)) {
                    watchedSessions.remove(sessionId);
                    System.out.println("[Poller] Session " + sessionId
                            + " reached terminal state: " + sessionStatus);
                }
            } catch (Exception e) {
                System.out.println("[Poller] Error polling " + sessionId + ": " + e.getMessage());
            }
        }
    }
}
