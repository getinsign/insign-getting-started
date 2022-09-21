package de.is2.insign.javapi;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;

import org.apache.commons.io.FileUtils;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import de.is2.sign.service.rest.json.JSONConfigureDocument;
import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONSessionData;

@SuppressWarnings("restriction")
public class DemoFormular extends DemoBase {

	private static String insignURL = ApiData.insignURL;
	private static String callbackURL = ApiData.callbackURL;
	private static String controllerName = ApiData.controllerName;
	private static String controllerPassword = ApiData.controllerPassword;
	private static String userID = ApiData.userID;

	public static void main(final String[] args) throws Exception {

		// Step 1: Create an adapter
		@SuppressWarnings({ "rawtypes", "unchecked" })
		final InSignAdapter adapter = new InSignAdapter(new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword));

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

		// Add a document to the configuration

		byte[] ba = FileUtils.readFileToByteArray(new File("src/test/resources/konto.pdf"));
		ByteArrayInputStream docbinary = new ByteArrayInputStream(ba);
		JSONConfigureDocument doc = InSignConfigurationBuilder.addDokument(configData, "konto", docbinary);
		doc.setMustberead(false);
		doc.setAllowFormEditing(false);

		// Step 3: Now send the configuration to inSign. Delivers a session
		// handle which can be used to access this process again later on.
		// e.g. after the callback from inSign has been done
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		final Gson gson = new GsonBuilder().create();
		String jsonString = FileUtils.readFileToString(new File("src/test/resources/kontoformular.json"));
		JSONSessionData data = gson.fromJson(jsonString, JSONSessionData.class);

		adapter.storeFormData(inSignSessionHandle, data);

		// Step 4: Redirect user to inSign. Simulated here by browser call.
		InSignApiLogger.jlog.debug(adapter.createStartURL(inSignSessionHandle).toString());
		Runtime.getRuntime().exec("cmd.exe /c start " + adapter.createStartURL(inSignSessionHandle));

		// Step 5: Retrieve status and document and delete the process.
		// This is done traditionally after the callback from inSign (i.e. when inSign is finished).
		// Is simulated here by simple polling.

		// Simple HTTP server that catches the callbacks from inSign only works with Sun-JDK.
		final HttpServer server = HttpServer.create(new InetSocketAddress(8493), 0);
		server.createContext("/clientcallback", new HttpHandler() {
			@Override
			public void handle(final HttpExchange ex) throws IOException {
				// Output status
				try {
					InSignApiLogger.jlog.debug(adapter.getStatus(inSignSessionHandle).toString());
					// Retrieve and display document + Delete the process
					fetchAndShowDocument(adapter, inSignSessionHandle);
					ex.sendResponseHeaders(200, 2);
					ex.getResponseBody().write("OK".getBytes("UTF-8"));
				} catch (final InSignAdapterException e) {
					e.printStackTrace();
				}
			}
		});
		server.start();

		// Alternative: simply use polling …
		//
		// boolean done = false;
		// while (done == false) {
		//     Thread.sleep(1000);
		//     JSONSessionStatusResult status = adapter.getStatus(inSignSessionHandle);
		//     Log.jlog.debug(status);
		//     done = status.isSucessfullyCompleted();
		// };
		// fetchAndShowDocument(adapter,inSignSessionHandle);
	}
}
