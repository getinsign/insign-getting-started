package de.is2.insign.javapi;

import java.util.Scanner;

import de.is2.sign.service.rest.json.JSONBasicResult;
import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONDocumentDataStatus;
import de.is2.sign.service.rest.json.JSONSessionResult;
import de.is2.sign.service.rest.json.JSONSessionStatusResult;

public class DeleteDocumentDemo {

	private static String insignURL = ApiData.insignURL;
	private static String callbackURL = ApiData.callbackURL;
	private static String controllerName = ApiData.controllerName;
	private static String controllerPassword = ApiData.controllerPassword;
	private static String userID = ApiData.userID;

	public static void main(final String[] args) throws Exception {
		String sessionID;
		if (args == null || args.length == 0 || args[0] == null) {
			InSignApiLogger.jlog.debug("Bitte geben Sie eine SessionID an:");
			Scanner scanIn = new Scanner(System.in);
			sessionID = scanIn.nextLine();
			scanIn.close();
		} else {
			sessionID = args[0];
		}

		// Step 1: Create an adapter
		@SuppressWarnings({ "rawtypes", "unchecked" })
		final InSignAdapter<?> adapter = new InSignAdapter(new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword));

		// Step 2: Create the configuration for a session:
		final InSignConfigurationData configData = InSignConfigurationBuilder.createSessionConfiguration();
		final JSONConfigureSession cfg = configData.getConfigureSession();
		cfg.setCallbackURL(callbackURL);
		
		// Status messages are sent to the ServersidecallbackURL if it is set.
		// cfg.setServerSidecallbackURL("http://.../servercallback");
		// This should be the ID of the logged-in user, so that
		// the pairing to the smartphone can be stored permanently for each user.
		
		// For tests, use either always the same ID or a random ID.
		cfg.setForuser(userID);
		
		// User sees only the PDF editor (no inSign process management etc.)
		cfg.setDisplayname("Antrag Leben");

		final InSignSessionHandle inSignSessionHandleToLoad = new InSignSessionHandle(sessionID, "");
		JSONSessionResult loadSession = adapter.loadSession(inSignSessionHandleToLoad, configData);
		JSONSessionStatusResult status = adapter.getStatus(inSignSessionHandleToLoad);

		for (JSONDocumentDataStatus jsonDocumentData : status.getDocumentData()) {
			JSONBasicResult deleteDocumentfromSession = adapter.deleteDocumentfromSession(inSignSessionHandleToLoad, jsonDocumentData.getDocid());
			InSignApiLogger.jlog.debug(deleteDocumentfromSession.getMessage());
		}
	}
}
