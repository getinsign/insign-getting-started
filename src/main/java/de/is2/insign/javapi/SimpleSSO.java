package de.is2.insign.javapi;

import java.io.IOException;
import java.net.URI;
import java.util.HashMap;

import com.fasterxml.jackson.databind.ObjectMapper;

import de.is2.sign.service.rest.json.JSONConfigureSession;

public class SimpleSSO {
	
	private String insignURL = ApiData.insignURL;
	private String controllerName = ApiData.controllerName;
	private String controllerPassword = ApiData.controllerPassword;
	private String configId = "demoportalController";
	private InSignAdapter adapter;

	public static void main(final String[] args) throws Exception {
		new SimpleSSO().run(args);
	}

	@SuppressWarnings({ "unchecked", "rawtypes" })
	public void run(final String[] args) throws Exception {
		// Step 1: Create an adapter
		IInSignTransportAdapterFactory factory = new InSignTransPortAdpaterFactoryApacheHttpClient(insignURL, controllerName, controllerPassword);
		adapter = new InSignAdapter(factory);
		// Step 2: Get user data

		// Step 3: Create and use tokens
		fall1SSO();
		System.out.println("\noder\n");
		fall2JWT();
		System.out.println("\noder\n");
		fall2JWTMitAC();
	}

	private void setAdditionalConfig() throws InSignAdapterException {
		final InSignConfigurationData configData = InSignConfigurationBuilder.createSessionConfiguration();
		final JSONConfigureSession cfg = configData.getConfigureSession();
		
		// Set different configuration to global one
		cfg.setVorgangsVerwaltungEnabled(true);
		cfg.setBurgerExit("demoportalController Abbrechen");
		
		// Make a call
		adapter.createConfigTemplate(configData, configId);
	}

	/**
	 * A method to register users of other applications / systems in the inSign 
	 * start module. Stylings per user can also be specified here.
	 * 
	 * @return
	 * @throws InSignAdapterException
	 * @throws IOException
	 */
	private String fall1SSO() throws InSignAdapterException, IOException {
		/* Mapping: #0a7fca --> #eb690b und #128cda --> #f7aa00 */
		String tenantExample = ":root {--insignBlue: #eb690b; --insignHover: #f7aa00;}" + "a, a:focus, #thumbscroller .thumb-doc-nr.current > label.document-name{color: var(--insignBlue);}"
				+ "a:hover {color: var(--insignHover);}" + ".btn.btn-primary, .btn-primary:active:focus{background-color: var(--insignBlue);" + "border-color: var(--insignBlue);color: #ffffff;}"
				+ ".btn.btn-primary:hover {background: var(--insignHover);border-color: var(--insignHover)}" + ".form-control:focus{border-color: var(--insignBlue);}"
				+ ".head_underline{background-color: var(--insignBlue);}" + ".form-control:focus {border-color: var(--insignBlue);"
				+ "outline: 0;-webkit-box-shadow: inset 0 1px 1px #eb690b0f,0 0 8px var(--insignBlue);" + "box-shadow: inset 0 1px 1px #eb690b0f,0 0 8px var(--insignBlue)}";

		String ssot = adapter.createSSOToken("ricardo", "servus ricardo", "hello", "Herr", "phone", "ricardo", "", "ROLE_INSIGN_GROUP_IS2", tenantExample, null);
		URI handle = adapter.createSSOStartURL(ssot);
		
		// For test purposes log output and open in default browser
		System.out.println("SSO URI: " + handle);
		Runtime.getRuntime().exec("cmd.exe /c start " + handle);
		System.out.println("done ssotoken " + ssot);
		return tenantExample;
	}

	/**
	 * A method to register already existing API users in the inSign start
	 * module and to adopt existing pairings etc. If no AC was set in step 2 (default)
	 * 
	 * @throws InSignAdapterException
	 * @throws IOException
	 */
	private void fall2JWT() throws InSignAdapterException, IOException {
		// Creation of the token
		String jwtTokenForApiUser = adapter.createJWTTokenForApiUser("samueljwt", "samuel jwt", "hellosamuel@jwt.de", "", null);
		
		// Creation of the URL to standalone for the instance with the token
		URI handle = adapter.createJWTStartURL(jwtTokenForApiUser);
		
		// For test purposes log output and open in default browser
		System.out.println("SSO URI: " + handle);
		Runtime.getRuntime().exec("cmd.exe /c start " + handle);
		System.out.println("done jwtTokenForApiUser " + jwtTokenForApiUser);
	}

	/**
	 * A method to register already existing API users in the inSign start
	 * module and to adopt existing pairings and etc., if an AC was set in
	 * step 2, i.e if the standalone config differs / must differ from the global config.
	 * 
	 * @throws InSignAdapterException
	 * @throws IOException
	 */
	private void fall2JWTMitAC() throws InSignAdapterException, IOException {
		// (only once) set / update additional config
		// optional, usually not necessary
		// for more information see Functionality: Additional Configuration (AC)
		// (https://confluence.is2.de/pages/viewpage.action?pageId=92373216)
		// setAdditionalConfig();

		HashMap<String, String> hashMap = new HashMap<>();
		hashMap.put("configId", configId);
		// hashMap.put("groupId", "VNTR");
		String metaInfo = new ObjectMapper().writeValueAsString(hashMap);
		// Creation of the token
		String jwtTokenForApiUser = adapter.createJWTTokenForApiUser("samueljwt", "samuel jwt", "hellosamuel@jwt.de", "", metaInfo);
		// Creation of the URL to standalone for the instance with the token
		URI handle = adapter.createJWTStartURL(jwtTokenForApiUser);
		// For test purposes log output and open in default browser
		System.out.println("SSO URI: " + handle);
		// Runtime.getRuntime().exec("cmd.exe /c start chrome " + handle);
		Runtime.getRuntime().exec("cmd.exe /c start " + handle);
		System.out.println("done jwtTokenForApiUser " + jwtTokenForApiUser);
	}

}
