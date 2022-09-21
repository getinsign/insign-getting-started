package de.is2.insign.javapi;

import de.is2.sign.service.rest.json.JSONConfigureSession;

public class SimpleVorgangsverwaltung extends DemoBase {

	private String insignURL = ApiData.insignURL;
	private String controllerName = ApiData.controllerName;
	private String controllerPassword = ApiData.controllerPassword;
	private String userID = ApiData.userID;

	public static void main(final String[] args) throws Exception {
		new SimpleVorgangsverwaltung().run(args);
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
		cfg.setDisplayname("Vorgangsverwaltung");
		cfg.setForuser(userID);
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		Runtime.getRuntime().exec("cmd.exe /c start " + adapter.createVorgansverwaltungURL(inSignSessionHandle, "http://localhost:8493/clientcallback"));
	}
}
