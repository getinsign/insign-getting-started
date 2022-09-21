package de.is2.insign.javapi;

import de.is2.sign.service.rest.json.JSONConfigureSession;

public class CallDemoWithProxy extends DemoBase {

	private String insignURL = ApiData.insignURL;
	private String callbackURL = ApiData.callbackURL;
	private String controllerName = ApiData.controllerName;
	private String controllerPassword = ApiData.controllerPassword;
	private String userID = ApiData.userID;

	/**
	 * @Desc: The host name or Host IP address for proxy server
	 */
	private static String proxyHost = "127.0.0.1";

	/**
	 * @Desc: The port for proxy server
	 */
	private static int proxyPort = 8080;
	/**
	 * @Desc: The proxy user name for Authentication
	 */
	private static String proxyUser = "proxy";
	/**
	 * @Desc: The proxy password for Authentication
	 */
	private static String proxyPass = "proxy";
	/**
	 * @Desc: The proxy domain, if there is domain defined pass an empty String ""
	 */
	private static String proxyDomain = "proxy.domain";

	/**
	 * @Desc: if authentication is required true otherwise false
	 * @param args
	 * @throws Exception
	 */
	private static boolean proxyAuthRequired = false;

	public static void main(final String[] args) throws Exception {
		new CallDemoWithProxy().run(args);
	}

	@SuppressWarnings({ "unchecked", "rawtypes" })
	public void run(final String[] args) throws Exception {
		if (args.length > 0) insignURL = args[0];
		if (args.length > 1) controllerPassword = args[1];
		if (args.length > 2) proxyHost = args[2];
		if (args.length > 3) proxyPort = Integer.valueOf(args[3]);
		if (args.length > 4) proxyUser = args[4];
		if (args.length > 5) proxyPass = args[5];
		if (args.length > 6) proxyDomain = args[6];

		// Step 1: Create an adapter
		IInSignTransportAdapterFactory factory;
		InSignAdapterProxySettings proxySettings;
		if (proxyAuthRequired) proxySettings = new InSignAdapterProxySettings(proxyHost, proxyPort, proxyUser, proxyPass, proxyDomain, true);
		else proxySettings = new InSignAdapterProxySettings(proxyHost, proxyPort, proxyDomain, false);

		factory = new InSignTransPortAdpaterFactoryApacheHttpClient(insignURL, controllerName, controllerPassword, proxySettings, null);
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
		// Add a document to the configuration
		InSignConfigurationBuilder.addDokument(configData, "docid1", this.getClass().getClassLoader().getResourceAsStream("test.pdf"));

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
