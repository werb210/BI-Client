package com.boreal.risk.client;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import org.json.JSONObject;

// BI_CLIENT_BACKGROUND_SYNC_v308
public class BackgroundSyncWorker extends Worker {
  private static final int MAX_RUNS = 20;

  public BackgroundSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
    super(context, params);
  }

  @NonNull
  @Override
  public Result doWork() {
    String id = getInputData().getString("id");
    String url = getInputData().getString("url");
    String bodyPath = getInputData().getString("bodyPath");
    if (id == null || url == null || bodyPath == null) return Result.failure();
    File body = new File(bodyPath);
    if (!body.exists()) return Result.failure();
    HttpURLConnection connection = null;
    try {
      connection = (HttpURLConnection) new URL(url).openConnection();
      connection.setRequestMethod(getInputData().getString("method") == null ? "POST" : getInputData().getString("method"));
      connection.setDoOutput(true);
      connection.setConnectTimeout(30000);
      connection.setReadTimeout(120000);
      connection.setFixedLengthStreamingMode(body.length());
      connection.setRequestProperty("Content-Type", getInputData().getString("contentType"));
      String headersJson = getInputData().getString("headers");
      JSONObject headers = new JSONObject(headersJson == null ? "{}" : headersJson);
      Iterator<String> keys = headers.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        connection.setRequestProperty(key, headers.getString(key));
      }
      try (OutputStream out = connection.getOutputStream(); FileInputStream in = new FileInputStream(body)) {
        byte[] buffer = new byte[16384];
        int read;
        while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
      }
      int status = connection.getResponseCode();
      boolean finished = (status >= 200 && status < 300) || (status >= 400 && status < 500 && status != 408 && status != 429);
      if (finished || getRunAttemptCount() >= MAX_RUNS) {
        BackgroundSyncPlugin.record(getApplicationContext(), id, status);
        body.delete();
        return status >= 200 && status < 300 ? Result.success() : Result.failure();
      }
      return Result.retry();
    } catch (Exception error) {
      if (getRunAttemptCount() >= MAX_RUNS) {
        BackgroundSyncPlugin.record(getApplicationContext(), id, 0);
        return Result.failure();
      }
      return Result.retry();
    } finally {
      if (connection != null) connection.disconnect();
    }
  }
}
