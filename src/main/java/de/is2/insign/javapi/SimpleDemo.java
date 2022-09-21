package de.is2.insign.javapi;

import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONDeliveryConfig;
public class SimpleDemo extends DemoBase {

	private String insignURL = ApiData.insignURL;
	private String callbackURL = ApiData.callbackURL;
	private String controllerName = ApiData.controllerName;
	private String controllerPassword = ApiData.controllerPassword;
	private String userID = ApiData.userID;

	public static void main(final String[] args) throws Exception {
		new SimpleDemo().run(args);
	}

	@SuppressWarnings({ "unchecked", "rawtypes" })
	public void run(final String[] args) throws Exception {
		if (args.length > 0) insignURL = args[0];
		if (args.length > 1) controllerPassword = args[1];

		// Step 1: Create an adapter
		IInSignTransportAdapterFactory factory;
		if (args.length > 2 && "apache".equalsIgnoreCase(args[2])) {
			factory = new InSignTransPortAdpaterFactoryApacheHttpClient(insignURL, controllerName, controllerPassword);
		} else {
			factory = new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword);
		}
		final InSignAdapter adapter = new InSignAdapter(factory);

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

		cfg.setDeliveryConfig(new JSONDeliveryConfig());
		
		cfg.getDeliveryConfig().setEmailEmpfaenger("musterman@test1.com;musterman@test2.com");
		// Add a document to the configuration
		InSignConfigurationBuilder.addDokument(configData, "test123", this.getClass().getClassLoader().getResourceAsStream("test.pdf"));

		// Step 3: Now send the configuration to inSign. Returns a session
		// handle which can be used to access this process again later on
		// e.g. after the callback from inSign is done
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		// Step 4: Redirect user to inSign. Simulated here by browser call.
		Runtime.getRuntime().exec("cmd.exe /c start " + adapter.createStartURL(inSignSessionHandle));
		// Log.jlog.debug(adapter.createStartURL(inSignSessionHandle));

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
