package com.example.insign;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the inSign Getting Started sample application.
 *
 * This is the common Spring Boot entry point. The actual API client implementation
 * is provided by whichever submodule is on the classpath (spring-insign-api-client-impl
 * or insign-client-api-impl). Spring auto-discovers the {@link InsignApiService}
 * implementation via component scanning.
 */
@SpringBootApplication
@EnableScheduling
public class InsignGettingStartedApp {

    public static void main(String[] args) {
        SpringApplication.run(InsignGettingStartedApp.class, args);
    }
}
