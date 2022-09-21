package de.is2.insign.javapi;

import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import com.sun.net.httpserver.HttpExchange;

import jodd.http.HttpMultiMap;
import jodd.http.HttpUtil;

@SuppressWarnings("restriction")
public class MyHttpHandler {

	final Map<String, InSignSessionHandle> inSignSessionHandles;
	final InSignAdapter<?> adapter;

	public MyHttpHandler(Map<String, InSignSessionHandle> inSignSessionHandles, InSignAdapter<?> adapter) {
		this.inSignSessionHandles = inSignSessionHandles;
		this.adapter = adapter;
	}

	public static void writeResponse(final HttpExchange exchange, final String response) throws UnsupportedEncodingException, IOException {
		final byte[] responseBytes = response.getBytes("UTF-8");
		exchange.sendResponseHeaders(200, responseBytes.length);
		final OutputStream os = new BufferedOutputStream(exchange.getResponseBody());
		os.write(responseBytes);
		os.flush();
		os.close();
	}

	public static Map<String, Object> getParamsFromURI(final URI uri) {
		final HttpMultiMap<String> query = HttpUtil.parseQuery(uri.getQuery(), false);
		final Map<String, Object> params = new HashMap<String, Object>();
		for (final Entry<String, String> entry : query) {
			if (entry.getKey() != null && !entry.getKey().isEmpty()) {
				params.put(entry.getKey(), entry.getValue());
			}
		}
		return params;
	}

}
