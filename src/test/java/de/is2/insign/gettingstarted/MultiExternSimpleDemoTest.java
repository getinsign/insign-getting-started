package de.is2.insign.gettingstarted;

import java.util.ArrayList;

import org.junit.Test;

import de.is2.insign.javapi.InSignAdapter;
import de.is2.insign.javapi.InSignConfigurationBuilder;
import de.is2.insign.javapi.InSignConfigurationData;
import de.is2.insign.javapi.InSignSessionHandle;
import de.is2.insign.javapi.InSignTransPortAdapterFactoryJod;
import de.is2.insign.javapi.InsignExternUser;
import de.is2.sign.service.rest.json.JSONConfigureSession;

public class MultiExternSimpleDemoTest{

	private static String insignURL = "https://sandbox.test.getinsign.show/";
	private static String controllerName = "controller";
	private static String controllerPassword = "pwd.insign.sandbox.4561";

	public static void main(final String[] args) {
		final MultiExternSimpleDemoTest multiExternSimpleDemo = new MultiExternSimpleDemoTest();
		try {
			multiExternSimpleDemo.run();
		} catch (Exception ex) {
			ex.printStackTrace();
		}
	}

	@Test
	@SuppressWarnings({ "rawtypes", "unchecked" })
	public void run() throws Exception {

		// Step 1: Create an adapter
		final InSignAdapter adapter = new InSignAdapter(
				new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword));

		// Step 2: Create the configuration for a session:
		final InSignConfigurationData configData = InSignConfigurationBuilder.createSessionConfiguration();
		final JSONConfigureSession cfg = configData.getConfigureSession();

		cfg.setCallbackURL("http://www.getinsign.de/callback");
		// Status messages are sent to the serversidecallbackURL if it is set.
		// This should be the ID of the logged-in user, so that
		// the pairing to the smartphone can be stored permanently for each user.

		// For tests, use either always the same ID or a random ID
		cfg.setForuser("john.doe");

		// Process name
		cfg.setDisplayname("Example displayname");

		// Add a document to the configuration
		InSignConfigurationBuilder.addDokument(configData, "test_roles_sigtags.pdf",
				MultiExternSimpleDemoTest.class.getClassLoader().getResourceAsStream("test_roles_sigtags.pdf"));

		// Step 3: Now send the configuration to inSign. Returns a session
		// handle which can be used to access this process again later on
		// e.g. after the callback from inSign is done
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		final ArrayList<InsignExternUser> users = new ArrayList<InsignExternUser>();

		final InsignExternUser user1 = new InsignExternUser();
		user1.setRoles(new String[] { "role_one" });
		user1.setRecipient("user1@is2.de");
		user1.setSendEmails(false);
		user1.setSendSMS(false);
		user1.setSingleSignOnEnabled(true);

		final InsignExternUser user2 = new InsignExternUser();
		user2.setRoles(new String[] { "role_two" });
		user2.setRecipient("user2@is2.de");
		user2.setSendEmails(false);
		user2.setSendSMS(false);
		user2.setSingleSignOnEnabled(true);

		users.add(user1);
		users.add(user2);

		System.out.println(
				"**************************************************************************************************************************************************");
		System.out.println(
				"**************************************************************************************************************************************************");
		System.out.println("Click this link to jump into inSign: " + adapter.createStartURL(inSignSessionHandle));
		System.out.println(
				"**************************************************************************************************************************************************");
		System.out.println(
				"**************************************************************************************************************************************************");
	}
}
