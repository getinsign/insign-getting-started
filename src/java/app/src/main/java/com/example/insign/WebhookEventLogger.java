package com.example.insign;

import java.util.Map;

/**
 * Shared utility for logging inSign webhook events to the console.
 * Used by both the Spring RestClient and insign-java-api webhook controllers.
 */
public final class WebhookEventLogger {

    private WebhookEventLogger() {}

    /**
     * Logs a formatted summary of a received webhook event.
     *
     * @param sessionId the session the event was fired for
     * @param eventId   the event type identifier
     * @param fields    optional extra fields (docid, data, issued, externtoken, type)
     */
    public static void logWebhook(String sessionId, String eventId, Map<String, ?> fields) {
        System.out.println("\n========== WEBHOOK RECEIVED ==========");
        System.out.println("  Event:   " + eventId);
        System.out.println("  Session: " + sessionId);
        if (fields != null) {
            printIfPresent(fields, "docid", "DocID");
            printIfPresent(fields, "data", "Data");
            printIfPresent(fields, "issued", "Issued");
            printIfPresent(fields, "externtoken", "Extern");
            printIfPresent(fields, "type", "Type");
        }
        printEventDescription(eventId);
        System.out.println("=======================================\n");
    }

    private static void printIfPresent(Map<String, ?> fields, String key, String label) {
        Object value = fields.get(key);
        if (value != null) {
            System.out.println("  " + label + ":   " + value);
        }
    }

    /**
     * Returns a human-readable description for an inSign event ID.
     */
    public static String getEventDescription(String eventId) {
        if (eventId == null) return "Unknown event";
        return switch (eventId) {
            case "SIGNATURERSTELLT" -> "A signature was provided";
            case "EXTERNBEARBEITUNGFERTIG" -> "All external users finished";
            case "EXTERNBEARBEITUNGSTART" -> "External processing started";
            case "VORGANGABGESCHLOSSEN" -> "Session successfully completed";
            case "SESSIONREMINDER" -> "Owner reminder fired";
            case "EXTERNREMINDER" -> "External user reminder fired";
            case "SINGLEEXTERNALUSERCOMPLETEDPROCESSING" -> "One extern user completed";
            case "VORGANGVERLASSEN" -> "Process completed by owner (ignoring sign status)";
            case "VORGANGABGELEHNT" -> "Owner declined";
            case "VORGANGABGELEHNTEXTERN" -> "External user declined";
            case "SIGNATURESDELETEDDOC" -> "Signatures deleted for document";
            case "SIGNATURESDELETEDSESSION" -> "Signatures deleted for whole process";
            case "DOCUMENTCHANGED" -> "Document was changed";
            case "PROCESSDELETEDBYAGE" -> "Process deleted (maxageindays)";
            case "EXTERNEXPIRED" -> "Extern process retrieved by autofinish";
            case "VORGANGERSTELLT" -> "Process created, all documents uploaded";
            case "COMMUNICATIONERROR" -> "Error sending email or SMS";
            case "SIGNATUREERROR" -> "Error during signing";
            case "DELETIONWARNING" -> "Session will be deleted for inactivity";
            case "EXTERNABORT" -> "Signature request cancelled, returned to owner";
            case "PROCESSRENAMED" -> "Process was renamed";
            case "DOCUMENTRENAMED" -> "Document was renamed";
            case "CHANGEOWNER" -> "Process owner changed";
            case "PROCESSDELETED" -> "Process was deleted manually";
            case "DOCUMENTDELETED" -> "Document was deleted";
            default -> "Unknown event";
        };
    }

    private static void printEventDescription(String eventId) {
        String desc = getEventDescription(eventId);
        System.out.println("  --> " + desc);
    }
}
