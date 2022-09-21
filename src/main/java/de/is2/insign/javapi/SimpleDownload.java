package de.is2.insign.javapi;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;

import de.is2.sign.service.rest.json.JSONSessionInfoResult;
import de.is2.sign.service.rest.json.JSONSessionsResult;

public class SimpleDownload {

	private String insignURL = ApiData.insignURL;
	private String controllerName = ApiData.controllerName;
	private String controllerPassword = ApiData.controllerPassword;
	private String user = ApiData.userID;
	private static String sessionid = null;
	private static boolean unzip = false;

	public static void main(final String[] args) throws Exception {
		new SimpleDownload().run(args);
	}

	@SuppressWarnings({ "unchecked", "rawtypes" })
	public void run(final String[] args) throws Exception {
		if (args.length > 0) insignURL = args[0];
		if (args.length > 1) controllerPassword = args[1];
		
		// Step 1: Create an adapter
		IInSignTransportAdapterFactory factory;
		if (args.length > 2 && "apache".equalsIgnoreCase(args[2])) {
			factory = new InSignTransPortAdpaterFactoryApacheHttpClient(insignURL, controllerName, controllerPassword);
		} else {
			factory = new InSignTransPortAdapterFactoryJod(insignURL, controllerName, controllerPassword);
		}
		final InSignAdapter adapter = new InSignAdapter(factory);

		List<String> sessionids = new ArrayList<String>();
		if (!StringUtils.isBlank(sessionid)) {
			sessionids.add(sessionid);
		} else {
			// If no sessionID is given -> extract every document for the user
			JSONSessionsResult sessions = adapter.getAllUserSessions(user, null);
			for (JSONSessionInfoResult info : sessions.getSessions()) {
				sessionids.add(info.getSessionid());
			}
		}
		for (String id : sessionids) {
			InSignSessionHandle handle = new InSignSessionHandle(id, user);
			File f = new File(id + ".zip");
			FileUtils.copyInputStreamToFile(adapter.getDocumentsZIP(handle), f);
			if (unzip) {
				File dic = new File("./" + id);
				unzip(f.getAbsolutePath(), dic.getAbsolutePath());
				// Remove zip
				f.delete();
			}
		}
	}

	private void unzip(String zipFilePath, String destDir) {
		File dir = new File(destDir);
		// Create output directory if it doesn't exist
		if (!dir.exists())
			dir.mkdirs();
		FileInputStream fis;
		// Buffer for read and write data to file
		byte[] buffer = new byte[1024];
		try {
			fis = new FileInputStream(zipFilePath);
			ZipInputStream zis = new ZipInputStream(fis);
			ZipEntry ze = zis.getNextEntry();
			while (ze != null) {
				String fileName = ze.getName();
				File newFile = new File(destDir + File.separator + fileName);
				// Create directories for sub directories in zip
				new File(newFile.getParent()).mkdirs();
				FileOutputStream fos = new FileOutputStream(newFile);
				int len;
				while ((len = zis.read(buffer)) > 0) {
					fos.write(buffer, 0, len);
				}
				fos.close();
				// Close this ZipEntry
				zis.closeEntry();
				ze = zis.getNextEntry();
			}
			// Close last ZipEntry
			zis.closeEntry();
			zis.close();
			fis.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

}
