package de.is2.insign.javapi;

import java.io.InputStream;

import de.is2.sign.service.rest.json.JSONConfigureSession;

public class SimpleAushaendigenDemo {
	private static final String insignURL = ApiData.insignURL;
	private static final String callbackURL = ApiData.callbackURL;
	private static final String controllerName = ApiData.controllerName;
	private static final String controllerPassword = ApiData.controllerPassword;
	private static final String userID = ApiData.userID;

	public static void main(final String[] args) throws Exception {
		SimpleAushaendigenDemo demo = new SimpleAushaendigenDemo();
		demo.startInsign();
	}

	private void startInsign() throws Exception {
		// Step 1: Create an adapter
		@SuppressWarnings({ "rawtypes", "unchecked" })
		final InSignAdapter adapter = new InSignAdapter(new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword));

		// Step 2: Create the configuration for a session:
		final InSignConfigurationData configData = InSignConfigurationBuilder.createSessionConfiguration();
		final JSONConfigureSession cfg = configData.getConfigureSession();

		cfg.setCallbackURL(callbackURL);
		// Status messages are sent to the serversidecallbackURL if it is set.
		// This should be the ID of the logged-in user, so that
		// the pairing to the smartphone can be stored permanently for each user.

		// For tests, use either always the same ID or a random ID
		cfg.setForuser(userID);

		// User sees only the PDF editor (no inSign process management etc.)
		cfg.setDisplayname("Antrag Leben");
		cfg.setAushaendigenPflicht(true);

		// Add a document to the configuration
		InSignConfigurationBuilder.addDokument(configData, "docid1", getFileStream("test.pdf"));
		InSignConfigurationBuilder.addMustbereadDokument(configData, "docid2", getFileStream("vvg.pdf"));

		// Step 3: Now send the configuration to inSign. Returns a session
		// handle which can be used to access this process again later on
		// e.g. after the callback from inSign is done
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		// Step 4: Redirect user to inSign. Simulated here by browser call.
		Runtime.getRuntime().exec("cmd.exe /c start " + adapter.createStartURL(inSignSessionHandle));
	}

	private InputStream getFileStream(String filename) {
		return this.getClass().getClassLoader().getResourceAsStream(filename);
	}
}
