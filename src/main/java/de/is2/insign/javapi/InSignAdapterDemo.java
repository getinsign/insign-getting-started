package de.is2.insign.javapi;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.junit.Assert;
import org.junit.Test;

import com.sun.net.httpserver.HttpServer;

import de.is2.sign.service.rest.json.JSONCheckStatusResult;
import de.is2.sign.service.rest.json.JSONSessionStatusResult;
import de.is2.sign.service.rest.json.JSONSessionsResult;
import de.is2.sign.service.rest.json.JSONTransaktionsnummerResult;
import de.is2.sign.service.rest.json.JSONUserID;
import jodd.http.HttpBrowser;
import jodd.http.HttpRequest;
import jodd.http.HttpResponse;

@SuppressWarnings("restriction")
public class InSignAdapterDemo {

	private static String insignURL = ApiData.insignURL;
	private static String sessionUserID = ApiData.userID;
	private static String controllerName = ApiData.controllerName;
	private static String controllerPassword = ApiData.controllerPassword;
	private static String recipientSender = ApiData.userEMail;

	static final int port = 8085;
	static Map<String, InSignSessionHandle> inSignSessionHandles = new HashMap<String, InSignSessionHandle>();
	// Currently there is only transport via Jodd
	static InSignAdapter<?> adapter;

	@Test
	public void testManual() throws Exception {
		adapter = createAdapter(insignURL);
		bootstrapServer(new InSignStartHandler(inSignSessionHandles, adapter), new InSignCallbackHandler(inSignSessionHandles, adapter),
				new InSignServerSideCallbackHandler(inSignSessionHandles, adapter));
		Thread.sleep(Long.MAX_VALUE);
	}

	// @Test
	public void testAuto() throws Exception {
		final InSignCallbackHandler inSignCallbackHandler = new InSignCallbackHandler(inSignSessionHandles, adapter);
		final InSignServerSideCallbackHandler inSignServersideCallbackHandler = new InSignServerSideCallbackHandler(inSignSessionHandles, adapter);
		final InSignStartHandler inSignStartHandler = new InSignStartHandler(inSignSessionHandles, adapter);
		final InSignSessionMethodsHandler inSignSessionMethodsHandler = new InSignSessionMethodsHandler(inSignSessionHandles, adapter);
		final HttpServer server = bootstrapServer(inSignStartHandler, inSignCallbackHandler, inSignServersideCallbackHandler);
		final ExecutorService executor = Executors.newCachedThreadPool();
		int counter = 10;
		final CountDownLatch latch = new CountDownLatch(counter);
		try {
			adapter = createAdapter("http://test-cls11.is2.de/insign/");
			while (counter-- > 0) {
				final AutoTestCall autoTestCall = new AutoTestCall(latch, inSignStartHandler, inSignCallbackHandler, inSignSessionMethodsHandler);
				executor.submit(autoTestCall);
			}
		} finally {
			latch.await();
			Assert.assertEquals(0, latch.getCount());
			executor.shutdown();
			server.stop(0);
		}
	}

	// Mini HTTP server to catch the callback from inSign
	protected HttpServer bootstrapServer(final InSignStartHandler inSignStartHandler, final InSignCallbackHandler inSignCallbackHandler,
			InSignServerSideCallbackHandler inSignServersideCallbackHandler) throws IOException {
		final HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
		server.createContext("/start", inSignStartHandler);
		server.createContext("/insigncallback", inSignCallbackHandler);
		server.createContext("/servercallback", inSignServersideCallbackHandler);
		server.createContext("/extern", new InSignExternHandler(inSignSessionHandles, adapter));
		server.createContext("/externAbort", new InSignExternAbortHandler(inSignSessionHandles, adapter));
		server.setExecutor(null); // Creates a default executor
		server.start();
		return server;
	}

	public class AutoTestCall implements Callable<Void> {

		private final InSignStartHandler inSignStartHandler;
		private final InSignCallbackHandler inSignCallbackHandler;
		private final InSignSessionMethodsHandler inSignSessionMethodsHandler;
		private final CountDownLatch latch;

		public AutoTestCall(final CountDownLatch latch, final InSignStartHandler inSignStartHandler, final InSignCallbackHandler inSignCallbackHandler,
				final InSignSessionMethodsHandler inSignSessionMethodsHandler) {
			this.latch = latch;
			this.inSignCallbackHandler = inSignCallbackHandler;
			this.inSignStartHandler = inSignStartHandler;
			this.inSignSessionMethodsHandler = inSignSessionMethodsHandler;
		}

		@Override
		public Void call() {
			try {
				// Create Session
				final HttpBrowser browser = new HttpBrowser();
				final HttpRequest request = new HttpRequest().basicAuthentication(controllerName, controllerPassword);
				final String sessionID = inSignStartHandler.createSession();
				final URI startURL = adapter.createStartURL(inSignSessionHandles.get(sessionID));
				final HttpResponse response = browser.sendRequest(request.set(startURL.toString()));
				Assert.assertEquals(200, response.statusCode());

				// Check Session Methods
				JSONSessionsResult sessions = inSignSessionMethodsHandler.getAllUserSessions(sessionID);
				Assert.assertFalse(sessions.getSessions().isEmpty());

				JSONCheckStatusResult statusResult = inSignSessionMethodsHandler.getCheckStatus(sessionID);
				Assert.assertEquals(sessionID, statusResult.getSessionid());

				JSONUserID userID = inSignSessionMethodsHandler.getSessionOwner(sessionID);
				Assert.assertEquals(sessionUserID, userID.getUserID());

				JSONTransaktionsnummerResult tan = inSignSessionMethodsHandler.getVorgangsnummer(sessionID);
				Assert.assertNotNull(tan.getTransaktionsnummer());

				// Get Session information and delete
				final JSONSessionStatusResult status = inSignCallbackHandler.checkSession(sessionID);
				Assert.assertEquals("OK", status.getMessage());
			} catch (final Exception dontCare) {
				Assert.fail(dontCare.getMessage());
			} finally {
				latch.countDown();
			}

			return null;
		}
	}

	protected static InSignAdapter<HttpRequest> createAdapter(final String url) {
		final IInSignTransportAdapterFactory<IInSignTransportAdapter<HttpRequest>> factory = new IInSignTransportAdapterFactory<IInSignTransportAdapter<HttpRequest>>() {

			@Override
			public InSignTransportAdapterJodd create() {
				try {
					return new InSignTransportAdapterJodd(new URI(url), controllerName, controllerPassword, null);
				} catch (final URISyntaxException e) {
					e.printStackTrace();
				}
				return null;
			}
		};

		return new InSignAdapter<HttpRequest>(factory);
	}
}
