package de.is2.insign.javapi;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintStream;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.util.Map;
import java.util.UUID;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import jodd.net.URLCoder;

@SuppressWarnings("restriction")
public class InSignStartHandler extends MyHttpHandler implements HttpHandler {

	public InSignStartHandler(Map<String, InSignSessionHandle> inSignSessionHandles, InSignAdapter<?> adapter) {
		super(inSignSessionHandles, adapter);
	}

	@Override
	public void handle(final HttpExchange exchange) throws IOException {
		try {
			writeRequest(exchange);
		} catch (final Exception exp) {
			final PrintStream writer = new PrintStream(exchange.getResponseBody());
			exp.printStackTrace(writer);
			writeResponse(exchange, exp.toString());
		}
	}

	public void writeRequest(final HttpExchange exchange) throws URISyntaxException, IOException, InSignAdapterException, UnsupportedEncodingException {
		final String sessionID = createSession();
		final InSignSessionHandle sessionHandle = InSignAdapterDemo.inSignSessionHandles.get(sessionID);
		String response = "<html>";
		response += "<meta charset=\"UTF-8\"/>";
		response += "der inSign Vorgang wurde konfiguriert. Die Dokumente wurden an inSign Übertragen.<br/>";
		response += "<a href='" + InSignAdapterDemo.adapter.createStartURL(sessionHandle) + "'>inSign starten</a><br/>";
		response += "<a href='" + InSignAdapterDemo.adapter.createVorgansverwaltungURL(sessionHandle, "http://google.de") + "'>inSign Vorgangsverwaltung starten</a><br/>";
		response += "<a href='/extern?sessionid=" + sessionID + "'>Session extern setzen</a><br/>";
		response += "<a href='/externAbort?sessionid=" + sessionID + "'>Session zurückholen</a><br/>";
		writeResponse(exchange, response);
	}

	public String createSession() throws URISyntaxException, IOException, InSignAdapterException, UnsupportedEncodingException {
		final String myid = UUID.randomUUID().toString();
		final String callBackURL = createCallbackURL(myid);
		final InSignConfigurationData cfg = createDefaultSessionConfig(callBackURL);
		addDocument(cfg);
		cfg.getConfigureSession().setServerSidecallbackURL(createServerSideCallbackURL(myid));
		final InSignSessionHandle inSignSessionHandle = InSignAdapterDemo.adapter.createinSignSession(cfg);
		InSignAdapterDemo.inSignSessionHandles.put(myid, inSignSessionHandle);
		return myid;
	}

	protected String createCallbackURL(final String myid) throws URISyntaxException {
		final String url = URLCoder.build("http://localhost/insigncallback").queryParam("id", myid).get();
		final URI uri = new URI(url);
		final URI newuri = new URI(uri.getScheme(), uri.getUserInfo(), uri.getHost(), InSignAdapterDemo.port, uri.getPath(), uri.getQuery(), uri.getFragment());
		final String callBackURL = newuri.toString();
		return callBackURL;
	}

	protected String createServerSideCallbackURL(final String myid) throws URISyntaxException {
		final String url = URLCoder.build("http://localhost/servercallback").queryParam("id", myid).get();
		final URI uri = new URI(url);
		final URI newuri = new URI(uri.getScheme(), uri.getUserInfo(), uri.getHost(), InSignAdapterDemo.port, uri.getPath(), uri.getQuery(), uri.getFragment());
		final String callBackURL = newuri.toString();
		return callBackURL;
	}

	protected InSignConfigurationData createDefaultSessionConfig(final String callBackURL) {
		return InSignConfigurationBuilder.createSessionConfiguration("Ein Antrag", ApiData.userID, ApiData.userEMail, "Homer Simpson", null, true, false, callBackURL, null);
	}

	protected void addDocument(final InSignConfigurationData cfg) throws IOException {
		final URL res = this.getClass().getClassLoader().getResource("test.pdf");
		final InputStream openStream = res.openStream();
		InSignConfigurationBuilder.addDokument(cfg, "antrag1", "Ein Antragsdokument.pdf", "myfilename.pdf", openStream.available(), false, true, openStream);
	}

}