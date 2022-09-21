package de.is2.insign.javapi;

import java.io.IOException;
import java.io.PrintStream;
import java.util.Map;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import de.is2.sign.service.rest.json.JSONExternUserResult;

@SuppressWarnings("restriction")
public class InSignExternHandler extends MyHttpHandler implements HttpHandler {

	public InSignExternHandler(Map<String, InSignSessionHandle> inSignSessionHandles, InSignAdapter<?> adapter) {
		super(inSignSessionHandles, adapter);
	}

	@Override
	public void handle(final HttpExchange exchange) throws IOException {
		try {
			final Map<String, Object> params = getParamsFromURI(exchange.getRequestURI());
			final String sessionid = (String) params.get("sessionid");
			final InSignSessionHandle sessionHandle = InSignAdapterDemo.inSignSessionHandles.get(sessionid);
			final JSONExternUserResult result = InSignAdapterDemo.adapter.setExternal(sessionHandle, ApiData.userEMail, "", ApiData.userEMail, "AdapterTest",
					"AdapterTest");
			String response = "<html>";
			response += "<meta charset=\"UTF-8\"/>";
			response += "inSign ExternalResult: " + InSignAdapterDemo.adapter.logObject(result);
			writeResponse(exchange, response);
		} catch (final InSignAdapterException exp) {
			final PrintStream writer = new PrintStream(exchange.getResponseBody());
			exp.printStackTrace(writer);
			writeResponse(exchange, exp.toString());
		}
	}
}