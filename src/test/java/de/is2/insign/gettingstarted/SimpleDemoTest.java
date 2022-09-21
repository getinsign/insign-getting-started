package de.is2.insign.gettingstarted;

import de.is2.insign.javapi.*;
import de.is2.sign.service.rest.json.JSONConfigureSession;
import org.junit.Test;

public class SimpleDemoTest {

	private static String insignURL = "https://sandbox.insign.is2.show/";
	private static String controllerName = "controller";
	private static String controllerPassword = "pwd.insign.sandbox.4561";

	public static void main(final String[] args) throws Exception {
		final SimpleDemo simpleDemo = new SimpleDemo();
		try {
			simpleDemo.executeApiCall();
		} catch (Exception ex) {
			ex.printStackTrace();
		}
	}

	@Test
	public void executeApiCall() throws Exception {
		// Step 1: Create an inSign adapter.
		InSignTransPortAdapterFactoryJod factory = new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword);
		final InSignAdapter adapter = new InSignAdapter(factory);

		// Step 2: Create the configuration for the session.
		final InSignConfigurationData configData = InSignConfigurationBuilder.createSessionConfiguration();
		final JSONConfigureSession cfg = configData.getConfigureSession();
		cfg.setCallbackURL("http://callbackToMyWebsite.com/");
		cfg.setForuser("owner_user_id");
		cfg.setDisplayname("My first inSign session");
		InSignConfigurationBuilder.addDokument(configData, "documentName", this.getClass().getClassLoader().getResourceAsStream("test.pdf"));

		// Step 3: Send the configuration to inSign.
		// A session handler is returned to be able to access the process later on.
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		System.out.println("**************************************************************************************************************************************************");
		System.out.println("**************************************************************************************************************************************************");
		System.out.println("Click this link to jump into inSign: "+adapter.createStartURL(inSignSessionHandle));
		System.out.println("**************************************************************************************************************************************************");
		System.out.println("**************************************************************************************************************************************************");
		// Step 4: Redirect the user to the inSign website in a browser.
		//Runtime.getRuntime().exec("cmd.exe /c start " + adapter.createStartURL(inSignSessionHandle));
	}
}
