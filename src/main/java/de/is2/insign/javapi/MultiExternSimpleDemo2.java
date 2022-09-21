package de.is2.insign.javapi;

import java.util.ArrayList;

import de.is2.sign.service.rest.json.JSONConfigureDocument;
import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONExternMultiuserResult;
import de.is2.sign.service.rest.json.JSONExternUserResult;

public class MultiExternSimpleDemo2 extends DemoBase {

	private static final String insignURL = ApiData.insignURL;
	private static final String callbackURL = ApiData.callbackURL;
	private static final String controllerName = ApiData.controllerName;
	private static final String controllerPassword = ApiData.controllerName;
	private static final String userID = ApiData.userID;
	private static final String userEMail = ApiData.userEMail;

	@SuppressWarnings({ "rawtypes", "unchecked" })
	public static void main(final String[] args) throws Exception {

		// Step 1: Create an adapter
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
		
		// Process name
		cfg.setDisplayname("Antrag Leben");

		final String vn = "Versicherungsnehmer";
		final String[] roles = { vn };

		final ArrayList<InSignRoleforSignatureID> rolesforSignature = new ArrayList<InSignRoleforSignatureID>();
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature1"));

		cfg.setForuser("maxmusterrr");
		cfg.setUserFullName("maxmusterrr");
		cfg.setDisplayname("testBundle");
		cfg.setUserEmail("is2megadethtest@yopmail.com");
		cfg.setUploadEnabled(true);
		JSONConfigureDocument doc1 = InSignConfigurationBuilder.addDokument(configData, "one", MultiExternSimpleDemo2.class.getClassLoader().getResourceAsStream("test.pdf"));
		JSONConfigureDocument doc2 = InSignConfigurationBuilder.addDokument(configData, "two", MultiExternSimpleDemo2.class.getClassLoader().getResourceAsStream("test.pdf"));
		JSONConfigureDocument doc3 = InSignConfigurationBuilder.addDokument(configData, "three", MultiExternSimpleDemo2.class.getClassLoader().getResourceAsStream("test.pdf"));
		JSONConfigureDocument doc4 = InSignConfigurationBuilder.addDokument(configData, "four", MultiExternSimpleDemo2.class.getClassLoader().getResourceAsStream("test.pdf"));
		// Add a document to the configuration
		JSONConfigureDocument doc5 = InSignConfigurationBuilder.addDokument(configData, "30_sig_fileds", MultiExternSimpleDemo2.class.getClassLoader().getResourceAsStream("30_sig_fileds.pdf"),
				rolesforSignature);

		// Step 3: Now send the configuration to inSign. Returns a session
		// handle which can be used to access this process again later on
		// e.g. after the callback from inSign is done
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		final ArrayList<InsignExternUser> users = new ArrayList<InsignExternUser>();

		users.add(new InsignExternUser(userEMail, "017656925293", roles, false, true, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser7?param=7", "", ""));
		users.add(new InsignExternUser(userEMail, "017656925293", roles, false, true, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser7?param=7", "", ""));

		final JSONExternMultiuserResult multiuserResult = adapter.setExternal(inSignSessionHandle, users);

		for (final JSONExternUserResult userResult : multiuserResult.getExternUsers()) {
			InSignApiLogger.jlog.debug(userResult.getExternAccessLink());
			InSignApiLogger.jlog.debug("USER: " + userResult.getExternUser() + " PW: " + userResult.getPassword());
			System.out.println(userResult.getExternAccessLink());
			System.out.println("USER: " + userResult.getExternUser() + " PW: " + userResult.getPassword());
		}
	}
}
