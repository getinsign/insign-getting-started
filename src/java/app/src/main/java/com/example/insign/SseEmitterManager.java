package com.example.insign;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Manages SSE (Server-Sent Events) emitters for broadcasting real-time updates
 * to connected browser clients.
 *
 * Shared by both module implementations. Handles emitter lifecycle (registration,
 * cleanup on disconnect/timeout/error) and broadcasting JSON strings to all clients.
 */
public class SseEmitterManager {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /**
     * Registers a new SSE emitter for a browser client.
     * The emitter stays open indefinitely (timeout = 0) and is automatically
     * removed when the client disconnects.
     */
    public SseEmitter registerEmitter() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        return emitter;
    }

    /**
     * Sends an SSE event to all connected browser clients.
     * Failed emitters (disconnected clients) are automatically removed.
     *
     * @param eventType the SSE event name (e.g., "webhook", "status-change")
     * @param json      the JSON payload string
     */
    public void broadcast(String eventType, String json) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventType).data(json));
            } catch (IOException e) {
                emitters.remove(emitter);
            }
        }
    }
}
