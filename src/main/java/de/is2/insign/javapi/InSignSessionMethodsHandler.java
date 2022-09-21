package de.is2.insign.javapi;

import java.io.IOException;
import java.io.PrintStream;
import java.io.UnsupportedEncodingException;
import java.util.Map;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import de.is2.sign.service.rest.json.JSONCheckStatusResult;
import de.is2.sign.service.rest.json.JSONSessionStatusResult;
import de.is2.sign.service.rest.json.JSONSessionsResult;
import de.is2.sign.service.rest.json.JSONTransaktionsnummerResult;
import de.is2.sign.service.rest.json.JSONUserID;

@SuppressWarnings("restriction")
public class InSignSessionMethodsHandler extends MyHttpHandler implements HttpHandler {

	public InSignSessionMethodsHandler(Map<String, InSignSessionHandle> inSignSessionHandles, InSignAdapter<?> adapter) {
		super(inSignSessionHandles, adapter);
	}

	@Override
	public void handle(final HttpExchange exchange) throws IOException {
		try {
			final Map<String, Object> params = getParamsFromURI(exchange.getRequestURI());
			final String callbackID = (String) params.get("id");
			writeRequest(exchange, callbackID);
		} catch (final InSignAdapterException exp) {
			final PrintStream writer = new PrintStream(exchange.getResponseBody());
			exp.printStackTrace(writer);
			writeResponse(exchange, exp.toString());
		}
	}

	public void writeRequest(final HttpExchange exchange, final String callbackID) throws IOException, InSignAdapterException, UnsupportedEncodingException {
		final InSignSessionHandle sessionHandle = InSignAdapterDemo.inSignSessionHandles.get(callbackID);
		final JSONSessionStatusResult status = InSignAdapterDemo.adapter.getStatus(sessionHandle);
		String response = "<html>";
		response += "<meta charset=\"UTF-8\"/>";
		response += "inSign Vorgangsstatus: " + InSignAdapterDemo.adapter.logObject(status);
		writeResponse(exchange, response);
	}

	public JSONSessionsResult getAllUserSessions(final String sessionID) throws InSignAdapterException {
		final InSignSessionHandle inSignSessionHandle = InSignAdapterDemo.inSignSessionHandles.get(sessionID);
		return InSignAdapterDemo.adapter.getAllUserSessions(inSignSessionHandle);
	}

	public JSONSessionsResult getAllUserSessions(final String userID, final String separator) throws InSignAdapterException {
		return InSignAdapterDemo.adapter.getAllUserSessions(userID, separator);
	}

	public JSONCheckStatusResult getCheckStatus(final String sessionID) throws InSignAdapterException {
		final InSignSessionHandle inSignSessionHandle = InSignAdapterDemo.inSignSessionHandles.get(sessionID);
		return InSignAdapterDemo.adapter.getCheckStatus(inSignSessionHandle);
	}

	public JSONUserID getSessionOwner(final String sessionID) throws InSignAdapterException {
		return InSignAdapterDemo.adapter.getSessionOwner(sessionID);
	}

	public JSONTransaktionsnummerResult getVorgangsnummer(final String sessionID) throws InSignAdapterException {
		final InSignSessionHandle inSignSessionHandle = InSignAdapterDemo.inSignSessionHandles.get(sessionID);
		return InSignAdapterDemo.adapter.getVorgangsnummer(inSignSessionHandle);
	}
}