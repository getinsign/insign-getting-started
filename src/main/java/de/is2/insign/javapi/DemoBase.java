package de.is2.insign.javapi;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

import org.apache.commons.io.IOUtils;

public class DemoBase {

	@SuppressWarnings({ "rawtypes" })
	protected static void fetchAndShowDocument(final InSignAdapter adapter, final InSignSessionHandle inSignSessionHandle) {
		// Retrieve signed documents
		InputStream signedDoc;
		try {
			signedDoc = adapter.getDocument(inSignSessionHandle, "docid1", true);
			final File file = new File("signed.pdf");
			final FileOutputStream fileOutputStream = new FileOutputStream(file);
			IOUtils.copyLarge(signedDoc, fileOutputStream);
			fileOutputStream.close();
			
			// delete inSign Session
			adapter.deleteinSignSession(inSignSessionHandle);
			
			// Open file in Acrobat
			Runtime.getRuntime().exec("cmd.exe /c \"" + file.getAbsolutePath() + "\"");
		} catch (final Exception e) {
			e.printStackTrace();
		}
	}
}
