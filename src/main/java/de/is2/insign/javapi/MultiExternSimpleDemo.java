package de.is2.insign.javapi;

import java.io.FileInputStream;
import java.util.ArrayList;

import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONExternMultiuserResult;
import de.is2.sign.service.rest.json.JSONExternUserResult;

public class MultiExternSimpleDemo extends DemoBase {

	private static final String insignURL = ApiData.insignURL;
	private static final String callbackURL = ApiData.callbackURL;
	private static final String controllerName = ApiData.controllerName;
	private static final String controllerPassword = ApiData.controllerPassword;
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
		final String vp = "VersichertePerson";
		final String pn = "Partner";
		final String kinh = "Kontoinhaber";
		final String[] roles = { vn, vp, pn, kinh };
		final String[] roles1 = { vn };
		final String[] roles2 = { vn, vp };
		final String[] roles3 = { vp, kinh };
		final String[] roles4 = { pn };
		final String[] roles5 = { vp };
		final String[] roles6 = { kinh };

		final ArrayList<InSignRoleforSignatureID> rolesforSignature = new ArrayList<InSignRoleforSignatureID>();
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature1"));
		rolesforSignature.add(new InSignRoleforSignatureID(vp, "Signature2"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature3"));
		rolesforSignature.add(new InSignRoleforSignatureID(vp, "Signature4"));
		rolesforSignature.add(new InSignRoleforSignatureID(vp, "Signature5"));
		rolesforSignature.add(new InSignRoleforSignatureID(pn, "Signature6"));
		rolesforSignature.add(new InSignRoleforSignatureID(pn, "Signature7"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature8"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature9"));
		rolesforSignature.add(new InSignRoleforSignatureID(pn, "Signature10"));
		rolesforSignature.add(new InSignRoleforSignatureID(kinh, "Signature11"));
		rolesforSignature.add(new InSignRoleforSignatureID(kinh, "Signature12"));
		rolesforSignature.add(new InSignRoleforSignatureID(kinh, "Signature13"));
		rolesforSignature.add(new InSignRoleforSignatureID(kinh, "Signature14"));
		rolesforSignature.add(new InSignRoleforSignatureID(kinh, "Signature15"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature16"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature17"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature18"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature19"));
		rolesforSignature.add(new InSignRoleforSignatureID(pn, "Signature20"));
		rolesforSignature.add(new InSignRoleforSignatureID(pn, "Signature21"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature22"));
		rolesforSignature.add(new InSignRoleforSignatureID(vp, "Signature23"));
		rolesforSignature.add(new InSignRoleforSignatureID(vp, "Signature24"));
		rolesforSignature.add(new InSignRoleforSignatureID(vp, "Signature25"));
		rolesforSignature.add(new InSignRoleforSignatureID(vp, "Signature26"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature27"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature28"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature29"));
		rolesforSignature.add(new InSignRoleforSignatureID(vn, "Signature30"));

		// Add a document to the configuration
        InSignConfigurationBuilder.addDokument(configData, "30_sig_fileds", MultiExternSimpleDemo.class.getClassLoader().getResourceAsStream("30_sig_fileds.pdf"), rolesforSignature);

		// Step 3: Now send the configuration to inSign. Returns a session
		// handle which can be used to access this process again later on
		// e.g. after the callback from inSign is done
		final InSignSessionHandle inSignSessionHandle = adapter.createinSignSession(configData);

		final ArrayList<InsignExternUser> users = new ArrayList<InsignExternUser>();
		users.add(new InsignExternUser(userEMail, "+7007", roles5, true, true, false, "", "", "", "", "", "owner", "http://mycallbackurlforuser1?param=1", "", ""));
		users.add(new InsignExternUser(userEMail, "+7007", roles1, true, true, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser2?param=2", "", ""));
		users.add(new InsignExternUser(userEMail, "+7007", roles2, true, true, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser3?param=3", "", ""));
		users.add(new InsignExternUser(userEMail, "+7007", roles3, true, true, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser4?param=4", "", ""));
		users.add(new InsignExternUser(userEMail, "+7007", roles4, true, true, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser5?param=5", "", ""));
		users.add(new InsignExternUser(userEMail, "017656925293", roles6, true, false, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser6?param=6", "", ""));
		users.add(new InsignExternUser(userEMail, "017656925293", roles, true, false, false, "", "", "", "", "", "signer", "http://mycallbackurlforuser7?param=7", "", ""));

		final JSONExternUserResult singleUserResult1 = adapter.setExternal(inSignSessionHandle, userEMail, "", "", "", "");
		final JSONExternUserResult singleUserResult2 = adapter.setExternal(inSignSessionHandle, userEMail, "", "", "", "");
		final JSONExternUserResult singleUserResult3 = adapter.setExternal(inSignSessionHandle, userEMail, "", "", "", "");
		final JSONExternMultiuserResult multiuserResult = adapter.setExternal(inSignSessionHandle, users);

		InSignApiLogger.jlog.debug(singleUserResult1.getExternAccessLink());
		InSignApiLogger.jlog.debug("singleUserResult: " + singleUserResult1.getExternUser() + " PW: " + singleUserResult1.getPassword());

		InSignApiLogger.jlog.debug(singleUserResult2.getExternAccessLink());
		InSignApiLogger.jlog.debug("singleUserResult: " + singleUserResult2.getExternUser() + " PW: " + singleUserResult2.getPassword());

		InSignApiLogger.jlog.debug(singleUserResult3.getExternAccessLink());
		InSignApiLogger.jlog.debug("singleUserResult: " + singleUserResult3.getExternUser() + " PW: " + singleUserResult3.getPassword());

		for (final JSONExternUserResult userResult : multiuserResult.getExternUsers()) {
			InSignApiLogger.jlog.debug(userResult.getExternAccessLink());
			InSignApiLogger.jlog.debug("USER: " + userResult.getExternUser() + " PW: " + userResult.getPassword());
			// Step 4: Redirect user to inSign. Simulated here by browser call.
			// Runtime.getRuntime().exec("cmd.exe /c start "+
			// userResult.getExternAccessLink() );

			// if (Desktop.isDesktopSupported()) {
			// // Windows
			//     Desktop.getDesktop().browse(new URI(userResult.getExternAccessLink()));
			// }
		}

		// Step 5: Retrieve status and document and delete operation. This is done
		// traditionally after the callback from inSign (i.e. when inSign is finished).
		// Is simulated here by simple polling.

		// Simple HTTP server that catches the callbacks from inSign Works only with Sun JDK.
		// final HttpServer server = HttpServer.create(new InetSocketAddress(8493), 0);
		// server.createContext("/clientcallback",new HttpHandler(){
		//     @Override
		//	   public void handle(HttpExchange ex) throws IOException {
		//	       // Output status
		//		   try {
		//		       Log.jlog.debug(adapter.getStatus(inSignSessionHandle));
		//			   // Get and display document + Delete process
		//			   fetchAndShowDocument(adapter,inSignSessionHandle);
		//			   ex.sendResponseHeaders(200, 2);
		//			   ex.getResponseBody().write("OK".getBytes());
		//		   } catch (InSignAdapterException e) {
		//			   e.printStackTrace();
		//		   }
		//	   }});
		// server.start();

		// Alternative: simply use polling …
		// boolean done = false;
		// while (done == false) {
		//     Thread.sleep(1000);
		//     JSONSessionStatusResult status = adapter.getStatus(inSignSessionHandle);
		//     Log.jlog.debug(status);
		//     done = status.isSucessfullyCompleted();
		// };
		// fetchAndShowDocument(adapter, inSignSessionHandle);
	}
}
