package com.example.insign;

import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.logging.LogEntry;
import org.openqa.selenium.logging.LogType;
import org.openqa.selenium.logging.LoggingPreferences;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.time.Duration;
import java.util.List;
import java.util.logging.Level;

import static org.junit.jupiter.api.Assertions.*;

/**
 * UI integration test using Selenium + headless Chromium.
 * Starts the Spring Boot app on a random port, opens the browser,
 * and clicks through the main workflow: create session, check status,
 * send invitations, then purge.
 *
 * Acceptance criteria:
 * - JSON responses are reasonable (non-empty, no error signaled)
 * - No errors in the browser console
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "app.console.enabled=false"
)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class UiIntegrationTest {

    @LocalServerPort
    private int port;

    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeAll
    void setUp() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments(
                "--headless=new",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1280,1024"
        );

        // Enable browser console log capture
        LoggingPreferences logPrefs = new LoggingPreferences();
        logPrefs.enable(LogType.BROWSER, Level.SEVERE);
        options.setCapability("goog:loggingPrefs", logPrefs);

        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(60));
    }

    @AfterAll
    void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    /** Click an element via JavaScript to avoid ElementNotInteractable issues */
    private void jsClick(WebElement element) {
        ((JavascriptExecutor) driver).executeScript("arguments[0].click();", element);
    }

    /** Scroll an element into view */
    private void scrollTo(WebElement element) {
        ((JavascriptExecutor) driver).executeScript(
                "arguments[0].scrollIntoView({block:'center'});", element);
    }

    /** Wait for a response card with the given title to appear in the response list */
    private WebElement waitForResponseCard(String title) {
        return wait.until(d -> {
            for (WebElement card : d.findElements(By.cssSelector("#response-list .response-card"))) {
                WebElement header = card.findElement(By.cssSelector(".card-header span:first-child"));
                if (header.getText().contains(title)) {
                    return card;
                }
            }
            return null;
        });
    }

    /** Extract the JSON text from a response card's last pre element */
    private String getResponseJson(WebElement card) {
        List<WebElement> pres = card.findElements(By.cssSelector(".card-body pre"));
        return pres.get(pres.size() - 1).getText();
    }

    /** Extract the request JSON from a response card's first pre element */
    private String getRequestJson(WebElement card) {
        List<WebElement> pres = card.findElements(By.cssSelector(".card-body pre"));
        return pres.get(0).getText();
    }

    /** Assert response JSON is reasonable: non-empty, min size, no error flag */
    private void assertReasonableJson(String json, String context) {
        assertNotNull(json, context + ": response should not be null");
        assertTrue(json.length() > 10, context + ": response too small (" + json.length() + " chars)");
        assertFalse(json.contains("\"error\": true") || json.contains("\"error\":true"),
                context + ": response signals error");
    }

    /** Check browser console for SEVERE errors and fail if any found */
    private void assertNoBrowserConsoleErrors() {
        List<LogEntry> logs = driver.manage().logs().get(LogType.BROWSER).getAll();
        List<LogEntry> errors = logs.stream()
                .filter(e -> e.getLevel() == Level.SEVERE)
                // Ignore SSE reconnection noise, favicon, and post-purge polling
                .filter(e -> !e.getMessage().contains("/api/events")
                        && !e.getMessage().contains("favicon")
                        && !e.getMessage().contains("status of 400"))
                .toList();
        assertTrue(errors.isEmpty(),
                "Browser console has errors:\n" + errors.stream()
                        .map(LogEntry::getMessage)
                        .reduce("", (a, b) -> a + "\n" + b));
    }

    @Test
    @Order(1)
    void pageLoads() {
        driver.get(baseUrl());
        wait.until(ExpectedConditions.presenceOfElementLocated(By.id("btn-create")));
        assertEquals("inSign API - Getting Started Java Sample Application", driver.getTitle());
    }

    @Test
    @Order(2)
    void createSession() {
        WebElement createBtn = driver.findElement(By.id("btn-create"));
        assertTrue(createBtn.isDisplayed());
        createBtn.click();

        // Wait for session-actions to become visible (session created successfully)
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("session-actions")));

        // Verify response card appeared with reasonable JSON
        WebElement card = waitForResponseCard("Create Session");
        String json = getResponseJson(card);
        assertReasonableJson(json, "Create Session");
        assertTrue(json.contains("sessionid"), "Response should contain sessionid");

        // Verify request JSON is also shown
        List<WebElement> labels = card.findElements(By.cssSelector(".response-label"));
        assertTrue(labels.size() >= 2, "Should have Request and Response labels");
        String requestJson = getRequestJson(card);
        assertTrue(requestJson.contains("foruser"), "Request should contain foruser");
        assertTrue(requestJson.contains("signatureLevel"), "Request should contain signatureLevel");

        // Verify status bar updates (async via polling, may take a moment)
        wait.until(d -> {
            String text = d.findElement(By.id("sb-session")).getText();
            return !"-".equals(text);
        });
    }

    @Test
    @Order(3)
    void checkStatus() {
        WebElement btn = driver.findElement(
                By.cssSelector("[onclick*=\"apiGet('/api/session/status'\"]"));
        scrollTo(btn);
        jsClick(btn);

        WebElement card = waitForResponseCard("Status");
        String json = getResponseJson(card);
        assertReasonableJson(json, "Status");
        assertTrue(json.contains("signaturFieldsStatusList") || json.contains("sessionid"),
                "Status response should contain session data");
    }

    @Test
    @Order(4)
    void checkStatusLightweight() {
        WebElement btn = driver.findElement(
                By.cssSelector("[onclick*=\"apiGet('/api/session/checkstatus'\"]"));
        scrollTo(btn);
        jsClick(btn);

        WebElement card = waitForResponseCard("Check Status");
        String json = getResponseJson(card);
        assertReasonableJson(json, "Check Status");
    }

    @Test
    @Order(5)
    void sendInvitations() {
        WebElement btn = driver.findElement(
                By.cssSelector("[onclick*=\"inviteExtern()\"]"));
        scrollTo(btn);
        jsClick(btn);

        WebElement card = waitForResponseCard("Invite Extern");
        String json = getResponseJson(card);
        assertReasonableJson(json, "Invite Extern");

        // Verify request JSON is shown
        List<WebElement> labels = card.findElements(By.cssSelector(".response-label"));
        assertTrue(labels.size() >= 2, "Should have Request and Response labels");
        String requestJson = getRequestJson(card);
        assertTrue(requestJson.contains("externUsers"), "Request should contain externUsers");
        assertTrue(requestJson.contains("sessionid"), "Request should contain sessionid");
    }

    @Test
    @Order(6)
    void externUsers() {
        WebElement btn = driver.findElement(
                By.cssSelector("[onclick*=\"apiGet('/api/extern/users'\"]"));
        scrollTo(btn);
        jsClick(btn);

        WebElement card = waitForResponseCard("Extern Users");
        String json = getResponseJson(card);
        assertReasonableJson(json, "Extern Users");
    }

    @Test
    @Order(7)
    void purgeSession() {
        WebElement btn = driver.findElement(
                By.cssSelector("[onclick*=\"purgeSession()\"]"));
        scrollTo(btn);
        jsClick(btn);

        WebElement card = waitForResponseCard("Purge Session");
        String json = getResponseJson(card);
        assertTrue(json.contains("purged"), "Purge response should confirm deletion");

        // Session actions should be hidden again
        wait.until(ExpectedConditions.invisibilityOfElementLocated(By.id("session-actions")));
    }

    @Test
    @Order(8)
    void noBrowserConsoleErrors() {
        assertNoBrowserConsoleErrors();
    }
}
