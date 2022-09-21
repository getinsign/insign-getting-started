package de.is2.insign.javapi;

import java.util.ArrayList;
import java.util.Collection;

import de.is2.sign.service.rest.json.JSONConfigureDocument;
import de.is2.sign.service.rest.json.JSONConfigureSession;
import de.is2.sign.service.rest.json.JSONConfigureSignature;
import de.is2.sign.service.rest.json.JSONPagePosition;

public class AddSignatureDemo {

	private String insignURL = ApiData.insignURL;
	private String controllerName = ApiData.controllerName;
	private String controllerPassword = ApiData.controllerPassword;
	private String benutzerid = ApiData.userID;

	public static void main(final String[] args) throws Exception {
		new AddSignatureDemo().run(args);
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
		cfg.setForuser(benutzerid);
		cfg.setDisplayname("Antrag Test");
		JSONConfigureDocument doc = InSignConfigurationBuilder.addDokument(configData, "docid1", this.getClass().getClassLoader().getResourceAsStream("vvg.pdf"));
		Collection<JSONConfigureSignature> signatures = new ArrayList<JSONConfigureSignature>();

		JSONConfigureSignature sign1 = new JSONConfigureSignature();
		sign1.setId("Signature_1");
		JSONPagePosition pos1 = new JSONPagePosition();
		pos1.setPage(0); // Page count starts at 0
		// Positions and size are given relative to the page
		pos1.setW(0.2); // Signaturefield will be 20% of the pagewidth
		pos1.setH(0.025);
		pos1.setY0(0.45);
		pos1.setX0(0.45);
		sign1.setPosition(pos1);
		signatures.add(sign1);

		JSONConfigureSignature sign2 = new JSONConfigureSignature();
		sign2.setId("Signature_2");
		JSONPagePosition pos2 = new JSONPagePosition();
		pos2.setPage(1);
		pos2.setW(0.15);
		pos2.setH(0.025);
		pos2.setY0(0.075);
		pos2.setX0(0.1);
		sign2.setPosition(pos2);
		signatures.add(sign2);

		doc.setSignatures(signatures);

		final InSignSessionHandle handle = adapter.createinSignSession(configData);

		// Print out url to access the session to test
		InSignApiLogger.jlog.debug(adapter.createStartURL(handle).toString());
	}
}