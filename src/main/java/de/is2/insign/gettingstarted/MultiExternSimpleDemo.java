package de.is2.insign.gettingstarted;

import java.util.ArrayList;

import de.is2.insign.javapi.DemoBase;
import de.is2.insign.javapi.InSignAdapter;
import de.is2.insign.javapi.InSignConfigurationBuilder;
import de.is2.insign.javapi.InSignConfigurationData;
import de.is2.insign.javapi.InSignSessionHandle;
import de.is2.insign.javapi.InSignTransPortAdapterFactoryJod;
import de.is2.insign.javapi.InsignExternUser;
import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONExternMultiuserResult;
import de.is2.sign.service.rest.json.JSONExternUserResult;

public class MultiExternSimpleDemo extends DemoBase {

	private static String insignURL = "https://sandbox.insign.is2.show/";
	private static String controllerName = "controller";
	private static String controllerPassword = "pwd.insign.sandbox.4561";

	public static void main(final String[] args) throws Exception {
		final MultiExternSimpleDemo multiExternSimpleDemo = new MultiExternSimpleDemo();
		try {
			multiExternSimpleDemo.run();
		} catch (Exception ex) {
			ex.printStackTrace();
		}
	}

	@SuppressWarnings({ "rawtypes", "unchecked" })
	public void run() throws Exception {

		// Step 1: Create an adapter
		final InSignAdapter adapter = new InSignAdapter(
				new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword));

		// Step 2: Create the configuration for a session:
		final InSignConfigurationData configData = InSignConfigurationBuilder.createSessionConfiguration();
		final JSONConfigureSession cfg = configData.getConfigureSession();

		cfg.setCallbackURL("http://www.is2.de/callback");
		// Status messages are sent to the serversidecallbackURL if it is set.
		// This should be the ID of the logged-in user, so that
		// the pairing to the smartphone can be stored permanently for each user.

		// For tests, use either always the same ID or a random ID
		cfg.setForuser("john.doe");

		// Process name
		cfg.setDisplayname("Example displayname");

		// Add a document to the configuration
		InSignConfigurationBuilder.addDokument(configData, "test_roles_sigtags.pdf",
				MultiExternSimpleDemo.class.getClassLoader().getResourceAsStream("test_roles_sigtags.pdf"));

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

		final JSONExternMultiuserResult multiuserResult = adapter.setExternal(inSignSessionHandle, users);

		for (final JSONExternUserResult userResult : multiuserResult.getExternUsers()) {

			// Step 4: Copy the link from terminal and open it in browser
			System.out.println("USER: " + userResult.getExternUser() + " PW: " + userResult.getPassword() + " LINK: "
					+ userResult.getExternAccessLink());
		}
	}
}
