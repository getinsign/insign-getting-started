package de.is2.insign.javapi;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.util.Map;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import de.is2.sign.service.rest.json.JSONSessionStatusResult;
import jodd.io.IOUtil;

@SuppressWarnings("restriction")
public class InSignServerSideCallbackHandler extends MyHttpHandler implements HttpHandler {

	public InSignServerSideCallbackHandler(Map<String, InSignSessionHandle> inSignSessionHandles, InSignAdapter<?> adapter) {
		super(inSignSessionHandles, adapter);
	}

	@Override
	public void handle(final HttpExchange exchange) throws IOException {
		try {
			final Map<String, Object> params = getParamsFromURI(exchange.getRequestURI());
			final String callbackID = (String) params.get("id");
			checkSession(callbackID);
			exchange.sendResponseHeaders(200, 0);
		} catch (Exception e) {
			e.printStackTrace();
			exchange.sendResponseHeaders(500, 0);
		}
		exchange.getResponseBody().close();
	}

	public JSONSessionStatusResult checkSession(final String sessionID) throws InSignAdapterException, FileNotFoundException, IOException, UnsupportedEncodingException {
		final InSignSessionHandle inSignSessionHandle = inSignSessionHandles.get(sessionID);
		if (inSignSessionHandle == null) return null;
		final JSONSessionStatusResult status = adapter.getStatus(inSignSessionHandle);

		// Get a document
		final InputStream doc = adapter.getDocument(inSignSessionHandle, "antrag1", true);
		final FileOutputStream fos = new FileOutputStream(new File("target/download.pdf"));
		IOUtil.copy(doc, fos);
		doc.close();
		fos.close();

		// Get all documents as ZIP file
		final InputStream zip = adapter.getDocumentsZIP(inSignSessionHandle);
		final FileOutputStream zipfos = new FileOutputStream(new File("target/download.zip"));
		IOUtil.copy(zip, zipfos);
		zip.close();
		zipfos.close();

		// Delete process from inSign
		adapter.deleteinSignSession(inSignSessionHandle);
		return status;
	}
}
