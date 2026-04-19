package com.example.insign;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ansi.AnsiColor;
import org.springframework.boot.ansi.AnsiOutput;
import org.springframework.boot.ansi.AnsiStyle;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Prints a green "Ready — open <url>" line once the webapp is listening.
 * The URL is wrapped in an OSC 8 hyperlink escape so terminals that support
 * it (iTerm2, Windows Terminal, WezTerm, VS Code, recent GNOME/KDE) render
 * it clickable; other terminals just show the plain URL text.
 */
@Component
public class StartupBanner {

    @Value("${server.port:8090}")
    private int port;

    @EventListener(ApplicationReadyEvent.class)
    public void printReadyBanner() {
        String url = "http://localhost:" + port;
        String hyperlink = "\u001B]8;;" + url + "\u001B\\" + url + "\u001B]8;;\u001B\\";

        String line = AnsiOutput.toString(
                AnsiColor.BRIGHT_GREEN, AnsiStyle.BOLD, "✓ Ready", AnsiStyle.NORMAL,
                AnsiColor.DEFAULT, " — open ",
                AnsiColor.BRIGHT_CYAN, hyperlink,
                AnsiColor.DEFAULT);

        System.out.println();
        System.out.println(line);
        System.out.println();
    }
}
