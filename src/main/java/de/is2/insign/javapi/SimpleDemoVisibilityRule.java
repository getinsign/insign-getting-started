package de.is2.insign.javapi;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import de.is2.sign.service.rest.json.JSONConfigureDocument;
import de.is2.sign.service.rest.json.JSONConfigureSession;

public class SimpleDemoVisibilityRule extends DemoBase {

	private String insignURL = ApiData.insignURL;
	private String callbackURL = ApiData.callbackURL;
	private String controllerName = ApiData.controllerName;
	private String controllerPassword = ApiData.controllerPassword;
	private String userID = ApiData.userID;

	public static void main(final String[] args) throws Exception {
		new SimpleDemoVisibilityRule().run(args);
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
		// Status messages are sent to the ServersidecallbackURL if it is set.
		// cfg.setServerSidecallbackURL("http://.../servercallback");
		// This should be the ID of the logged-in user, so that
		// the pairing to the smartphone can be stored permanently for each user.
		
		// For tests, use either always the same ID or a random ID
		cfg.setForuser(userID);
		
		// Add a document to the configuration
		cfg.setUserFullName("hansmusterrr");
		cfg.setDisplayname("testBundle");
		cfg.setUserEmail(" ");
		cfg.setUploadEnabled(true);
		cfg.setPhotoUploadEnabled(true);
		cfg.setExternPhotoUploadEnabled(true);
		cfg.setAushaendigenPflicht(true);
		JSONConfigureDocument doc1 = InSignConfigurationBuilder.addDokument(configData, "one", this.getClass().getClassLoader().getResourceAsStream("test.pdf"));
		JSONConfigureDocument doc2 = InSignConfigurationBuilder.addDokument(configData, "two", this.getClass().getClassLoader().getResourceAsStream("test.pdf"));
		JSONConfigureDocument doc3 = InSignConfigurationBuilder.addDokument(configData, "three", this.getClass().getClassLoader().getResourceAsStream("test.pdf"));
		JSONConfigureDocument doc4 = InSignConfigurationBuilder.addDokument(configData, "four", this.getClass().getClassLoader().getResourceAsStream("test.pdf"));

		// Collection<JSONConfigureDocument> documents = Arrays.asList(doc1,
		// doc2,doc3,doc4);
		// cfg.setDocuments(documents);

		// Today:
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);
		List<String> li = new ArrayList<String>();
		li.add("one");
		li.add("two");
		li.add("three");
		li.add("four");
		URI bundleurl = adapter.createBundelURL(inSignSessionHandle, li);
		System.out.println(bundleurl);

		// Future:
		URI bundleurl2 = adapter.createStartURL(inSignSessionHandle);
		System.out.println(bundleurl2);
	}
}
