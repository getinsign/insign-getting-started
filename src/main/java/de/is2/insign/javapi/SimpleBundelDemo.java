package de.is2.insign.javapi;

import java.io.FileInputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import de.is2.sign.service.rest.json.JSONConfigureSession;

public class SimpleBundelDemo extends DemoBase {

	private static final String insignURL = ApiData.insignURL;
	private static final String callbackURL = ApiData.callbackURL;
	private static final String controllerName = ApiData.controllerName;
	private static final String controllerPassword = ApiData.controllerPassword;
	private static final String userID = ApiData.userID;

	public static void main(final String[] args) throws Exception {
		// Step 1: Create an adapter
		@SuppressWarnings({ "rawtypes", "unchecked" })
		final InSignAdapter<?> adapter = new InSignAdapter(new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword));

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

		List<String> docList = new ArrayList<String>();
		docList.add("docid1");
		docList.add("docid2");
		docList.add("docid3");
		docList.add("docid4");

		// Add a document to the configuration
		InSignConfigurationBuilder.addDokument(configData, docList.get(0), new FileInputStream("src/test/resources/test1.pdf"));
		InSignConfigurationBuilder.addDokument(configData, docList.get(1), new FileInputStream("src/test/resources/test2.pdf"));
		InSignConfigurationBuilder.addDokument(configData, docList.get(2), new FileInputStream("src/test/resources/test3.pdf"));
		InSignConfigurationBuilder.addDokument(configData, docList.get(3), new FileInputStream("src/test/resources/test4.pdf"));

		// Step 3: Now send the configuration to inSign. Returns a session
		// handle which can be used to access this process again later on
		// e.g. after the callback from inSign is done
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		// Step 4: Redirect user to inSign. Simulated here by browser call.
		URI createBundelURL = adapter.createBundelURL(inSignSessionHandle, docList);

		// Use Browser.exe at START otherwise the params will be truncated
		// Runtime.getRuntime().exec("cmd.exe /c start \"" +
		// createBundelURL.toString()+"\"");
		ProcessBuilder pb = new ProcessBuilder("C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", createBundelURL.toString());
		pb.redirectErrorStream(true).start();

		// JSONBasicResult deleteDocumentfromSession =
		// adapter.deleteDocumentfromSession(inSignSessionHandle, docList.get(0));
		// Log.jlog.debug(deleteDocumentfromSession.getMessage());
		// deleteDocumentfromSession
		// =adapter.deleteDocumentfromSession(inSignSessionHandle, docList.get(1));
		// Log.jlog.debug(deleteDocumentfromSession.getMessage());
		// deleteDocumentfromSession
		// =adapter.deleteDocumentfromSession(inSignSessionHandle, docList.get(2));
		// Log.jlog.debug(deleteDocumentfromSession.getMessage());
		// deleteDocumentfromSession
		// =adapter.deleteDocumentfromSession(inSignSessionHandle, docList.get(3));
		// Log.jlog.debug(deleteDocumentfromSession.getMessage());

		// Step 5: Retrieve status and document and delete operation. This is done
		// traditionally after the callback from inSign (i.e. when inSign is finished).
		// Is simulated here by simple polling.

		// Simple HTTP server that catches the callbacks from inSign Works only with Sun
		// JDK.
		// final HttpServer server = HttpServer.create(new InetSocketAddress(8493), 0);
		// server.createContext("/clientcallback",new HttpHandler(){
		// @Override
		// public void handle(HttpExchange ex) throws IOException {
		// // Output status
		// try {
		// Log.jlog.debug(adapter.getStatus(inSignSessionHandle));
		// // Get and display document + Delete process
		// fetchAndShowDocument(adapter,inSignSessionHandle);
		// ex.sendResponseHeaders(200, 2);
		// ex.getResponseBody().write("OK".getBytes());
		// } catch (InSignAdapterException e) {
		// e.printStackTrace();
		// }
		// }});
		// server.start();

		// Alternative: simply use polling …
		// boolean done = false;
		// while (done == false) {
		// Thread.sleep(1000);
		// JSONSessionStatusResult status = adapter.getStatus(inSignSessionHandle);
		// Log.jlog.debug(status);
		// done = status.isSucessfullyCompleted();
		// };
		// fetchAndShowDocument(adapter, inSignSessionHandle);
	}
}
