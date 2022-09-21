package de.is2.insign.javapi;

import java.util.ArrayList;

import de.is2.sign.service.rest.json.JSONAnnotation;
import de.is2.sign.service.rest.json.JSONConfigureDocument;
import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONDocumentData;
import de.is2.sign.service.rest.json.JSONExternMultiuserResult;
import de.is2.sign.service.rest.json.JSONExternUserResult;
import de.is2.sign.service.rest.json.JSONSessionData;

public class MultiExternNotSoSimpleDemo extends DemoBase {

	private static final String insignURL = ApiData.insignURL;
	private static final String callbackURL = ApiData.callbackURL;
	private static final String controllerName = ApiData.controllerName;
	private static final String controllerPassword = ApiData.controllerPassword;
	private static final String userID = ApiData.userID;

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
		final String vg = "Versicherungsgeber";
		final String[] roles1 = { vn };
		final String[] roles2 = { vg };

		final ArrayList<InSignRoleforSignatureID> rolesforSignature = new ArrayList<InSignRoleforSignatureID>();
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature1"));
		rolesforSignature.add(new InSignRoleforSignatureID(vg, "Signature2"));
		
		cfg.setUserFullName("maxmusterrr");
		cfg.setDisplayname("testBundle");
		cfg.setUploadEnabled(true);
		// Add a document to the configuration
		JSONConfigureDocument doc5 = InSignConfigurationBuilder.addDokument(configData, "test", MultiExternNotSoSimpleDemo.class.getClassLoader().getResourceAsStream("test.pdf"), rolesforSignature);

		// Step 3: Now send the configuration to inSign. Returns a session
		// handle which can be used to access this process again later on
		// e.g. after the callback from inSign is done
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		// Step 4: Get documents and set external role
		String recipient = "test1@yopmail.com";
		String recipient1 = "test2@yopmail.de";
		JSONSessionData sessionData = adapter.getDocumentsFull(inSignSessionHandle);
		for (JSONDocumentData doc : sessionData.getDocuments()) {
			for (JSONAnnotation anno : doc.getAnnotations()) {
				if (anno.getType().equals("signature_marker")) {
					// Signature fields cannot be changed by using this method
					// Information can still be read
					if (anno.getRole().equals(vn)) {
						anno.setExternRole(recipient);
					} else if (anno.getRole().equals(vg)) {
						anno.setExternRole(recipient1);
					}
				}
			}
		}

		// Store changes in inSign
		adapter.storeFormData(inSignSessionHandle, sessionData);
		final ArrayList<InsignExternUser> users = new ArrayList<InsignExternUser>();
		users.add(new InsignExternUser(recipient, "", roles1, false, true, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser7?param=7", "", ""));
		users.add(new InsignExternUser(recipient1, "", roles2, false, false, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser7?param=7", "", ""));

		final JSONExternMultiuserResult multiuserResult = adapter.setExternal(inSignSessionHandle, users);
		for (final JSONExternUserResult userResult : multiuserResult.getExternUsers()) {
			InSignApiLogger.jlog.debug(userResult.getExternAccessLink());
			InSignApiLogger.jlog.debug("USER: " + userResult.getExternUser() + " PW: " + userResult.getPassword());
			System.out.println(userResult.getExternAccessLink());
			System.out.println("USER: " + userResult.getExternUser() + " PW: " + userResult.getPassword());
		}
	}
}
