package de.is2.insign.javapi;

import de.is2.sign.service.rest.json.JSONAnnotation;
import de.is2.sign.service.rest.json.JSONConfigureDocument;
import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONDocumentData;
import de.is2.sign.service.rest.json.JSONSessionData;

public class ChangeFieldsDemo {

	private String insignURL = ApiData.insignURL;
	private String controllerName = ApiData.controllerName;
	private String controllerPassword = ApiData.controllerPassword;
	private String userID = ApiData.userID;

	public static void main(final String[] args) throws Exception {
		new ChangeFieldsDemo().run(args);
	}

	@SuppressWarnings({ "unchecked", "rawtypes" })
	public void run(final String[] args) throws Exception {
		if (args.length > 0) insignURL = args[0];
		if (args.length > 1) controllerPassword = args[1];

		IInSignTransportAdapterFactory factory;
		factory = new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword);
		final InSignAdapter adapter = new InSignAdapter(factory);

		// Creating demo session
		final InSignConfigurationData configData = InSignConfigurationBuilder.createSessionConfiguration();
		final JSONConfigureSession cfg = configData.getConfigureSession();
		cfg.setForuser(userID);
		cfg.setDisplayname("Antrag");
		JSONConfigureDocument doccfg = InSignConfigurationBuilder.addDokument(configData, "docid1", this.getClass().getClassLoader().getResourceAsStream("konto.pdf"));
		// Allow form editting, so that the fields are visible to the user
		doccfg.setAllowFormEditing(true);
		final InSignSessionHandle handle = adapter.createinSignSession(configData);

		// To load an existing session use:
		// InSignSessionHandle handle = new InSignSessionHandle(sessionID, userID);
		// adapter.loadSession(handle, null);

		JSONSessionData sessionData = adapter.getDocumentsFull(handle);

		for (JSONDocumentData doc : sessionData.getDocuments()) {
			for (JSONAnnotation anno : doc.getAnnotations()) {
				if (anno.getType().equals("signature_marker")) {
					// Signature fields can't be changed by using this method
					// Information can still be read
				}
				if (anno.getType().equals("annotation_marker_text")) {
					// Set all textfields with "test"
					anno.setText("test");
				}
				if (anno.getType().equals("annotation_marker_checkbox")) {
					// Set all checkboxes to checked
					anno.setText("true");
				}
				if (anno.getType().equals("annotation_marker_radio")) {
					// Activate the first of every radio button group
					if (anno.getId().contains("#0")) {
						anno.setText("true");
					}
				}
			}
		}

		// Store changes in inSign
		adapter.storeFormData(handle, sessionData);

		// Print out url to access the session to test
		InSignApiLogger.jlog.debug(adapter.createStartURL(handle).toString());
	}
}