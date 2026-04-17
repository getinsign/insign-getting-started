package com.example.insign;

/**
 * Thrown when the inSign API returns an error response.
 *
 * There are two scenarios where this exception is raised:
 * 1. HTTP-level errors (4xx/5xx status codes)
 * 2. Application-level errors - the inSign API may return HTTP 200 but include
 *    a non-zero error code in the JSON body
 *
 * The exception carries the HTTP status code and optionally the raw response body
 * for debugging and structured error responses.
 */
public class InsignApiException extends RuntimeException {

    private final int httpStatus;
    private final String responseBody;

    public InsignApiException(int httpStatus, String message, String responseBody) {
        super(message);
        this.httpStatus = httpStatus;
        this.responseBody = responseBody;
    }

    public InsignApiException(int httpStatus, String message) {
        this(httpStatus, message, (String) null);
    }

    public InsignApiException(String message) {
        this(500, message, (String) null);
    }

    public InsignApiException(String message, Throwable cause) {
        super(message, cause);
        this.httpStatus = 500;
        this.responseBody = null;
    }

    public InsignApiException(int httpStatus, String message, Throwable cause) {
        super(message, cause);
        this.httpStatus = httpStatus;
        this.responseBody = null;
    }

    public int getHttpStatus() {
        return httpStatus;
    }

    public String getResponseBody() {
        return responseBody;
    }
}
